'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { logout } from '@/lib/api';
import { PAGE_TITLES, navForRole, pathAllowed, GraduationCap } from '@/lib/nav';
import type { SessionPayload } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { LoadingState } from './ui/alert';

export function AppShell({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () => navForRole(session.role, session.enabledModules),
    [session.role, session.enabledModules],
  );
  const allowed = pathAllowed(session.role, session.enabledModules, pathname);
  const title = PAGE_TITLES[pathname] ?? 'School ERP';

  useEffect(() => {
    const home = items[0]?.href;
    if (!allowed && home && home !== pathname) router.replace(home);
  }, [allowed, items, pathname, router]);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-slate-950 text-slate-100 transition print:hidden lg:static lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
            <GraduationCap className="h-5 w-5 text-brand-300" />
            <div>
              <div className="text-sm font-semibold tracking-wide">BharatVidya ERP</div>
              <div className="text-[11px] text-slate-400">India School Operations</div>
            </div>
            <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-1 p-3">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                    active ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3">
            <div className="mb-2 truncate px-1 text-xs text-slate-400">{session.user.email}</div>
            <Button variant="outline" className="w-full border-slate-600 bg-transparent text-slate-100 hover:bg-white/10" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {open ? (
          <button
            className="fixed inset-0 z-30 bg-slate-950/40 print:hidden lg:hidden"
            aria-label="Close overlay"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur print:static print:border-0">
            <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge tone="indigo">{session.role.replaceAll('_', ' ')}</Badge>
              <span className="hidden text-sm text-slate-600 sm:inline">{session.user.name}</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 print:p-0">
            {allowed ? children : <LoadingState label="Opening your home…" />}
          </main>
        </div>
      </div>
    </div>
  );
}
