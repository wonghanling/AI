import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }

    // 2. 获取查询参数
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const apiSource = searchParams.get('source'); // 新增：按来源筛选

    // 3. 查询图片生成历史
    let query = supabaseAdmin
      .from('image_generations')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // 如果指定了来源，则筛选
    if (apiSource) {
      query = query.eq('api_source', apiSource);
    }

    const { data: images, error: queryError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({
      images: images || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Image history API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
