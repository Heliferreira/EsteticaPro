'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';

const LINKS: Array<{ href: string; label: string; icon: IconName; manage?: boolean }> = [
  { href: '/dashboard', label: 'Painel', icon: 'home' },
  { href: '/os', label: 'Ordens de serviço', icon: 'clipboard' },
  { href: '/clientes', label: 'Clientes', icon: 'users' },
  { href: '/veiculos', label: 'Veículos', icon: 'car' },
  { href: '/servicos', label: 'Serviços', icon: 'wrench' },
  { href: '/estoque', label: 'Estoque', icon: 'box' },
  { href: '/equipe', label: 'Equipe', icon: 'team' },
  { href: '/parceiros', label: 'Parceiros', icon: 'handshake', manage: true },
  { href: '/relatorios', label: 'Relatórios', icon: 'report', manage: true },
  { href: '/conta', label: 'Minha conta', icon: 'user' },
];

/** Menu lateral em ícones (vira uma barra horizontal no celular). */
export function Sidebar({ initial, logout, canManage }: { initial: string; logout: () => Promise<void>; canManage: boolean }) {
  const path = usePathname();
  return (
    <aside className="flex items-center justify-between gap-3 md:flex-col md:justify-start md:py-1">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold"
           style={{ background: 'var(--ink)', color: 'var(--shell)' }} title="Vistoria 3D">V</div>
      <nav className="rail overflow-x-auto md:overflow-visible md:flex-1" aria-label="Principal">
        {LINKS.filter((l) => !l.manage || canManage).map((l) => {
          const active = path === l.href || path.startsWith(l.href + '/');
          return (
            <Link key={l.href} href={l.href} title={l.label} aria-label={l.label}
                  aria-current={active ? 'page' : undefined} className="rail-btn">
              <Icon name={l.icon} />
            </Link>
          );
        })}
      </nav>
      <form action={logout} className="rail !p-1.5">
        <button title="Sair" aria-label="Sair" className="rail-btn"><Icon name="logout" /></button>
        <span className="hidden h-11 w-11 items-center justify-center rounded-full text-sm font-semibold md:flex"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>{initial}</span>
      </form>
    </aside>
  );
}
