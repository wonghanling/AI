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

// 模型配置
const IMAGE_MODELS: Record<string, {
  yunwuModel: string;
  cost: number;
  apiType: 'chat' | 'midjourney' | 'replicate' | 'image-generation';
  requiresImage?: boolean; // 是否必须上传图片
  supportsImage?: boolean; // 是否支持上传图片（可选）
}> = {
  'stability-ai/sdxl': {
    yunwuModel: 'stability-ai/stable-diffusion-img2img',
    cost: 3,
    apiType: 'replicate',
    requiresImage: true, // 必须上传图片（图生图）
  },
  'mj_imagine': {
    yunwuModel: 'midjourney',
    cost: 6,
    apiType: 'midjourney',
  },
  'flux.1.1-pro': {
    yunwuModel: 'flux.1.1-pro',
    cost: 10,
    apiType: 'chat',
  },
  'flux-pro': {
    yunwuModel: 'flux-pro',
    cost: 6,
    apiType: 'chat',
  },
  'flux-schnell': {
    yunwuModel: 'flux-schnell',
    cost: 3,
    apiType: 'chat',
  },
  'doubao-seedream-4-5-251128': {
    yunwuModel: 'doubao-seedream-4-5-251128',
    cost: 3,
    apiType: 'image-generation',
    supportsImage: true, // 支持图片（可选），既可以文生图也可以图生图
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
      imageBase64, // 图生图的基础图片（base64）
    } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 3. 验证模型
    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 检查图生图模型是否提供了图片
    if (modelConfig.requiresImage && !imageBase64) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
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

    // 图片生成没有免费配额限制，只按积分扣费

    // 6. 调用云雾 API 生成图片
    const generatedImages: string[] = [];
    try {
      // 根据 count 参数生成多张图片
      for (let i = 0; i < count; i++) {
        console.log('=== 云雾 API 调用 ===');
        console.log('模型:', modelConfig.yunwuModel);
        console.log('API 类型:', modelConfig.apiType);
        console.log('Prompt:', prompt);

        let imageUrl = '';

        // 根据 API 类型选择不同的调用方式
        if (modelConfig.apiType === 'midjourney') {
          // Midjourney 专用接口
          const response = await fetch(`${YUNWU_BASE_URL}/mj/submit/imagine`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${YUNWU_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              botType: 'MID_JOURNEY',
              prompt: prompt,
              base64Array: [],
              notifyHook: '',
              state: '',
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Midjourney API 错误:', response.status, errorText);
            throw new Error(`API 错误: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log('Midjourney 响应:', JSON.stringify(data, null, 2));

          if (data.code !== 1) {
            throw new Error(data.description || '生成失败');
          }

          const taskId = data.result;
          console.log('任务 ID:', taskId);

          // 轮询获取结果（最多等待 60 秒）
          let attempts = 0;
          const maxAttempts = 30; // 30 次 * 2 秒 = 60 秒

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待 2 秒

            const statusResponse = await fetch(`${YUNWU_BASE_URL}/mj/task/${taskId}/fetch`, {
              headers: {
                'Authorization': `Bearer ${YUNWU_API_KEY}`,
              },
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log(`轮询 ${attempts + 1}/${maxAttempts}:`, statusData.status);

              if (statusData.status === 'SUCCESS' && statusData.imageUrl) {
                imageUrl = statusData.imageUrl;
                console.log('成功获取图片:', imageUrl);
                break;
              } else if (statusData.status === 'FAILURE') {
                throw new Error('图片生成失败');
              }
            }

            attempts++;
          }

          if (!imageUrl) {
            throw new Error('图片生成超时，请稍后重试');
          }

        } else if (modelConfig.apiType === 'replicate') {
          // Replicate 异步接口（用于 SDXL 等模型）
          const requestBody: any = {
            model: modelConfig.yunwuModel,
            input: {
              prompt: prompt,
            },
          };

          // 如果是图生图模型，添加图片数据
          if (modelConfig.requiresImage && imageBase64) {
            requestBody.input.image = imageBase64;
            requestBody.input.prompt_strength = 0.8; // 提示词强度（0-1，越高越接近提示词）
          }

          const response = await fetch(`${YUNWU_BASE_URL}/replicate/v1/predictions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${YUNWU_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Replicate API 错误:', response.status, errorText);
            throw new Error(`API 错误: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log('Replicate 响应:', JSON.stringify(data, null, 2));

          const predictionId = data.id;
          console.log('预测 ID:', predictionId);

          // 轮询获取结果（最多等待 60 秒）
          let attempts = 0;
          const maxAttempts = 30; // 30 次 * 2 秒 = 60 秒

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待 2 秒

            const statusResponse = await fetch(`${YUNWU_BASE_URL}/replicate/v1/predictions/${predictionId}`, {
              headers: {
                'Authorization': `Bearer ${YUNWU_API_KEY}`,
              },
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log(`轮询 ${attempts + 1}/${maxAttempts}:`, statusData.status);

              if (statusData.status === 'succeeded' && statusData.output) {
                // output 可能是数组或字符串
                if (Array.isArray(statusData.output) && statusData.output.length > 0) {
                  imageUrl = statusData.output[0];
                } else if (typeof statusData.output === 'string') {
                  imageUrl = statusData.output;
                }
                console.log('成功获取图片:', imageUrl);
                break;
              } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || '图片生成失败');
              }
            }

            attempts++;
          }

          if (!imageUrl) {
            throw new Error('图片生成超时，请稍后重试');
          }

        } else if (modelConfig.apiType === 'image-generation') {
          // 豆包等模型使用 image generations 接口
          const requestBody: any = {
            model: modelConfig.yunwuModel,
            prompt: prompt,
            n: 1,
            size: aspectRatio || '1:1',
          };

          // 如果提供了图片，添加图片数据（支持图生图）
          if ((modelConfig.requiresImage || modelConfig.supportsImage) && imageBase64) {
            requestBody.image = imageBase64;
          }

          console.log('=== Image Generation API 调用 ===');
          console.log('模型:', modelConfig.yunwuModel);
          console.log('Prompt:', prompt);
          console.log('包含图片:', !!imageBase64);

          const response = await fetch(`${YUNWU_BASE_URL}/v1/images/generations`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${YUNWU_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Image Generation API 错误:', response.status, errorText);
            throw new Error(`API 错误: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log('响应:', JSON.stringify(data, null, 2));

          // 标准 OpenAI 格式: data.data[0].url
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            imageUrl = data.data[0].url || data.data[0].b64_json;
            if (data.data[0].b64_json && !imageUrl) {
              imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
            }
          }

          if (!imageUrl) {
            console.error('无法解析图片 URL');
            console.error('响应内容:', JSON.stringify(data, null, 2));
            throw new Error('无法解析图片 URL');
          }

          console.log('成功提取图片:', imageUrl.substring(0, 100));

        } else {
          // 其他模型使用 chat completions 接口
          const fullPrompt = aspectRatio && aspectRatio !== '1:1'
            ? `${prompt}, aspect ratio ${aspectRatio}`
            : prompt;

          const response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
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

          // 解析图片 URL
          if (typeof messageContent === 'string') {
            const markdownMatch = messageContent.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
            if (markdownMatch) {
              imageUrl = markdownMatch[1];
            } else if (messageContent.startsWith('http://') || messageContent.startsWith('https://')) {
              imageUrl = messageContent;
            } else if (messageContent.startsWith('data:image/')) {
              imageUrl = messageContent;
            } else {
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
              // 如果是外部 URL（云雾 API 返回的），不需要删除
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
          size: aspectRatio,
          cost_credits: creditsPerImage,
          status: 'completed',
          api_source: 'pro', // 标记来源为专业版
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
