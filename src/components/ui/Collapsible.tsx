/**
 * Bloco recolhível (dropdown) baseado em <details>.
 * O conteúdo continua montado mesmo fechado: campos de formulário mantêm o que foi digitado
 * e continuam sendo enviados no submit.
 */
export function Collapsible({
  title, hint, badge, defaultOpen = false, variant = 'card', className = '', children,
}: {
  title: string;
  /** Texto pequeno abaixo do título (aparece mesmo fechado). */
  hint?: string;
  /** Resumo curto à direita do título (ex.: "2 aplicados"), visível com o bloco fechado. */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'card' | 'inset';
  className?: string;
  children: React.ReactNode;
}) {
  const box = variant === 'card' ? 'card' : 'rounded-2xl p-4';
  return (
    <details open={defaultOpen} className={`group ${box} ${className}`}
             style={variant === 'inset' ? { background: 'var(--surface-2)' } : undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          {variant === 'card'
            ? <h2 className="font-display text-xl font-bold">{title}</h2>
            : <span className="font-medium">{title}</span>}
          {hint && <p className="muted mt-0.5 text-sm">{hint}</p>}
        </div>
        {badge && <span className="badge shrink-0">{badge}</span>}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
             className="shrink-0 transition-transform duration-200 group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}