'use client';

import { useState } from 'react';
import { reopenReport } from '../actions';

/** "Reabrir" pede uma segunda confirmação antes de destravar as OS. */
export function ReopenButton({ reportId }: { reportId: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>Reabrir</button>;
  return (
    <form action={reopenReport} className="inline">
      <input type="hidden" name="id" value={reportId} />
      <button className="btn-danger">Confirmar reabertura</button>
    </form>
  );
}
