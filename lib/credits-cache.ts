// 积分缓存管理
interface CreditsCache {
  imageCredits: number;
  videoCredits: number;
  timestamp: number;
}

const CACHE_KEY = 'user_credits_cache';
const CACHE_DURATION = 30000; // 30秒缓存

export function getCachedCredits(): CreditsCache | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CreditsCache = JSON.parse(cached);
    const now = Date.now();

    // 检查缓存是否过期
    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch (err) {
    console.error('读取积分缓存失败:', err);
    return null;
  }
}

export function setCachedCredits(imageCredits: number, videoCredits: number): void {
  if (typeof window === 'undefined') return;

  try {
    const data: CreditsCache = {
      imageCredits,
      videoCredits,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('保存积分缓存失败:', err);
  }
}

export function clearCachedCredits(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
}
