import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 云雾 API 配置
const YUNWU_API_URL = 'https://api.yunwu.zeabur.app/v1/chat/completions';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 模型配置
const IMAGE_MODELS: Record<string, { yunwuModel: string; cost: number }> = {
  'stability-ai/sdxl': {
    yunwuModel: 'stability-ai/sdxl',
    cost: 3,
  },
  'mj_imagine': {
    yunwuModel: 'mj_imagine',
    cost: 6,
  },
  'flux.1.1-pro': {
    yunwuModel: 'flux.1.1-pro',
    cost: 10,
  },
  'flux-pro': {
    yunwuModel: 'flux-pro',
    cost: 6,
  },
  'flux-schnell': {
    yunwuModel: 'flux-schnell',
    cost: 3,
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
      count = 1,
    } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 验证模型
    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 4. 计算积分消耗
    const creditsPerImage = modelConfig.cost;
    const totalCredits = creditsPerImage * count;

    // 5. 检查用户积分
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('user_type, credits')
      .eq('id', user.id)
      .single();

    const userType = userData?.user_type || 'free';
    const credits = userData?.credits || 0;

    // 检查积分是否足够
    if (credits < totalCredits) {
      return NextResponse.json(
        { error: `积分不足，需要 ${totalCredits} 积分，当前仅有 ${credits} 积分` },
        { status: 403 }
      );
    }

    // 免费用户额外检查每日配额
    if (userType === 'free') {
      const today = new Date().toISOString().split('T')[0];
      const { count: dailyCount } = await supabaseAdmin
        .from('image_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today);

      if ((dailyCount || 0) >= 5) {
        return NextResponse.json({ error: '今日免费配额已用完，请升级到专业版' }, { status: 403 });
      }
    }

    // 6. 调用云雾 API 生成图片
    const generatedImages: string[] = [];
    try {
      // 根据 count 参数生成多张图片
      for (let i = 0; i < count; i++) {
        console.log('=== 云雾 API 调用 ===');
        console.log('模型:', modelConfig.yunwuModel);
        console.log('Prompt:', prompt);

        // 构建提示词（如果有宽高比要求，添加到提示词中）
        let fullPrompt = prompt;
        if (aspectRatio && aspectRatio !== '1:1') {
          fullPrompt = `${prompt}, aspect ratio ${aspectRatio}`;
        }

        const response = await fetch(YUNWU_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${YUNWU_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelConfig.yunwuModel,
            messages: [
              {
                role: 'user',
                content: fullPrompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('云雾 API 错误:', response.status, errorText);
          throw new Error(`API 错误: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('响应:', JSON.stringify(data, null, 2));

        const messageContent = data.choices?.[0]?.message?.content;

        if (!messageContent) {
          throw new Error('未能生成图片');
        }

        // 解析图片 URL（格式：![image](url)）
        let imageUrl = '';
        if (typeof messageContent === 'string') {
          // 尝试匹配 Markdown 格式的图片链接
          const markdownMatch = messageContent.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
          if (markdownMatch) {
            imageUrl = markdownMatch[1];
          } else if (messageContent.startsWith('http://') || messageContent.startsWith('https://')) {
            imageUrl = messageContent;
          } else if (messageContent.startsWith('data:image/')) {
            imageUrl = messageContent;
          } else {
            // 尝试直接提取 URL
            const urlMatch = messageContent.match(/https?:\/\/[^\s)]+/);
            if (urlMatch) {
              imageUrl = urlMatch[0];
            }
          }
        }

        if (!imageUrl) {
          console.error('无法解析图片 URL');
          console.error('响应内容:', messageContent);
          throw new Error('无法解析图片 URL');
        }

        console.log('成功提取图片:', imageUrl.substring(0, 100));
        generatedImages.push(imageUrl);
      }
    } catch (error: any) {
      console.error('图片生成错误:', error);
      return NextResponse.json(
        { error: '图片生成失败: ' + (error.message || '未知错误') },
        { status: 500 }
      );
    }

    // 7. 保存生成记录（每张图片一条记录）
    const imageRecords: any[] = [];
    for (const imageUrl of generatedImages) {
      const { data: imageRecord, error: insertError } = await supabaseAdmin
        .from('image_generations')
        .insert({
          user_id: user.id,
          model: model,
          prompt: prompt,
          image_url: imageUrl,
          size: aspectRatio,
          quality: 'standard',
          cost: creditsPerImage,
          date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to save image record:', insertError);
      } else {
        imageRecords.push(imageRecord);
      }
    }

    // 8. 扣除积分
    const newCredits = Math.max(0, credits - totalCredits);
    await supabaseAdmin
      .from('users')
      .update({ credits: newCredits })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      images: generatedImages.map((url, i) => ({
        url,
        id: imageRecords[i]?.id,
        prompt: prompt,
      })),
      model: model,
      prompt: prompt,
      totalCredits: totalCredits,
      remainingBalance: newCredits,
    });
  } catch (error: any) {
    console.error('Image API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
