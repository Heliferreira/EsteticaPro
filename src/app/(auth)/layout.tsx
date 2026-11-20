import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="font-display text-4xl font-bold tracking-tight">Auto Point.Detail</p>
        <p className="muted text-sm">Gestão para estética automotiva</p>
      </div>
      <div className="card">{children}</div>
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="muted text-xs">Desenvolvido por</p>
        <Image src="/logo.png" alt="Logo do desenvolvedor" width={320} height={120} unoptimized className="h-auto w-40" />
      </div>
    </main>
  );
}