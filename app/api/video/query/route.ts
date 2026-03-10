import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';
import { uploadToStorage } from '@/lib/storage-upload';
import { Service } from '@volcengine/openapi';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

const volcService = new Service({
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  serviceName: 'cv',
  accessKeyId: process.env.VOLC_ACCESS_KEY_ID!,
  secretKey: process.env.VOLC_SECRET_ACCESS_KEY!,
});
const jimengQuery = volcService.createJSONAPI('CVSync2AsyncGetResult', { Version: '2022-08-31' });

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

    // 从数据库获取 endpoint
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

    let status = 'processing';
    let progress = 30;
    let videoUrl: string | null = null;

    if (endpoint.startsWith('jimeng:')) {
      // 即梦查询
      const reqKey = endpoint.replace('jimeng:', '');
      const jmRes = await jimengQuery({ req_key: reqKey, task_id: taskId }) as any;
      if (jmRes?.code !== 10000) {
        status = 'failed'; progress = 0;
      } else {
        const jmStatus = jmRes?.data?.status;
        if (jmStatus === 'done') {
          videoUrl = jmRes?.data?.video_url || null;
          status = videoUrl ? 'completed' : 'failed';
          progress = videoUrl ? 100 : 0;
        } else if (jmStatus === 'in_queue') {
          status = 'pending'; progress = 10;
        } else if (jmStatus === 'generating') {
          status = 'processing'; progress = 50;
        } else {
          status = 'failed'; progress = 0;
        }
      }

    } else if (endpoint.startsWith('dashscope:')) {
      // DashScope 查询
      const res = await fetch(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        { headers: { 'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}` } }
      );
      if (!res.ok) {
        status = 'failed'; progress = 0;
      } else {
        const data = await res.json();
        const taskStatus = data?.output?.task_status;
        if (taskStatus === 'SUCCEEDED') {
          videoUrl = data?.output?.video_url || null;
          status = videoUrl ? 'completed' : 'failed';
          progress = videoUrl ? 100 : 0;
        } else if (taskStatus === 'PENDING') {
          status = 'pending'; progress = 10;
        } else if (taskStatus === 'RUNNING') {
          status = 'processing'; progress = 50;
        } else {
          status = 'failed'; progress = 0;
        }
      }

    } else {
      // fal.ai 查询
      const statusResult = await fal.queue.status(endpoint, { requestId: taskId, logs: false });
      if (statusResult.status === 'COMPLETED') {
        const result = await fal.queue.result(endpoint, { requestId: taskId });
        const data = result.data as any;
        videoUrl = data?.video?.url || data?.video_url || data?.url || null;
        status = videoUrl ? 'completed' : 'failed';
        progress = videoUrl ? 100 : 0;
      } else if (statusResult.status === 'IN_QUEUE') {
        status = 'pending'; progress = 10;
      } else if (statusResult.status === 'IN_PROGRESS') {
        status = 'processing'; progress = 50;
      } else {
        status = 'failed'; progress = 0;
      }
    }

    // 上传视频到 Storage（videos bucket）
    if (videoUrl) {
      try {
        videoUrl = await uploadToStorage(user.id, videoUrl, 'video');
      } catch (err) {
        console.warn('上传视频到 Storage 失败，使用原始 URL:', err);
      }
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
