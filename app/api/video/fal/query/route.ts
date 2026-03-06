import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({
  credentials: process.env.FAL_KEY!,
});

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const recordId = searchParams.get('recordId');
    const endpoint = searchParams.get('endpoint');

    if (!taskId || !recordId || !endpoint) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 查询 fal.ai 任务状态
    const statusResult = await fal.queue.status(endpoint, {
      requestId: taskId,
      logs: false,
    });

    console.log('fal.ai 任务状态:', statusResult.status);

    let status = 'processing';
    let progress = 30;
    let videoUrl = null;

    if (statusResult.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId: taskId });
      console.log('fal.ai 结果:', JSON.stringify(result, null, 2));

      const data = result.data as any;
      videoUrl = data?.video?.url || data?.video_url || data?.url || null;

      if (videoUrl) {
        status = 'completed';
        progress = 100;
      } else {
        console.warn('任务完成但未找到视频URL:', data);
        status = 'failed';
      }
    } else if (statusResult.status === 'IN_QUEUE') {
      status = 'pending';
      progress = 10;
    } else if (statusResult.status === 'IN_PROGRESS') {
      status = 'processing';
      progress = 50;
    } else {
      // 其他未知状态视为失败
      status = 'failed';
      progress = 0;
    }

    // 更新数据库记录
    const updateData: any = { status, progress };
    if (videoUrl) {
      updateData.video_url = videoUrl;
      updateData.completed_at = new Date().toISOString();
    }
    if (status === 'failed') {
      updateData.error_message = '生成失败';
    }

    await supabaseAdmin
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
