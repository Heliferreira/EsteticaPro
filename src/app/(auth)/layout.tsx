export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <p className="font-display text-4xl font-bold tracking-tight">Auto Point.Detail</p>
        <p className="muted text-sm">Gestão para estética automotiva</p>
      </div>
      <div className="card">{children}</div>
    </main>
  );
}
