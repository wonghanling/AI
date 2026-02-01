// 会话管理器 - 自动刷新会话，防止过期
import { getSupabaseClient } from './supabase-client';

const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新一次
const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // 30秒检查一次活动
let refreshTimer: NodeJS.Timeout | null = null;
let activityTimer: NodeJS.Timeout | null = null;
let lastActivity = Date.now();
let isRunning = false; // 防止重复启动

// 记录用户活动（使用节流）
let activityThrottle: NodeJS.Timeout | null = null;
export function recordActivity() {
  if (activityThrottle) return;

  lastActivity = Date.now();

  // 节流：1秒内只记录一次
  activityThrottle = setTimeout(() => {
    activityThrottle = null;
  }, 1000);
}

// 启动会话管理器
export function startSessionManager() {
  if (typeof window === 'undefined') return;

  // 防止重复启动
  if (isRunning) {
    console.log('⚠️ 会话管理器已在运行');
    return;
  }

  isRunning = true;

  // 只监听关键事件，移除 scroll
  const events = ['mousedown', 'keydown', 'touchstart'];
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
  if (!isRunning) return;

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (activityTimer) {
    clearInterval(activityTimer);
    activityTimer = null;
  }
  if (activityThrottle) {
    clearTimeout(activityThrottle);
    activityThrottle = null;
  }

  const events = ['mousedown', 'keydown', 'touchstart'];
  events.forEach(event => {
    window.removeEventListener(event, recordActivity);
  });

  isRunning = false;
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
