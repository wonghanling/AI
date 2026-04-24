import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

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
    const statusStr = status.status as string;

    if (statusStr === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      const img = (result.data as any)?.images?.[0];
      if (!img?.url) {
        return NextResponse.json({ status: 'failed', error: '未能获取图片' });
      }

      // 直接用 fal 原始 URL 写入数据库，不做 Storage 上传（避免超时）
      await supabaseAdmin
        .from('image_generations')
        .update({ image_url: img.url, status: 'completed' })
        .eq('id', recordId)
        .eq('user_id', user.id);

      return NextResponse.json({ status: 'completed', imageUrl: img.url });
    }

    if (statusStr === 'FAILED') {
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
