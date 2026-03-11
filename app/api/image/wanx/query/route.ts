import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;

// 下载图片并上传到 Supabase Storage
async function uploadToStorage(userId: string, imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('下载图片失败');
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/png';
  const ext = contentType.split('/')[1]?.split(';')[0] || 'png';
  const filename = `wanx-outputs/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType, upsert: false });
  if (error) throw new Error(`上传结果图片失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

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

    if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

    // 查询 DashScope 任务状态
    const res = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { 'Authorization': `Bearer ${DASHSCOPE_API_KEY}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ status: 'failed', progress: 0 });
    }

    const data = await res.json();
    const taskStatus = data?.output?.task_status;

    let status = 'processing';
    let progress = 30;
    let imageUrl: string | null = null;

    if (taskStatus === 'SUCCEEDED') {
      const rawUrl = data?.output?.results?.[0]?.url || data?.output?.output_image_url || null;
      if (rawUrl) {
        try {
          imageUrl = await uploadToStorage(user.id, rawUrl);
        } catch {
          imageUrl = rawUrl;
        }
      }
      status = imageUrl ? 'completed' : 'failed';
      progress = imageUrl ? 100 : 0;
    } else if (taskStatus === 'PENDING') {
      status = 'pending'; progress = 10;
    } else if (taskStatus === 'RUNNING') {
      status = 'processing'; progress = 50;
    } else {
      status = 'failed'; progress = 0;
    }

    // 更新数据库记录
    if (recordId) {
      const updateData: any = { status, metadata: { task_id: taskId, endpoint: 'dashscope:wan2.5-i2i-preview' } };
      if (imageUrl) {
        updateData.image_url = imageUrl;
        updateData.completed_at = new Date().toISOString();
      }
      await supabaseAdmin
        .from('image_generations')
        .update(updateData)
        .eq('id', recordId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true, taskId, status, progress, imageUrl });

  } catch (error: any) {
    console.error('Wanx 查询错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
