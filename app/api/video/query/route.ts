import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';
import { uploadToStorage } from '@/lib/storage-upload';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

// 火山引擎 HMAC-SHA256 签名查询即梦任务状态（不用 SDK，避免 Vercel 挂起）
async function queryJimeng(reqKey: string, taskId: string) {
  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID!;
  const secretKey = process.env.VOLC_SECRET_ACCESS_KEY!;
  const host = 'visual.volcengineapi.com';
  const service = 'cv';
  const region = 'cn-north-1';
  const action = 'CVSync2AsyncGetResult';
  const version = '2022-08-31';

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(0, 19).replace(/[-:T]/g, '') + 'Z';
  const datetime = now.toISOString().slice(0, 19).replace(/[:-]/g, '') + 'Z';

  const body = JSON.stringify({ req_key: reqKey, task_id: taskId });
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${bodyHash}\nx-date:${datetime}\n`;
  const signedHeaders = 'content-type;host;x-content-sha256;x-date';
  const canonicalRequest = [
    'POST',
    '/',
    `Action=${action}&Version=${version}`,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const credentialScope = `${dateStr}/${region}/${service}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    datetime,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest();

  const signingKey = hmac(hmac(hmac(hmac(`VOLC${secretKey}`, dateStr), region), service), 'request');
  const signature = hmac(signingKey, stringToSign).toString('hex');

  const authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}/?Action=${action}&Version=${version}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': host,
      'X-Date': datetime,
      'X-Content-Sha256': bodyHash,
      'Authorization': authorization,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`即梦查询 HTTP 错误: ${res.status}`);
  return res.json();
}

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
      const reqKey = endpoint.replace('jimeng:', '');
      const jmRes = await queryJimeng(reqKey, taskId);
      if (jmRes?.code !== 10000) {
        return NextResponse.json({ error: '即梦查询失败', detail: jmRes }, { status: 500 });
      }
      const jmStatus = jmRes?.data?.status;
      if (jmStatus === 'done') {
        videoUrl = jmRes?.data?.video_url || jmRes?.data?.videos?.[0]?.url || null;
        status = videoUrl ? 'completed' : 'failed';
        progress = videoUrl ? 100 : 0;
        if (!videoUrl) return NextResponse.json({ error: '即梦完成但无视频URL', detail: jmRes?.data }, { status: 500 });
      } else if (jmStatus === 'in_queue') {
        status = 'pending'; progress = 10;
      } else if (jmStatus === 'generating') {
        status = 'processing'; progress = 50;
      } else {
        return NextResponse.json({ error: '即梦未知状态', detail: jmRes?.data }, { status: 500 });
      }

    } else if (endpoint.startsWith('dashscope:')) {
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
