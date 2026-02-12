import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端（使用 service role key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
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

    // 2. 获取要删除的图片 ID
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get('id');

    if (!imageId) {
      return NextResponse.json({ error: '缺少图片 ID' }, { status: 400 });
    }

    // 3. 验证图片所有权并删除
    const { error: deleteError } = await supabaseAdmin
      .from('image_generations')
      .delete()
      .eq('id', imageId)
      .eq('user_id', user.id); // 确保只能删除自己的图片

    if (deleteError) {
      console.error('删除图片失败:', deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: '图片删除成功'
    });
  } catch (error: any) {
    console.error('Image delete API error:', error);
    return NextResponse.json(
      { error: error.message || '删除失败' },
      { status: 500 }
    );
  }
}
