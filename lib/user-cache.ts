// 用户状态缓存管理
interface UserCache {
  user: any;
  email: string | null;
  timestamp: number;
}

const USER_CACHE_KEY = 'user_state_cache';
const USER_CACHE_DURATION = 60000; // 1分钟缓存

export function getCachedUser(): UserCache | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (!cached) return null;

    const data: UserCache = JSON.parse(cached);
    const now = Date.now();

    // 检查缓存是否过期
    if (now - data.timestamp > USER_CACHE_DURATION) {
      localStorage.removeItem(USER_CACHE_KEY);
      return null;
    }

    return data;
  } catch (err) {
    console.error('读取用户缓存失败:', err);
    return null;
  }
}

export function setCachedUser(user: any): void {
  if (typeof window === 'undefined') return;

  try {
    const data: UserCache = {
      user: user,
      email: user?.email || null,
      timestamp: Date.now()
    };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('保存用户缓存失败:', err);
  }
}

export function clearCachedUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_CACHE_KEY);
}
