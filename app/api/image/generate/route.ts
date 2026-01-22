import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 初始化 OpenRouter 客户端
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://boluoing.com',
    'X-Title': 'BoLuoing AI',
  },
});

// 图片模型配置
const IMAGE_MODELS: Record<string, { openrouterModel: string; cost: number }> = {
  'flux-schnell': {
    openrouterModel: 'black-forest-labs/flux-schnell',
    cost: 0.003,
  },
  'flux-pro': {
    openrouterModel: 'black-forest-labs/flux-pro',
    cost: 0.05,
  },
  'stable-diffusion': {
    openrouterModel: 'stability-ai/stable-diffusion-xl',
    cost: 0.01,
  },
  'nano-banana': {
    openrouterModel: 'google/gemini-2.5-flash-image',
    cost: 0.005, // 5 积分 = ¥0.5，1 积分 = ¥0.1
  },
  'nano-banana-pro': {
    openrouterModel: 'google/gemini-3-pro-image-preview',
    cost: 0.009, // 9 积分 = ¥0.9
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
    let creditsPerImage = 5; // 默认 1K
    if (model === 'nano-banana') {
      if (resolution === '2K') creditsPerImage = 9;
      else creditsPerImage = 5;
    } else if (model === 'nano-banana-pro') {
      if (resolution === '4K') creditsPerImage = 40;
      else if (resolution === '2K') creditsPerImage = 20;
      else creditsPerImage = 15;
    }
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

    // 6. 调用 OpenRouter 生成图片
    const generatedImages: string[] = [];
    try {
      // 根据 count 参数生成多张图片
      for (let i = 0; i < count; i++) {
        let imageUrl = '';

        // Nano Banana 模型使用原生 fetch + modalities
        if (model.includes('nano-banana')) {
          console.log('=== Nano Banana 模型调用 ===');
          console.log('模型:', modelConfig.openrouterModel);
          console.log('Prompt:', prompt);

          // 构建请求体
          const requestBody: any = {
            model: modelConfig.openrouterModel,
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

          // 使用 fetch 直接调用
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://boluoing.com',
              'X-Title': 'BoLuoing AI',
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
        } else {
          // 其他模型使用 OpenAI SDK
          const messageContent: any = [];

          if (body.imageUrl) {
            messageContent.push({
              type: 'image_url',
              image_url: { url: body.imageUrl },
            });
          }

          messageContent.push({
            type: 'text',
            text: prompt,
          });

          const response = await openrouter.chat.completions.create({
            model: modelConfig.openrouterModel,
            messages: [
              {
                role: 'user',
                content: messageContent.length === 1 ? messageContent[0].text : messageContent,
              },
            ],
          });

          const messageResponse = response.choices?.[0]?.message?.content;

          if (!messageResponse) {
            throw new Error('未能生成图片');
          }

          if (typeof messageResponse === 'string') {
            if (messageResponse.startsWith('http://') || messageResponse.startsWith('https://')) {
              imageUrl = messageResponse;
            } else if (messageResponse.startsWith('data:image/')) {
              imageUrl = messageResponse;
            } else {
              const urlMatch = messageResponse.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
              if (urlMatch) {
                imageUrl = urlMatch[1];
              } else {
                imageUrl = messageResponse.trim();
              }
            }
          }

          if (!imageUrl) {
            throw new Error('无法解析图片 URL');
          }
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
          size: `${resolution} ${aspectRatio}`,
          quality: quality,
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
