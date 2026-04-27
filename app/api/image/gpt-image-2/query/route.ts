import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fal } from '@fal-ai/client';

export const maxDuration = 300;

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
    const prompt = searchParams.get('prompt') || '';
    const quality = searchParams.get('quality') || 'high';
    const sizeKey = searchParams.get('sizeKey') || 'square_2k';
    const cost = parseInt(searchParams.get('cost') || '10');

    if (!requestId) {
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

      // 如果有 recordId 就 update，否则直接 insert 新记录
      if (recordId) {
        await supabaseAdmin
          .from('image_generations')
          .update({ image_url: img.url, status: 'completed' })
          .eq('id', recordId)
          .eq('user_id', user.id);
      } else {
        await supabaseAdmin
          .from('image_generations')
          .insert({
            user_id: user.id,
            model: 'gpt-image-2',
            prompt,
            image_url: img.url,
            size: `${quality}-${sizeKey}`,
            cost_credits: cost,
            status: 'completed',
            api_source: 'gpt-image-2',
            created_at: new Date().toISOString(),
          });
      }

      return NextResponse.json({ status: 'completed', imageUrl: img.url });
    }

    if (statusStr === 'FAILED') {
      if (recordId) {
        await supabaseAdmin
          .from('image_generations')
          .update({ status: 'failed' })
          .eq('id', recordId)
          .eq('user_id', user.id);
      }
      return NextResponse.json({ status: 'failed', error: '生成失败' });
    }

    // IN_QUEUE 或 IN_PROGRESS
    return NextResponse.json({ status: 'pending' });

  } catch (error: any) {
    console.error('GPT Image 2 查询错误:', error);
    const msg = error?.message || error?.body?.detail || JSON.stringify(error) || '查询失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
