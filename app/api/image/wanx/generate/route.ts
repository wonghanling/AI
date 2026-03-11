import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;
const COST_CREDITS = 10;

// 将 base64 图片上传到 Supabase Storage，返回公开 URL
async function toPublicUrl(base64: string): Promise<string> {
  if (!base64.startsWith('data:')) return base64;
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('无效的图片格式');
  const mimeType = match[1];
  const ext = mimeType.split('/')[1] || 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const filename = `wanx-inputs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`上传图片失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });

    // 2. 解析请求体
    const body = await req.json();
    const { prompt, images } = body; // images: string[] (base64, 1-3张)

    if (!prompt || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '缺少必要参数（prompt 和 images）' }, { status: 400 });
    }
    if (images.length > 3) {
      return NextResponse.json({ error: '最多上传 3 张图片' }, { status: 400 });
    }

    // 3. 检查积分
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('image_credits')
      .eq('id', user.id)
      .single();

    const imageCredits = userData?.image_credits || 0;
    if (imageCredits < COST_CREDITS) {
      return NextResponse.json(
        { error: `积分不足，需要 ${COST_CREDITS} 积分，当前仅有 ${imageCredits} 积分` },
        { status: 403 }
      );
    }

    // 4. 上传图片到 Storage，获取公开 URL
    const imageUrls: string[] = [];
    for (const img of images) {
      const url = await toPublicUrl(img);
      imageUrls.push(url);
    }

    // 5. 提交 DashScope 任务
    const dsRes = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: 'wan2.5-i2i-preview',
          input: {
            prompt,
            image_list: imageUrls.map(url => ({ image_url: url })),
          },
          parameters: {
            prompt_extend: true,
          },
        }),
      }
    );

    if (!dsRes.ok) {
      const err = await dsRes.text();
      throw new Error(`DashScope 提交失败: ${err}`);
    }

    const dsData = await dsRes.json();
    const taskId = dsData.output?.task_id;
    if (!taskId) throw new Error(`DashScope 未返回 task_id: ${JSON.stringify(dsData)}`);

    // 6. 扣除积分
    await supabaseAdmin
      .from('users')
      .update({ image_credits: imageCredits - COST_CREDITS })
      .eq('id', user.id);

    // 7. 写入数据库记录
    const { data: record } = await supabaseAdmin
      .from('image_generations')
      .insert({
        user_id: user.id,
        model: 'wan2.5-i2i',
        prompt,
        image_url: null,
        size: 'wanx',
        cost_credits: COST_CREDITS,
        status: 'processing',
        api_source: 'wanx',
        metadata: { task_id: taskId, endpoint: 'dashscope:wan2.5-i2i-preview' },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      taskId,
      recordId: record?.id,
      remainingBalance: imageCredits - COST_CREDITS,
    });

  } catch (error: any) {
    console.error('Wanx 图片生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
