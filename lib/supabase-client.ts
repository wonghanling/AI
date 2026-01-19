// Supabase 客户端工具
import { createClient } from '@supabase/supabase-js';

export const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase 环境变量未配置');
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// 获取当前用户 session
export const getSession = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// 获取当前用户
export const getCurrentUser = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// 登出
export const signOut = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await supabase.auth.signOut();
  localStorage.removeItem('supabase_token');
};
