'use client';

import { useEffect, useRef, useState } from 'react';
import { CarScene, VIEWS, type PartInfo } from '@/lib/car3d/scene';
import type { BodyType } from '@/types/db';

interface Props {
  bodyType: BodyType;
  paint: string;
  marks: Record<string, string>;
  selected: string | null;
  onSelect: (partId: string | null) => void;
  onParts?: (parts: PartInfo[]) => void;
}

/** Canvas 3D do veículo: gira, dá zoom e permite clicar nas peças. */
export function VistoriaViewer({ bodyType, paint, marks, selected, onSelect, onParts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CarScene | null>(null);
  const namesRef = useRef<Record<string, string>>({});
  const cbRef = useRef({ onSelect, onParts });
  cbRef.current = { onSelect, onParts };
  const [tip, setTip] = useState<{ name: string; x: number; y: number } | null>(null);
  const [auto, setAuto] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: CarScene;
    try {
      scene = new CarScene(canvas, {
        onSelect: (id) => cbRef.current.onSelect(id),
        onHover: (id, x, y) => {
          const r = canvas.getBoundingClientRect();
          setTip(id && namesRef.current[id] ? { name: namesRef.current[id], x: x - r.left, y: y - r.top } : null);
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.setBodyType(bodyType);
    const parts = s.getParts();
    namesRef.current = Object.fromEntries(parts.map((p) => [p.id, p.name]));
    cbRef.current.onParts?.(parts);
    s.setPaint(paint);
    s.setMarks(marks);
    s.setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyType]);

  useEffect(() => { sceneRef.current?.setPaint(paint); }, [paint]);
  useEffect(() => { sceneRef.current?.setMarks(marks); }, [marks]);
  useEffect(() => { sceneRef.current?.setSelected(selected); }, [selected]);
  useEffect(() => { sceneRef.current?.setAutoRotate(auto); }, [auto]);

  if (failed) {
    return (
      <div className="card muted flex h-80 items-center justify-center text-center text-sm">
        Não foi possível iniciar o 3D neste navegador (WebGL indisponível).
      </div>
    );
  }

  return (
    <div className="relative h-[360px] overflow-hidden rounded-3xl sm:h-[460px]"
         style={{ background: 'radial-gradient(ellipse at 50% 35%, #46464b, var(--surface))' }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className="btn-ghost !px-2 !py-1 text-xs"
                  style={{ background: 'var(--surface)' }} onClick={() => sceneRef.current?.goView(v)}>
            {v.label}
          </button>
        ))}
        <button type="button" className="btn-ghost !px-2 !py-1 text-xs" aria-pressed={auto}
                style={{ background: auto ? 'var(--accent)' : 'var(--surface)', color: auto ? 'var(--accent-ink)' : undefined }}
                onClick={() => setAuto((a) => !a)}>
          Girar
        </button>
      </div>
      {tip && (
        <div className="pointer-events-none absolute z-10 rounded px-2 py-1 text-xs font-semibold"
             style={{ left: tip.x + 12, top: tip.y + 12, background: 'var(--ink)', color: 'var(--bg)' }}>
          {tip.name}
        </div>
      )}
    </div>
  );
}
