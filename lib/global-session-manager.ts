// 全局会话管理器 - 单例模式，确保只启动一次
import { getSupabaseClient } from './supabase-client';

const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新一次
let refreshTimer: NodeJS.Timeout | null = null;
let lastActivity = Date.now();
let isInitialized = false;

// 记录用户活动（使用节流）
let activityThrottle: NodeJS.Timeout | null = null;
function recordActivity() {
  if (activityThrottle) return;

  lastActivity = Date.now();

  // 节流：1秒内只记录一次
  activityThrottle = setTimeout(() => {
    activityThrottle = null;
  }, 1000);
}

// 初始化全局会话管理器（只在应用启动时调用一次）
export function initGlobalSessionManager() {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;

  isInitialized = true;

  // 只监听关键事件
  const events = ['mousedown', 'keydown', 'touchstart'];
  events.forEach(event => {
    window.addEventListener(event, recordActivity, { passive: true, capture: true });
  });

  // 定期刷新会话
  refreshTimer = setInterval(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // 检查用户是否活跃（10分钟内有活动）
    const inactiveTime = Date.now() - lastActivity;
    if (inactiveTime > 10 * 60 * 1000) {
      return; // 用户不活跃，不刷新会话
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session && !error) {
        await supabase.auth.refreshSession();
      }
    } catch (err) {
      // 静默失败，不影响用户体验
    }
  }, SESSION_REFRESH_INTERVAL);
}

// 清理会话管理器
export function cleanupGlobalSessionManager() {
  if (!isInitialized) return;

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (activityThrottle) {
    clearTimeout(activityThrottle);
    activityThrottle = null;
  }

  const events = ['mousedown', 'keydown', 'touchstart'];
  events.forEach(event => {
    window.removeEventListener(event, recordActivity);
  });

  isInitialized = false;
}
