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
      if (resolution === '4K') creditsPerImage = 25;
      else if (resolution === '2K') creditsPerImage = 15;
      else creditsPerImage = 9;
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

    // 6. 调用 OpenRouter 生成图片（使用 chat completions API）
    const generatedImages: string[] = [];
    try {
      // 根据 count 参数生成多张图片
      for (let i = 0; i < count; i++) {
        // 构建消息内容
        const messageContent: any = [];

        // 如果有上传的图片，添加到消息中
        if (body.imageUrl) {
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: body.imageUrl,
            },
          });
        }

        // 添加文本 prompt
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

        // 解析响应内容
        const messageResponse = response.choices?.[0]?.message?.content;

        console.log('=== OpenRouter 完整响应 ===');
        console.log('Response:', JSON.stringify(response, null, 2));
        console.log('Message Content:', messageResponse);
        console.log('Content Type:', typeof messageResponse);

        if (!messageResponse) {
          throw new Error('未能生成图片：响应内容为空');
        }

        // 尝试解析 content，可能是字符串或包含 parts 的对象
        let imageUrl = '';

        // 如果是字符串，可能直接是 URL 或 base64
        if (typeof messageResponse === 'string') {
          // 检查是否是完整的 data URI
          if (messageResponse.startsWith('data:image/')) {
            imageUrl = messageResponse;
          }
          // 检查是否是 HTTP(S) URL
          else if (messageResponse.startsWith('http://') || messageResponse.startsWith('https://')) {
            imageUrl = messageResponse;
          }
          // 检查是否是纯 base64（没有 data URI 前缀）
          else if (/^[A-Za-z0-9+/=]+$/.test(messageResponse.trim())) {
            // 假设是 PNG 格式，添加 data URI 前缀
            imageUrl = `data:image/png;base64,${messageResponse.trim()}`;
            console.log('检测到纯 base64，已添加 data URI 前缀');
          }
          // 尝试从 markdown 格式中提取 URL
          else {
            const urlMatch = messageResponse.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
            if (urlMatch) {
              imageUrl = urlMatch[1];
            } else {
              // 尝试提取任何 URL
              const anyUrlMatch = messageResponse.match(/https?:\/\/[^\s\)]+/);
              if (anyUrlMatch) {
                imageUrl = anyUrlMatch[0];
              } else {
                console.error('无法识别的字符串格式:', messageResponse.substring(0, 200));
              }
            }
          }
        }
        // 如果是对象，尝试从 parts 中提取
        else if (typeof messageResponse === 'object') {
          // 检查是否有 parts 数组
          if ('parts' in messageResponse && Array.isArray((messageResponse as any).parts)) {
            const parts = (messageResponse as any).parts;
            for (const part of parts) {
              if (part.type === 'image_url' && part.image_url?.url) {
                imageUrl = part.image_url.url;
                break;
              } else if (part.type === 'text' && part.text) {
                // 尝试从文本中提取 URL
                const urlMatch = part.text.match(/https?:\/\/[^\s]+/);
                if (urlMatch) {
                  imageUrl = urlMatch[0];
                  break;
                }
              } else if (part.type === 'image' && part.data) {
                // 如果有 image 类型的 part，可能包含 base64 数据
                imageUrl = `data:image/png;base64,${part.data}`;
                break;
              }
            }
          }
          // 检查是否直接包含 image_url
          else if ('image_url' in messageResponse) {
            imageUrl = (messageResponse as any).image_url;
          }
          // 检查是否直接包含 url
          else if ('url' in messageResponse) {
            imageUrl = (messageResponse as any).url;
          }
        }

        if (!imageUrl) {
          console.error('=== 无法解析图片 URL ===');
          console.error('响应类型:', typeof messageResponse);
          console.error('响应内容:', JSON.stringify(messageResponse, null, 2));
          throw new Error('无法解析图片 URL，请查看服务器日志');
        }

        console.log('成功解析图片 URL:', imageUrl.substring(0, 100));
        generatedImages.push(imageUrl);
      }
    } catch (error: any) {
      console.error('Image generation error:', error);
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
