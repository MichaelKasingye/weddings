'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon, { type IconName } from './Icon';
import { logoutAction } from '@/app/(admin)/auth-actions';

export type NavItem = { href: string; label: string; icon: IconName };
export type NavSection = { title?: string; items: NavItem[] };

function Logo() {
  return (
    <a href="/dashboard" className="flex items-center gap-2.5 min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/icons/favicon.svg" alt="" width={24} height={24} className="rounded-md flex-none" />
      <span className="brand truncate">Aaron &amp; Josephine</span>
    </a>
  );
}

/** Fixed left sidebar on desktop; a slide-in menu (opened from the top bar) on phones and tablets. */
export default function Sidebar({ sections, username, role }: { sections: NavSection[]; username: string; role: 'super' | 'admin' }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => (href === '/dashboard' ? path === href : path.startsWith(href));

  return (
    <>
      {/* top bar (phones and tablets) */}
      <div className="topbar lg:hidden">
        <Logo />
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="sidebar">
          <Icon name="menu" size={18} />
        </button>
      </div>

      <aside id="sidebar" className={'sidebar' + (open ? ' is-open' : '')} aria-label="Dashboard">
        <div className="flex items-center justify-between h-14 px-4">
          <Logo />
          <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="close" size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((s, i) => (
            <div key={i}>
              {s.title ? <p className="nav-section">{s.title}</p> : <div className="h-2" />}
              <ul className="space-y-0.5">
                {s.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="nav-link" aria-current={isActive(it.href) ? 'page' : undefined}>
                      <Icon name={it.icon} />
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="nav-section">Invitation</p>
          <a href="/" target="_blank" rel="noopener" className="nav-link">
            <Icon name="external" />
            Open the site
          </a>
        </nav>

        <div className="border-t p-3" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3 px-2 py-1.5">
            <span className="grid place-items-center w-7 h-7 rounded-full text-xs font-semibold flex-none" style={{ background: 'var(--active)', boxShadow: 'inset 0 0 0 1px var(--line-strong)' }} aria-hidden="true">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{username}</p>
              <p className="text-xs subtle">{role === 'super' ? 'Super admin' : 'Admin'}</p>
            </div>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm px-2" type="submit" aria-label="Log out" title="Log out">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
    </>
  );
}
