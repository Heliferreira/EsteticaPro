import * as THREE from 'three';
import type { BodyType } from '@/types/db';
import { CAR_SPECS, type CarSpec } from './specs';
import { buildBody, type PartMat } from './body';
import { markStatusInfo } from './marks';

export interface PartInfo { id: string; name: string }
export interface SceneCallbacks {
  onSelect?: (partId: string | null) => void;
  onHover?: (partId: string | null, x: number, y: number) => void;
}
export type ViewName = 'iso' | 'front' | 'right' | 'back' | 'left' | 'top';

export const VIEWS: Array<{ id: ViewName; label: string; phi: number; theta: number | null }> = [
  { id: 'iso',   label: '3/4',      phi: 1.22, theta: 0.85 },
  { id: 'front', label: 'Frente',   phi: 1.35, theta: Math.PI / 2 },
  { id: 'right', label: 'Lado dir.', phi: 1.35, theta: 0 },
  { id: 'back',  label: 'Traseira', phi: 1.35, theta: -Math.PI / 2 },
  { id: 'left',  label: 'Lado esq.', phi: 1.35, theta: Math.PI },
  { id: 'top',   label: 'Topo',     phi: 0.12, theta: null },
];

interface Slot { mat: THREE.Material & { color: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number }; base: THREE.Color; em: THREE.Color | null; emI: number }
interface MeshData { part?: string; slots: Slot[]; paint: boolean }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Cores hex (sRGB) → THREE.Color já convertida pelo ColorManagement do three. */
const C = (hex: string) => new THREE.Color(hex);

function polyShape(pts: number[][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export class CarScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);
  private target = new THREE.Vector3(0, 0.62, 0);
  private group: THREE.Group | null = null;
  private parts: Record<string, { name: string; meshes: THREE.Mesh[] }> = {};
  private carMeshes: THREE.Mesh[] = [];
  private bodyType: BodyType = 'sedan';
  private paint = '#b3121c';
  private marks: Record<string, string> = {};
  private selected: string | null = null;
  private hover: string | null = null;
  private cam = { theta: 0.85, phi: 1.22, r: 7, tt: 0.85, tp: 1.22, tr: 7, auto: false };
  private dragging = false;
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private cleanup: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement, private cb: SceneCallbacks = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.makeEnvironment();
    this.makeLights();
    this.makeFloor();
    this.bindPointer();

    const parent = canvas.parentElement ?? canvas;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(parent);
    this.resize();
    this.buildCar();
    this.cam.theta = this.cam.tt; this.cam.phi = this.cam.tp; this.cam.r = this.cam.tr;

    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.updateCamera();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  /* ------------------------------ API pública ------------------------------ */

  setBodyType(t: BodyType) {
    if (t === this.bodyType && this.group) return;
    this.bodyType = t;
    this.selected = null; this.hover = null;
    this.buildCar();
    this.goView(VIEWS[0]);
  }

  setPaint(hex: string) {
    this.paint = hex;
    this.carMeshes.forEach((m) => {
      const d = m.userData as MeshData;
      if (d.paint) d.slots.forEach((sl) => sl.base.copy(C(hex)));
    });
    this.paintAll();
  }

  setMarks(marks: Record<string, string>) {
    this.marks = marks;
    this.paintAll();
  }

  setSelected(id: string | null) {
    const prev = this.selected;
    this.selected = id;
    if (prev) this.paintPart(prev);
    if (id) this.paintPart(id);
  }

  getParts(): PartInfo[] {
    return Object.entries(this.parts).map(([id, p]) => ({ id, name: p.name }));
  }

  setAutoRotate(on: boolean) { this.cam.auto = on; }

  goView(v: (typeof VIEWS)[number]) {
    if (v.theta !== null) this.cam.tt = this.cam.theta + wrapPi(v.theta - this.cam.theta);
    this.cam.tp = v.phi;
    this.cam.tr = this.fitRadius() * (v.id === 'top' ? 0.95 : 1);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.cleanup.forEach((f) => f());
    this.disposeCar();
    this.scene.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) [m.material].flat().forEach((x) => x.dispose());
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }

  /* ------------------------------- ambiente -------------------------------- */

  private makeEnvironment() {
    const s = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
    );
    const pos = sky.geometry.attributes.position;
    const col: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) / 50 + 1) / 2;
      col.push(lerp(0.1, 0.72, t), lerp(0.11, 0.78, t), lerp(0.13, 0.88, t));
    }
    sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(sky);
    const panel = (w: number, h: number, x: number, y: number, z: number, v: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), side: THREE.DoubleSide }),
      );
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    panel(22, 7, 0, 24, 0, 3.2); panel(8, 12, -26, 8, 10, 2.2); panel(8, 12, 26, 8, -10, 2.2);
    panel(16, 5, 0, 10, -30, 2.6); panel(10, 6, 20, 6, 22, 1.6);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(s, 0.03);
    this.scene.environment = rt.texture;
    pm.dispose();
    s.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) [m.material].flat().forEach((x) => x.dispose());
    });
  }

  private makeLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 24 });
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private makeFloor() {
    const recv = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.26 }));
    recv.rotation.x = -Math.PI / 2; recv.receiveShadow = true;
    this.scene.add(recv);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.004; blob.scale.set(7.4, 4.2, 1);
    this.scene.add(blob);
    [3.7, 5.2].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.018, 120),
        new THREE.MeshBasicMaterial({ color: 0x8a929c, transparent: true, opacity: i ? 0.18 : 0.34, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
      this.scene.add(ring);
    });
  }

  /* -------------------------------- materiais ------------------------------ */

  private mat(kind: PartMat | 'tire' | 'rim'): THREE.Material {
    const mk = <T extends THREE.MeshStandardMaterial>(m: T, hex: string, em?: string): T => {
      m.color.copy(C(hex));
      if (em) m.emissive.copy(C(em));
      return m;
    };
    switch (kind) {
      case 'paint': return mk(new THREE.MeshPhysicalMaterial({ metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }), this.paint);
      case 'glass': return mk(new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.62 }), '#18232e');
      case 'floor': return mk(new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.8 }), '#25282d');
      case 'head':  return mk(new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.15, emissiveIntensity: 0.35 }), '#dfe9f3', '#2a4660');
      case 'tail':  return mk(new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.25, emissiveIntensity: 0.5 }), '#b3141c', '#4a0508');
      case 'tire':  return mk(new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.92 }), '#121315');
      case 'rim':   return mk(new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.22 }), '#cfd4da');
      default:      return mk(new THREE.MeshStandardMaterial({ metalness: 0.2, roughness: 0.5 }), '#1b1d21');
    }
  }

  /* --------------------------------- carro --------------------------------- */

  private addMesh(mesh: THREE.Mesh, id?: string | null, name?: string | null, opts: { paint?: boolean; noShadow?: boolean } = {}) {
    const d: MeshData = { slots: [], paint: !!opts.paint };
    if (id) {
      d.part = id;
      (this.parts[id] ??= { name: name ?? id, meshes: [] }).meshes.push(mesh);
    }
    d.slots = ([mesh.material].flat() as Slot['mat'][]).map((mat) => ({
      mat, base: mat.color.clone(), em: mat.emissive ? mat.emissive.clone() : null, emI: mat.emissiveIntensity ?? 0,
    }));
    mesh.userData = d as unknown as Record<string, unknown>;
    mesh.castShadow = !opts.noShadow;
    this.group!.add(mesh);
    this.carMeshes.push(mesh);
    return mesh;
  }

  private disposeCar() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) [m.material].flat().forEach((x) => x.dispose());
    });
    this.group = null;
  }

  private buildCar() {
    const T: CarSpec = CAR_SPECS[this.bodyType];
    this.disposeCar();
    this.group = new THREE.Group();
    this.parts = {}; this.carMeshes = [];
    const { L, W, wb, R, belt, roofY } = T;
    const ra = R + 0.07, cwH = (W * 0.82) / 2, xA = wb / 2 - ra - 0.05 - 0.02;

    const B = buildBody(T);
    const posAttr = new THREE.Float32BufferAttribute(B.pos, 3);
    const full = new THREE.BufferGeometry();
    full.setAttribute('position', posAttr);
    full.setIndex(B.all);
    full.computeVertexNormals();
    const norAttr = full.attributes.normal;
    Object.values(B.groups).forEach((g) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', posAttr);
      geo.setAttribute('normal', norAttr);
      geo.setIndex(g.idx);
      this.addMesh(new THREE.Mesh(geo, this.mat(g.mat)), g.id, g.name, { paint: g.mat === 'paint', noShadow: g.mat === 'glass' });
    });
    full.dispose();

    const seamMat = new THREE.LineBasicMaterial({ color: 0x07080a, transparent: true, opacity: 0.5 });
    B.seams.forEach((line) => {
      const arr: number[] = [];
      line.forEach((vi) => {
        arr.push(
          B.pos[vi * 3] + norAttr.getX(vi) * 0.004,
          B.pos[vi * 3 + 1] + norAttr.getY(vi) * 0.004,
          B.pos[vi * 3 + 2] + norAttr.getZ(vi) * 0.004,
        );
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.group!.add(new THREE.Line(lg, seamMat));
    });

    const under = new THREE.Mesh(new THREE.BoxGeometry(L - 0.5, 0.05, W - 0.35), this.mat('trim'));
    under.position.set(0, 0.31, 0);
    this.addMesh(under);
    const ints = polyShape([[xA - 0.05, belt - 0.25], [T.xRF + 0.05, roofY - 0.14], [T.xRR - 0.05, roofY - 0.14], [T.R2[0] + 0.05, belt - 0.25]]);
    const ig = new THREE.ExtrudeGeometry(ints, { depth: cwH * 2 - 0.3, bevelEnabled: false });
    ig.translate(0, 0, -(cwH * 2 - 0.3) / 2);
    this.addMesh(new THREE.Mesh(ig, this.mat('trim')));

    if (T.rails) {
      [-1, 1].forEach((s) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(T.xRF - T.xRR - 0.3, 0.035, 0.035), this.mat('trim'));
        rail.position.set((T.xRF + T.xRR) / 2, roofY + 0.01, s * (cwH - 0.14));
        this.addMesh(rail);
      });
    }

    [-1, 1].forEach((s) => {
      const sk = s < 0 ? 'L' : 'R', sn = s < 0 ? 'esq.' : 'dir.';
      const mm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.mat('paint'));
      mm.scale.set(0.075, 0.05, 0.11);
      this.addMesh(mm, 'mirror' + sk, 'Retrovisor ' + sn, { paint: true }).position.set(xA - 0.06, belt + 0.03, s * (W / 2 + 0.03));
      ([[wb / 2, 'F', 'diant.'], [-wb / 2, 'R', 'tras.']] as const).forEach(([wx, wk, wn]) => {
        const id = 'wheel' + wk + sk, name = 'Roda ' + wn + ' ' + sn, zc = s * (W / 2 - 0.17);
        const tg = new THREE.CylinderGeometry(R, R, 0.24, 32); tg.rotateX(Math.PI / 2);
        this.addMesh(new THREE.Mesh(tg, this.mat('tire')), id, name).position.set(wx, R, zc);
        const rg = new THREE.CylinderGeometry(R * 0.64, R * 0.64, 0.25, 28); rg.rotateX(Math.PI / 2);
        this.addMesh(new THREE.Mesh(rg, this.mat('rim')), id, name).position.set(wx, R, zc);
        for (let k = 0; k < 5; k++) {
          const sp = new THREE.Mesh(new THREE.BoxGeometry(R * 1.12, 0.05, 0.03), this.mat('rim'));
          sp.position.set(wx, R, zc + s * 0.125);
          sp.rotation.z = (k * Math.PI) / 5 + (wx > 0 ? 0.3 : 0);
          this.addMesh(sp, id, name);
        }
        const hg = new THREE.CylinderGeometry(R * 0.15, R * 0.15, 0.06, 16); hg.rotateX(Math.PI / 2);
        this.addMesh(new THREE.Mesh(hg, this.mat('tire')), id, name).position.set(wx, R, zc + s * 0.13);
        const lg = new THREE.CylinderGeometry(ra, ra, 0.42, 28, 1, true, Math.PI / 2, Math.PI); lg.rotateX(Math.PI / 2);
        const lm = this.mat('trim'); lm.side = THREE.DoubleSide;
        this.addMesh(new THREE.Mesh(lg, lm), null, null, { noShadow: true }).position.set(wx, R, s * (W / 2 - 0.22));
      });
    });

    this.scene.add(this.group);
    this.paintAll();
  }

  private paintAll() { Object.keys(this.parts).forEach((id) => this.paintPart(id)); }

  private paintPart(id: string) {
    const p = this.parts[id];
    if (!p) return;
    const status = this.marks[id];
    const info = status ? markStatusInfo(status) : null;
    const tint = info?.color ? C(info.color) : null;
    const hl = this.selected === id ? 0.55 : this.hover === id ? 0.28 : 0;
    p.meshes.forEach((m) => {
      (m.userData as MeshData).slots.forEach((sl) => {
        const c = sl.base.clone();
        if (tint) c.lerp(tint, 0.68);
        sl.mat.color.copy(c);
        if (!sl.mat.emissive) return;
        if (hl) { sl.mat.emissive.copy(C('#2f7bff')); sl.mat.emissiveIntensity = hl; }
        else if (sl.em) { sl.mat.emissive.copy(sl.em); sl.mat.emissiveIntensity = sl.emI; }
      });
    });
  }

  /* --------------------------------- câmera -------------------------------- */

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth), h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cam.tr = this.fitRadius();
  }

  private fitRadius(): number {
    const T = CAR_SPECS[this.bodyType];
    const vf = (this.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const rh = (T.L * 0.78) / Math.tan(hf / 2);
    const rv = (T.roofY + 1.4) / (2 * Math.tan(vf / 2));
    return Math.min(16, Math.max(rh, rv, 4.2));
  }

  private updateCamera() {
    const c = this.cam;
    if (c.auto && !this.dragging) c.tt += 0.004;
    c.theta += (c.tt - c.theta) * 0.14;
    c.phi += (c.tp - c.phi) * 0.14;
    c.r += (c.tr - c.r) * 0.14;
    const sp = Math.sin(c.phi);
    this.camera.position.set(
      this.target.x + c.r * sp * Math.sin(c.theta),
      this.target.y + c.r * Math.cos(c.phi),
      this.target.z + c.r * sp * Math.cos(c.theta),
    );
    this.camera.lookAt(this.target);
  }

  /* ------------------------------- interação ------------------------------- */

  private pickAt(cx: number, cy: number): string | null {
    const r = this.canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hits = ray.intersectObjects(this.carMeshes, false);
    return hits.length ? ((hits[0].object.userData as MeshData).part ?? null) : null;
  }

  private setHover(id: string | null) {
    if (id === this.hover) return;
    const prev = this.hover;
    this.hover = id;
    if (prev) this.paintPart(prev);
    if (id) this.paintPart(id);
  }

  private bindPointer() {
    const cv = this.canvas;
    const ptrs = new Map<number, { x: number; y: number }>();
    let moved = 0, pinchD = 0, hoverQueued = false, last: { x: number; y: number } | null = null;
    const pinchDist = () => {
      const a = [...ptrs.values()];
      return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    };
    const on = <K extends keyof HTMLElementEventMap>(t: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      cv.addEventListener(t, fn as EventListener, opts);
      this.cleanup.push(() => cv.removeEventListener(t, fn as EventListener));
    };

    on('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch { /* noop */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) moved = 0;
      if (ptrs.size === 2) { pinchD = pinchDist(); moved += 20; }
      this.dragging = true; cv.style.cursor = 'grabbing';
    });
    on('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (p) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (ptrs.size === 1) {
          this.cam.tt -= dx * 0.006;
          this.cam.tp = Math.max(0.08, Math.min(1.52, this.cam.tp - dy * 0.006));
          moved += Math.abs(dx) + Math.abs(dy);
          if (moved > 6) { this.setHover(null); this.cb.onHover?.(null, 0, 0); }
        } else if (ptrs.size === 2) {
          const d = pinchDist();
          if (pinchD > 0 && d > 0) this.cam.tr = Math.max(3, Math.min(16, (this.cam.tr * pinchD) / d));
          pinchD = d;
        }
      } else {
        last = { x: e.clientX, y: e.clientY };
        if (!hoverQueued) {
          hoverQueued = true;
          requestAnimationFrame(() => {
            hoverQueued = false;
            if (!last || this.disposed) return;
            const id = this.pickAt(last.x, last.y);
            this.setHover(id);
            this.cb.onHover?.(id, last.x, last.y);
            cv.style.cursor = id ? 'pointer' : 'grab';
          });
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      const single = ptrs.size === 1;
      ptrs.delete(e.pointerId);
      if (e.type === 'pointerup' && single && moved < 6) this.cb.onSelect?.(this.pickAt(e.clientX, e.clientY));
      if (ptrs.size === 0) { this.dragging = false; cv.style.cursor = 'grab'; }
      if (ptrs.size === 1) pinchD = 0;
    };
    on('pointerup', end);
    on('pointercancel', end);
    on('pointerleave', () => { last = null; this.setHover(null); this.cb.onHover?.(null, 0, 0); });
    on('wheel', (e) => {
      e.preventDefault();
      this.cam.tr = Math.max(3, Math.min(16, this.cam.tr * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
    cv.style.cursor = 'grab';
    cv.style.touchAction = 'none';
  }
}
