import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // 使用 service role key 绕过 RLS 限制
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 获取用户会话
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: '用户认证失败' }, { status: 401 });
    }

    // 获取请求参数
    const body = await request.json();
    const {
      prompt,
      model,
      aspectRatio,
      duration,
      startFrameImage,
      endFrameImage,
      negativePrompt
    } = body;

    if (!prompt || !model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 获取用户积分
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('video_credits')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      // 如果用户不存在，自动创建
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_type: 'free',
          credits: 0,
          image_credits: 0,
          video_credits: 0
        })
        .select('video_credits')
        .single();

      if (createError || !newUser) {
        console.error('创建用户记录失败:', createError);
        return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
      }

      // 新用户没有积分，直接返回错误
      return NextResponse.json({ error: '视频积分不足' }, { status: 400 });
    }

    // 检查积分是否足够
    const modelCost = body.cost || 10; // 从前端传入的模型费用
    if (userData.video_credits < modelCost) {
      return NextResponse.json({ error: '视频积分不足' }, { status: 400 });
    }

    // 准备云雾API请求参数
    const yunwuApiKey = process.env.YUNWU_API_KEY;
    if (!yunwuApiKey) {
      return NextResponse.json({ error: '云雾API密钥未配置' }, { status: 500 });
    }

    // 根据模型构建请求参数
    const images = [];
    if (startFrameImage) images.push(startFrameImage);
    if (endFrameImage) images.push(endFrameImage);

    const videoRequest: any = {
      prompt: prompt,
      model: model,
      images: images
    };

    // 根据不同模型添加特定参数
    if (model.includes('sora')) {
      // Sora 模型参数
      videoRequest.orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
      videoRequest.size = 'large';
      videoRequest.duration = duration || 15;
      videoRequest.watermark = false;
      videoRequest.private = true;
    } else if (model.includes('veo')) {
      // Veo 模型参数
      videoRequest.aspect_ratio = aspectRatio || '16:9';
      videoRequest.enable_upsample = true;
      videoRequest.enhance_prompt = true;
    } else if (model.includes('runway')) {
      // Runway 模型参数
      videoRequest.promptImage = startFrameImage;
      videoRequest.promptText = prompt;
      videoRequest.watermark = false;
      videoRequest.duration = duration || 10;
      videoRequest.ratio = aspectRatio === '16:9' ? '1280:768' : '768:1280';
    }

    // 调用云雾API创建视频任务
    const apiUrl = model.includes('runway')
      ? 'https://allapi.store/runwayml/v1/image_to_video'
      : model.includes('luma')
      ? 'https://allapi.store/luma/generations'
      : 'https://allapi.store/v1/video/create';

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${yunwuApiKey}`
      },
      body: JSON.stringify(videoRequest)
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('云雾API错误:', errorData);
      return NextResponse.json({
        error: '视频生成请求失败',
        details: errorData
      }, { status: 500 });
    }

    const taskData = await apiResponse.json();

    // 扣除积分
    const { error: deductError } = await supabase
      .from('users')
      .update({ video_credits: userData.video_credits - modelCost })
      .eq('id', user.id);

    if (deductError) {
      console.error('扣除积分失败:', deductError);
      return NextResponse.json({ error: '扣除积分失败' }, { status: 500 });
    }

    // 创建视频生成记录
    const { data: videoRecord, error: recordError } = await supabase
      .from('video_generations')
      .insert({
        user_id: user.id,
        prompt: prompt,
        model: model,
        duration: duration || 5,
        resolution: '1080p',
        aspect_ratio: aspectRatio || '16:9',
        input_image_url: startFrameImage,
        status: 'pending',
        cost_credits: modelCost,
        task_id: taskData.id,
        progress: 0,
        metadata: {
          negativePrompt: negativePrompt,
          endFrameImage: endFrameImage
        }
      })
      .select()
      .single();

    if (recordError) {
      console.error('创建视频记录失败:', recordError);
      return NextResponse.json({ error: '创建视频记录失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId: taskData.id,
      recordId: videoRecord.id,
      status: taskData.status || 'pending',
      remainingCredits: userData.video_credits - modelCost
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({
      error: '服务器错误',
      details: error.message
    }, { status: 500 });
  }
}
