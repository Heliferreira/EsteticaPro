import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export function Header({ name, company }: { name: string; company: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xl font-semibold leading-tight">Olá, {name}!</p>
        <p className="muted text-sm">{company} · pronto para os serviços de hoje?</p>
      </div>
      <div className="flex items-center gap-2">
        <form action="/os" className="relative">
          <span className="muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"><Icon name="search" size={16} /></span>
          <input name="q" placeholder="Buscar placa ou cliente" className="input !rounded-full !pl-10 md:w-64" aria-label="Buscar OS por placa ou cliente" />
        </form>
        <Link href="/os/nova" className="btn" style={{ background: 'var(--blue)', color: '#fff' }}>Nova OS</Link>
      </div>
    </header>
  );
}
