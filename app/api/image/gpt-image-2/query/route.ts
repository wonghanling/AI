import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';
import { uploadToStorage } from '@/lib/storage-upload';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('requestId');
    const recordId = searchParams.get('recordId');
    const endpoint = searchParams.get('endpoint') || 'openai/gpt-image-2';

    if (!requestId || !recordId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 查询 fal 队列状态
    const status = await fal.queue.status(endpoint, { requestId, logs: false });

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      const img = (result.data as any)?.images?.[0];
      if (!img?.url) {
        return NextResponse.json({ status: 'failed', error: '未能获取图片' });
      }

      // 上传到 Storage
      let permanentUrl = img.url;
      try {
        permanentUrl = await uploadToStorage(user.id, img.url, 'image');
      } catch {
        console.warn('上传 Storage 失败，使用原始 URL');
      }

      // 更新数据库记录
      await supabaseAdmin
        .from('image_generations')
        .update({ image_url: permanentUrl, status: 'completed' })
        .eq('id', recordId)
        .eq('user_id', user.id);

      return NextResponse.json({ status: 'completed', imageUrl: permanentUrl });
    }

    if (status.status === 'FAILED') {
      await supabaseAdmin
        .from('image_generations')
        .update({ status: 'failed' })
        .eq('id', recordId)
        .eq('user_id', user.id);

      return NextResponse.json({ status: 'failed', error: '生成失败' });
    }

    // IN_QUEUE 或 IN_PROGRESS
    return NextResponse.json({ status: 'pending' });

  } catch (error: any) {
    console.error('GPT Image 2 查询错误:', error);
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
