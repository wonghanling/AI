import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    if (recordId && recordId !== 'undefined') {
      const { data: record } = await supabase
        .from('video_generations')
        .select('metadata')
        .eq('id', recordId)
        .eq('user_id', user.id)
        .single();
      endpoint = record?.metadata?.endpoint || '';
    }

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

    // 直接用 fal REST API，避免 SDK 路径解析问题
    const statusRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${taskId}/status`,
      { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
    );

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.error('fal status 错误:', statusRes.status, errText);
      return NextResponse.json({ error: `fal 查询失败: ${statusRes.status}`, detail: errText }, { status: 500 });
    }

    const statusData = await statusRes.json();
    console.log('fal 状态:', statusData.status);

    let status = 'processing';
    let progress = 30;
    let videoUrl: string | null = null;

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${taskId}`,
        { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
      );
      if (resultRes.ok) {
        const data = await resultRes.json();
        videoUrl = data?.video?.url || data?.video_url || data?.url || null;
        console.log('视频URL:', videoUrl);
      }
      status = videoUrl ? 'completed' : 'failed';
      progress = videoUrl ? 100 : 0;
    } else if (statusData.status === 'IN_QUEUE') {
      status = 'pending';
      progress = 10;
    } else if (statusData.status === 'IN_PROGRESS') {
      status = 'processing';
      progress = 50;
    } else {
      status = 'failed';
      progress = 0;
    }

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

    return NextResponse.json({ success: true, taskId, status, progress, videoUrl });

  } catch (error: any) {
    console.error('查询视频状态错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
