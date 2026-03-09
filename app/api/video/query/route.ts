import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

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

    // fal REST API：appId 只取前两段（owner/alias），子路径不放在 URL 里
    const appId = endpoint.split('/').slice(0, 2).join('/');

    const statusRes = await fetch(
      `https://queue.fal.run/${appId}/requests/${taskId}/status`,
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
        `https://queue.fal.run/${appId}/requests/${taskId}`,
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
      // 下载视频并上传到 Supabase Storage
      try {
        const videoRes = await fetch(videoUrl);
        if (videoRes.ok) {
          const videoBlob = await videoRes.blob();
          const filename = `videos/${user.id}/${Date.now()}.mp4`;
          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filename, videoBlob, { contentType: 'video/mp4', upsert: false });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(filename);
            videoUrl = publicUrlData.publicUrl;
            console.log('视频已上传到 Storage:', videoUrl);
          }
        }
      } catch (err) {
        console.error('上传视频到 Storage 失败:', err);
      }

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
