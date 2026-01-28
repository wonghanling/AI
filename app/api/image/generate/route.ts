import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 云雾 API 配置
const YUNWU_BASE_URL = 'https://allapi.store';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 图片模型配置
const IMAGE_MODELS: Record<string, { yunwuModel: string; cost: number }> = {
  'nano-banana': {
    yunwuModel: 'gemini-2.5-flash-image',
    cost: 0.005, // 5 积分
  },
  'nano-banana-pro': {
    yunwuModel: 'gemini-3-pro-image-preview',
    cost: 0.009, // 基础价格，实际根据分辨率计算
  },
};

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }

    // 2. 解析请求体
    const body = await req.json();
    const {
      model,
      prompt,
      aspectRatio = '1:1',
      resolution = '1K',
      count = 1,
      size = '1024x1024',
      quality = 'standard'
    } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 验证模型
    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 4. 计算积分消耗（根据分辨率）
    let creditsPerImage = 5; // 默认 Nano Banana 固定 5 积分
    if (model === 'nano-banana') {
      creditsPerImage = 5; // 固定 5 积分/次
    } else if (model === 'nano-banana-pro') {
      if (resolution === '4K') creditsPerImage = 15;
      else if (resolution === '2K') creditsPerImage = 9;
      else creditsPerImage = 7; // 1K
    }
    const totalCredits = creditsPerImage * count;

    // 5. 检查用户积分
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('user_type, image_credits')
      .eq('id', user.id)
      .single();

    const userType = userData?.user_type || 'free';
    const imageCredits = userData?.image_credits || 0;

    // 检查积分是否足够
    if (imageCredits < totalCredits) {
      return NextResponse.json(
        { error: `积分不足，需要 ${totalCredits} 积分，当前仅有 ${imageCredits} 积分` },
        { status: 403 }
      );
    }

    // 6. 调用云雾 API 生成图片
    const generatedImages: string[] = [];
    try {
      // 根据 count 参数生成多张图片
      for (let i = 0; i < count; i++) {
        let imageUrl = '';

        // Nano Banana 模型使用 fetch + modalities
        if (model.includes('nano-banana')) {
          console.log('=== Nano Banana 模型调用（云雾API）===');
          console.log('模型:', modelConfig.yunwuModel);
          console.log('Prompt:', prompt);

          // 构建请求体
          const requestBody: any = {
            model: modelConfig.yunwuModel,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            modalities: ['image', 'text'], // 关键：必须添加 modalities
          };

          // 如果有上传的图片
          if (body.imageUrl) {
            console.log('包含上传的图片');
            requestBody.messages[0].content = [
              {
                type: 'image_url',
                image_url: { url: body.imageUrl },
              },
              {
                type: 'text',
                text: prompt,
              },
            ];
          }

          console.log('请求体:', JSON.stringify(requestBody, null, 2));

          // 使用 fetch 调用云雾 API
          const response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${YUNWU_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('API 错误:', response.status, errorText);
            throw new Error(`API 错误: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log('响应:', JSON.stringify(data, null, 2));

          const message = data.choices?.[0]?.message;
          console.log('Message 对象:', message);

          if (!message) {
            throw new Error('响应中没有 message');
          }

          // 关键：图片在 message.images 数组中，不是在 content 里
          if (message.images && Array.isArray(message.images) && message.images.length > 0) {
            console.log('找到 images 数组，长度:', message.images.length);
            const firstImage = message.images[0];
            console.log('第一张图片对象:', firstImage);

            if (firstImage.image_url && firstImage.image_url.url) {
              imageUrl = firstImage.image_url.url;
              console.log('从 images 数组提取图片 URL:', imageUrl.substring(0, 100));
            } else {
              throw new Error('images 数组中没有有效的 image_url');
            }
          }
          // 备用：尝试从 content 中提取
          else if (message.content) {
            console.log('未找到 images 数组，尝试从 content 提取');
            const content = message.content;
            console.log('内容:', content);
            console.log('内容类型:', typeof content);

            if (typeof content === 'string') {
              if (content.startsWith('data:image/')) {
                imageUrl = content;
              } else if (content.startsWith('http')) {
                imageUrl = content;
              } else if (/^[A-Za-z0-9+/=]{100,}$/.test(content.trim())) {
                imageUrl = `data:image/png;base64,${content.trim()}`;
                console.log('检测到纯 base64，已添加前缀');
              } else {
                const match = content.match(/https?:\/\/[^\s)]+/);
                if (match) imageUrl = match[0];
              }
            }
          } else {
            throw new Error('响应中既没有 images 也没有 content');
          }

          if (!imageUrl) {
            console.error('无法解析图片 URL');
            console.error('Message 对象:', JSON.stringify(message, null, 2));
            throw new Error('无法解析图片 URL');
          }

          console.log('成功提取图片:', imageUrl.substring(0, 100));
        }

        generatedImages.push(imageUrl);
      }
    } catch (error: any) {
      console.error('图片生成错误:', error);
      return NextResponse.json(
        { error: '图片生成失败: ' + (error.message || '未知错误') },
        { status: 500 }
      );
    }

    // 7. 检查用户历史记录数量，达到 50 张则清空所有记录（包括 Storage 文件）
    const { count: historyCount } = await supabaseAdmin
      .from('image_generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const MAX_HISTORY = 50;
    if (historyCount && historyCount >= MAX_HISTORY) {
      console.log(`用户 ${user.id} 历史记录已达到 ${historyCount} 条，开始清空所有记录`);

      // 获取所有历史记录（用于删除 Storage 文件）
      const { data: allRecords } = await supabaseAdmin
        .from('image_generations')
        .select('id, image_url')
        .eq('user_id', user.id);

      if (allRecords && allRecords.length > 0) {
        // 删除所有 Storage 文件
        for (const record of allRecords) {
          if (record.image_url) {
            try {
              // 如果是 Supabase Storage 的 URL，提取文件路径并删除
              if (record.image_url.includes('supabase') && record.image_url.includes('/storage/v1/object/public/')) {
                const urlParts = record.image_url.split('/storage/v1/object/public/');
                if (urlParts.length > 1) {
                  const pathWithBucket = urlParts[1];
                  const firstSlashIndex = pathWithBucket.indexOf('/');

                  if (firstSlashIndex > 0) {
                    const bucket = pathWithBucket.substring(0, firstSlashIndex);
                    const filePath = pathWithBucket.substring(firstSlashIndex + 1);

                    if (bucket && filePath) {
                      const { error: deleteError } = await supabaseAdmin.storage
                        .from(bucket)
                        .remove([filePath]);

                      if (deleteError) {
                        console.error(`删除 Storage 文件失败 (${bucket}/${filePath}):`, deleteError);
                      } else {
                        console.log(`已删除 Storage 文件: ${bucket}/${filePath}`);
                      }
                    }
                  }
                }
              }
              // 如果是 base64 或外部 URL，不需要删除
            } catch (storageError) {
              console.error('删除 Storage 文件异常:', storageError);
              // 继续执行，不影响数据库记录删除
            }
          }
        }

        // 删除所有数据库记录
        await supabaseAdmin
          .from('image_generations')
          .delete()
          .eq('user_id', user.id);

        console.log(`已清空用户 ${user.id} 的所有 ${allRecords.length} 条历史记录（包括文件）`);
      }
    }

    // 8. 保存生成记录（每张图片一条记录）
    const imageRecords: any[] = [];
    for (const imageUrl of generatedImages) {
      const { data: imageRecord, error: insertError } = await supabaseAdmin
        .from('image_generations')
        .insert({
          user_id: user.id,
          model: model,
          prompt: prompt,
          image_url: imageUrl,
          size: `${resolution} ${aspectRatio}`,
          cost_credits: creditsPerImage,
          status: 'completed',
          api_source: 'nano-banana', // 标记来源
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to save image record:', insertError);
      } else {
        imageRecords.push(imageRecord);
      }
    }

    // 9. 扣除积分
    const newImageCredits = Math.max(0, imageCredits - totalCredits);
    await supabaseAdmin
      .from('users')
      .update({ image_credits: newImageCredits })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      images: generatedImages.map((url, i) => ({
        url,
        id: imageRecords[i]?.id,
      })),
      model: model,
      prompt: prompt,
      totalCredits: totalCredits,
      remainingBalance: newImageCredits,
    });
  } catch (error: any) {
    console.error('Image API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
