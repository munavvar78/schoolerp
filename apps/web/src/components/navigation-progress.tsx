'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  beginNavigationLoading,
  isNavigationLoading,
  subscribeNavigationLoading,
} from '@/lib/navigation-loading';
import { cn } from '@/lib/utils';

function useNavigationLoadingVisible() {
  return useSyncExternalStore(
    subscribeNavigationLoading,
    isNavigationLoading,
    () => false,
  );
}

/** Watches App Router pathname and kicks the nav loader on each change. */
export function NavigationLoadingWatcher() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Soft: keep counts if a sidebar click already opened the transition.
    beginNavigationLoading({ restart: false });
  }, [pathname, mounted]);

  return null;
}

/** Slim top progress bar for in-app route + destination API loading. */
export function NavigationProgressBar() {
  const loading = useNavigationLoadingVisible();

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden"
      aria-hidden={!loading}
      role="progressbar"
      aria-valuetext={loading ? 'Loading page' : undefined}
    >
      <div
        className={cn(
          'h-full w-1/2 rounded-r-full bg-slate-700',
          loading ? 'animate-nav-progress opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

export function useIsNavigationLoading() {
  return useNavigationLoadingVisible();
}
