/** The centred card used by the login, setup and join pages. */
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/icons/favicon.svg" alt="" width={40} height={40} className="rounded-lg mb-5" />
          <h1>{title}</h1>
          {subtitle && <div className="muted mt-2 text-[14px]">{subtitle}</div>}
        </div>
        {children}
        <p className="subtle text-xs text-center mt-8">Aaron &amp; Josephine · Invitations</p>
      </div>
    </main>
  );
}
