import type { Metadata } from 'next';
import Sidebar, { type NavSection } from '@/components/admin/Sidebar';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dashboard · Invitations', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isSuper = user.role === 'super';
  const sections: NavSection[] = [
    {
      items: [
        { href: '/dashboard', label: 'Overview', icon: 'overview' },
        { href: '/dashboard/guests', label: 'Guests', icon: 'guests' },
        ...(isSuper ? [{ href: '/dashboard/upload', label: 'Upload list', icon: 'upload' as const }] : []),
      ],
    },
    {
      title: 'Manage',
      items: [
        ...(isSuper
          ? [
              { href: '/dashboard/team', label: 'Team', icon: 'team' as const },
              { href: '/dashboard/settings', label: 'Settings', icon: 'settings' as const },
            ]
          : []),
        { href: '/dashboard/account', label: 'My account', icon: 'account' },
      ],
    },
  ];
  return (
    <>
      <Sidebar sections={sections} username={user.username} role={user.role} />
      <div className="shell-main">
        <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">{children}</main>
      </div>
    </>
  );
}
