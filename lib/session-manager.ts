// 会话管理器 - 自动刷新会话，防止过期
import { getSupabaseClient } from './supabase-client';

const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新一次
const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // 30秒检查一次活动
let refreshTimer: NodeJS.Timeout | null = null;
let activityTimer: NodeJS.Timeout | null = null;
let lastActivity = Date.now();

// 记录用户活动
export function recordActivity() {
  lastActivity = Date.now();
}

// 启动会话管理器
export function startSessionManager() {
  if (typeof window === 'undefined') return;

  // 监听用户活动
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => {
    window.addEventListener(event, recordActivity, { passive: true });
  });

  // 定期刷新会话
  refreshTimer = setInterval(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session && !error) {
        // 会话存在，刷新token
        await supabase.auth.refreshSession();
        console.log('✅ 会话已刷新');
      }
    } catch (err) {
      console.error('❌ 刷新会话失败:', err);
    }
  }, SESSION_REFRESH_INTERVAL);

  // 检查用户活动状态
  activityTimer = setInterval(() => {
    const inactiveTime = Date.now() - lastActivity;
    if (inactiveTime > 30 * 60 * 1000) { // 30分钟无活动
      console.warn('⚠️ 用户长时间无活动，建议刷新页面');
    }
  }, ACTIVITY_CHECK_INTERVAL);

  console.log('✅ 会话管理器已启动');
}

// 停止会话管理器
export function stopSessionManager() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (activityTimer) {
    clearInterval(activityTimer);
    activityTimer = null;
  }

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => {
    window.removeEventListener(event, recordActivity);
  });

  console.log('✅ 会话管理器已停止');
}

// 检查会话是否有效
export async function checkSession(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    return !!(session && !error);
  } catch (err) {
    console.error('❌ 检查会话失败:', err);
    return false;
  }
}
