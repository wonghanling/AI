import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({
  credentials: process.env.FAL_KEY!,
});

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: '用户认证失败' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const recordId = searchParams.get('recordId');

    if (!taskId) return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });

    let endpoint = '';

    // 如果有 recordId，从数据库获取 endpoint
    if (recordId && recordId !== 'undefined') {
      const { data: record } = await supabase
        .from('video_generations')
        .select('metadata')
        .eq('id', recordId)
        .eq('user_id', user.id)
        .single();
      endpoint = record?.metadata?.endpoint || '';
    }

    // 如果没有 endpoint，尝试用 taskId 查
    if (!endpoint) {
      const { data: record } = await supabase
        .from('video_generations')
        .select('metadata')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .single();
      endpoint = record?.metadata?.endpoint || '';
    }

    if (!endpoint) {
      return NextResponse.json({ error: '找不到任务信息' }, { status: 404 });
    }

    console.log('查询 fal.ai 状态:', { endpoint, taskId });

    // 查询 fal.ai 任务状态
    let statusResult;
    try {
      statusResult = await fal.queue.status(endpoint, {
        requestId: taskId,
        logs: false,
      });
    } catch (falError: any) {
      console.error('fal.queue.status 错误:', falError?.message, falError?.body);
      return NextResponse.json({ error: falError?.message || 'fal 查询失败' }, { status: 500 });
    }

    console.log('fal.ai 状态:', statusResult.status);

    let status = 'processing';
    let progress = 30;
    let videoUrl: string | null = null;

    if (statusResult.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId: taskId });
      const data = result.data as any;
      videoUrl = data?.video?.url || data?.video_url || data?.url || null;
      status = videoUrl ? 'completed' : 'failed';
      progress = videoUrl ? 100 : 0;
      console.log('视频URL:', videoUrl);
    } else if (statusResult.status === 'IN_QUEUE') {
      status = 'pending';
      progress = 10;
    } else if (statusResult.status === 'IN_PROGRESS') {
      status = 'processing';
      progress = 50;
    } else {
      status = 'failed';
      progress = 0;
    }

    // 更新数据库
    const updateData: any = { status, progress };
    if (videoUrl) {
      updateData.video_url = videoUrl;
      updateData.completed_at = new Date().toISOString();
    }
    if (status === 'failed') {
      updateData.error_message = '生成失败';
    }

    await supabase
      .from('video_generations')
      .update(updateData)
      .eq('id', recordId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      taskId,
      status,
      progress,
      videoUrl,
    });

  } catch (error: any) {
    console.error('查询视频状态错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
