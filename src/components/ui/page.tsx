import Link from 'next/link';

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="muted text-sm">{subtitle}</p>}
      </div>
      {action && <Link href={action.href} className="btn">{action.label}</Link>}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-2xl px-4 py-3 text-sm"
       style={{ background: 'color-mix(in srgb, var(--danger) 16%, transparent)', color: 'var(--danger)' }}>
      {message}
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card muted text-center text-sm">{children}</div>;
}
