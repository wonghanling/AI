// Supabase 客户端工具（单例模式）
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 单例实例
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  // 如果已经有实例，直接返回
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase 环境变量未配置');
    return null;
  }

  // 创建并缓存实例
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return supabaseInstance;
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
