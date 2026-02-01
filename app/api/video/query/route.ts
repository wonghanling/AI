import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // 获取任务ID
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const recordId = searchParams.get('recordId');

    if (!taskId || !recordId) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    // 获取云雾API密钥
    const yunwuApiKey = process.env.YUNWU_API_KEY;
    if (!yunwuApiKey) {
      return NextResponse.json({ error: '云雾API密钥未配置' }, { status: 500 });
    }

    // 查询云雾API任务状态
    const apiUrl = `https://allapi.store/v1/video/query?id=${encodeURIComponent(taskId)}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${yunwuApiKey}`
      }
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('查询云雾API错误:', errorData);
      return NextResponse.json({
        error: '查询任务状态失败',
        details: errorData
      }, { status: 500 });
    }

    const taskData = await apiResponse.json();

    // 详细日志：打印完整的API响应
    console.log('📦 云雾API完整响应:', JSON.stringify(taskData, null, 2));

    // 映射状态
    let status = 'processing';
    let progress = 50;
    let videoUrl = null;
    let thumbnailUrl = null;

    if (taskData.status === 'video_generation_completed' || taskData.status === 'completed') {
      status = 'completed';
      progress = 100;

      // 从返回数据中提取视频URL（多种可能的字段位置）
      videoUrl = taskData.video_url ||
                 taskData.detail?.video?.url ||
                 taskData.video?.url ||
                 taskData.detail?.output?.video_url ||
                 taskData.data?.video_url ||
                 taskData.data?.url ||
                 taskData.url;

      thumbnailUrl = taskData.thumbnail_url ||
                     taskData.detail?.video?.thumbnail ||
                     taskData.video?.thumbnail ||
                     taskData.data?.thumbnail_url;

      // 详细日志：视频URL提取结果
      console.log('🎬 视频URL提取结果:', {
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        possibleFields: {
          'taskData.video_url': taskData.video_url,
          'taskData.detail?.video?.url': taskData.detail?.video?.url,
          'taskData.video?.url': taskData.video?.url,
          'taskData.detail?.output?.video_url': taskData.detail?.output?.video_url,
          'taskData.data?.video_url': taskData.data?.video_url,
          'taskData.data?.url': taskData.data?.url,
          'taskData.url': taskData.url
        }
      });

      if (!videoUrl) {
        console.warn('⚠️ 警告：任务已完成但未找到视频URL，完整响应:', taskData);
      }
    } else if (taskData.status === 'failed' || taskData.status === 'error') {
      status = 'failed';
      progress = 0;
      console.error('❌ 视频生成失败:', taskData.detail?.error || taskData.error || '未知错误');
    } else if (taskData.status === 'video_generating' || taskData.status === 'processing') {
      status = 'processing';
      progress = 75;
    } else if (taskData.status === 'pending' || taskData.status === 'image_downloading') {
      status = 'pending';
      progress = 25;
    }

    // 更新Supabase记录
    const updateData: any = {
      status: status,
      progress: progress
    };

    if (videoUrl) {
      updateData.video_url = videoUrl;
      updateData.completed_at = new Date().toISOString();
    }

    if (thumbnailUrl) {
      updateData.thumbnail_url = thumbnailUrl;
    }

    if (status === 'failed') {
      updateData.error_message = taskData.detail?.error || '生成失败';
    }

    const { error: updateError } = await supabase
      .from('video_generations')
      .update(updateData)
      .eq('id', recordId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('更新视频记录失败:', updateError);
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      status: status,
      progress: progress,
      videoUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      rawData: taskData
    });

  } catch (error: any) {
    console.error('查询视频错误:', error);
    return NextResponse.json({
      error: '服务器错误',
      details: error.message
    }, { status: 500 });
  }
}
