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

        // Nano Banana 模型使用 OpenAI 兼容格式
        if (model.includes('nano-banana')) {
          console.log('=== Nano Banana 模型调用（云雾API - OpenAI兼容格式）===');
          console.log('模型:', modelConfig.yunwuModel);
          console.log('Prompt:', prompt);

          // 构建 OpenAI 兼容格式的 messages
          const messageContent: any[] = [];

          // 如果有上传的图片，先添加图片
          if (body.imageUrl) {
            console.log('包含上传的图片');
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: body.imageUrl
              }
            });
          }

          // 添加文本 prompt
          messageContent.push({
            type: 'text',
            text: prompt
          });

          const requestBody = {
            model: modelConfig.yunwuModel,
            messages: [{
              role: 'user',
              content: messageContent
            }],
            max_tokens: 4096
          };

          console.log('请求体:', JSON.stringify(requestBody, null, 2));

          // 使用 OpenAI 兼容端点
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
          console.log('=== OpenAI 兼容格式响应 ===');
          console.log('完整响应:', JSON.stringify(data, null, 2));

          // OpenAI 兼容格式：choices[0].message.content
          const message = data.choices?.[0]?.message;
          if (!message) {
            throw new Error('响应中没有 message');
          }

          console.log('Message 对象:', JSON.stringify(message, null, 2));

          // 尝试多种可能的响应格式
          // 1. 检查 message.content 是否是 URL
          if (typeof message.content === 'string') {
            if (message.content.startsWith('http://') || message.content.startsWith('https://')) {
              imageUrl = message.content;
              console.log('✅ 从 message.content 提取图片 URL');
            } else if (message.content.startsWith('data:image/')) {
              imageUrl = message.content;
              console.log('✅ 从 message.content 提取 base64 图片');
            }
          }

          // 2. 检查 message.images 数组（某些 API 可能用这个）
          if (!imageUrl && message.images && Array.isArray(message.images) && message.images.length > 0) {
            const firstImage = message.images[0];
            if (firstImage.image_url?.url) {
              imageUrl = firstImage.image_url.url;
              console.log('✅ 从 message.images 提取图片 URL');
            }
          }

          // 3. 检查 data.data（某些 API 可能直接返回在顶层）
          if (!imageUrl && data.data) {
            if (typeof data.data === 'string') {
              imageUrl = data.data;
              console.log('✅ 从 data.data 提取图片');
            } else if (data.data.url) {
              imageUrl = data.data.url;
              console.log('✅ 从 data.data.url 提取图片');
            }
          }

          if (!imageUrl) {
            console.error('无法解析图片');
            console.error('完整响应:', JSON.stringify(data, null, 2));
            throw new Error('无法解析图片 URL');
          }

          console.log('✅ 成功提取图片');
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
