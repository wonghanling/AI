'use client';

import { useEffect } from 'react';
import { initGlobalSessionManager } from '@/lib/global-session-manager';

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // 只在应用启动时初始化一次
    initGlobalSessionManager();
  }, []);

  return <>{children}</>;
}
