import type { CarSpec } from './specs';

/**
 * Geração da carroceria por perfil (sem depender do three).
 * Calcula vértices e triângulos; o scene.ts transforma isso em geometria.
 * Coordenadas: x = frente, y = altura, z = lado direito (esquerdo = z negativo).
 */

export type PartMat = 'paint' | 'glass' | 'trim' | 'floor' | 'head' | 'tail';
interface Zone { id: string; name: string; mat: PartMat }
export interface BodyGroup { id: string | null; name: string | null; mat: PartMat; idx: number[] }
export interface WindowRange { k: string; n: string; x0: number; x1: number }
export interface BodyData {
  pos: Float32Array;
  groups: Record<string, BodyGroup>;
  all: number[];
  seams: number[][];
  rows: number;
  stations: number;
  wins: WindowRange[];
}

/* ---- carroceria por perfil: calcula vértices e triângulos sem depender do THREE ---- */
let N1 = 6, N2 = 6, N3 = 4, N4 = 6, N5 = 3, MROW = N1 + 1 + N2 + N3 + N4 + N5;   /* 26 pontos por meia-seção */
let SEGS: string[] = [];
(function(){
  let i;
  for (i = 0; i < N1; i++) SEGS.push('top');
  for (i = 0; i < N2; i++) SEGS.push('corner');
  for (i = 0; i < N3; i++) SEGS.push('tumble');
  for (i = 0; i < N4; i++) SEGS.push('lower');
  for (i = 0; i < N5; i++) SEGS.push('tuck');
})();
let IDX_E = N1 + N2, IDX_S = N1 + N2 + N3, IDX_L = N1 + N2 + N3 + N4;    /* fim do canto, ombro, fim do flanco */

function lerp(a: number, b: number, t: number): number{ return a + (b-a)*t; }
function clamp01(t: number): number{ return Math.max(0, Math.min(1, t)); }
function smooth(a: number, b: number, x: number): number{ let t = clamp01((x-a)/(b-a)); return t*t*(3-2*t); }

function filletPath(pts: number[][]): number[][]{
  let out: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    let p = pts[i];
    if (i === 0 || i === pts.length-1 || !(p[2] > 0)) { out.push([p[0], p[1]]); continue; }
    let a = pts[i-1], b = pts[i+1];
    let d1 = Math.hypot(a[0]-p[0], a[1]-p[1]), d2 = Math.hypot(b[0]-p[0], b[1]-p[1]);
    let t = Math.min(p[2], d1*.48, d2*.48);
    let p1 = [p[0]+(a[0]-p[0])/d1*t, p[1]+(a[1]-p[1])/d1*t];
    let p2 = [p[0]+(b[0]-p[0])/d2*t, p[1]+(b[1]-p[1])/d2*t];
    for (let k = 0; k <= 6; k++) {
      let u = k/6, w = 1-u;
      out.push([w*w*p1[0] + 2*w*u*p[0] + u*u*p2[0], w*w*p1[1] + 2*w*u*p[1] + u*u*p2[1]]);
    }
  }
  return out;
}
function refinePath(path: number[][], xsplits: number[], maxLen: number): number[][]{
  let out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    let a = path[i-1], b = path[i], dx = b[0]-a[0], dy = b[1]-a[1];
    let len = Math.hypot(dx, dy), cuts: number[] = [];
    if (Math.abs(dx) > 1e-6) xsplits.forEach((xs) => {
      let t = (xs - a[0])/dx; if (t > 1e-4 && t < 1-1e-4) cuts.push(t);
    });
    let n = Math.max(1, Math.ceil(len/maxLen));
    for (let k = 1; k < n; k++) {
      let tu = k/n, near = false;
      for (let c = 0; c < cuts.length; c++) if (Math.abs(cuts[c] - tu) < .25/n) near = true;
      if (!near) cuts.push(tu);
    }
    cuts.sort((p, q) => p - q);
    cuts.forEach((t) => { out.push([a[0]+dx*t, a[1]+dy*t]); });
    if (len > 1e-6) out.push([b[0], b[1]]);
  }
  return out;
}

function carDims(T: CarSpec){
  let ra = T.R + .07, dx0 = T.wb/2 - ra - .05;
  return {ra:ra, dx0:dx0, xA:dx0 - .02, rr:-T.L/2, fr:T.L/2, yf:T.belt - T.hoodDrop, cwH:T.W*.82/2};
}
function profilePts(T: CarSpec): number[][]{
  let D = carDims(T), rr = D.rr, fr = D.fr, belt = T.belt, R2 = T.R2, P: number[][] = [];
  P.push([rr+.07,.34,.04]); P.push([rr,.42,.05]); P.push([rr,.58,.03]); P.push([rr+.02,.66,.03]);
  P.push([rr+.04,R2[1]-.05,.07]);
  let lidX = rr + .14;
  if (R2[0] - lidX > .12) P.push([lidX,R2[1],.12]);
  P.push([R2[0],R2[1],.14]);
  P.push([T.xRR,T.roofY,.34]);
  P.push([T.xRF,T.roofY,.32]);
  P.push([D.xA,belt,.16]);
  P.push([(D.xA+fr)/2 + .1, belt - T.hoodDrop*.5, .5]);
  P.push([fr-.15, D.yf+.015, .1]);
  P.push([fr-.03, D.yf-.1, .05]);
  P.push([fr-.015,.66,.03]); P.push([fr,.58,.03]); P.push([fr,.42,.05]); P.push([fr-.07,.34,.04]);
  return P;
}
function bottomY(T: CarSpec, x: number): number{
  let D = carDims(T), yb = T.R;
  [T.wb/2, -T.wb/2].forEach((wx) => {
    let dx = Math.abs(x - wx);
    if (dx < D.ra) yb = Math.max(yb, T.R + Math.sqrt(D.ra*D.ra - dx*dx));
  });
  return yb;
}
function planHalf(T: CarSpec, x: number): number{
  let e = T.L/2 - Math.abs(x), f = clamp01(1 - e/.5);
  return T.W/2*(1 - .16*f*f);
}
/* meia-seção (z >= 0) do centro do teto até a soleira */
function crossSection(T: CarSpec, x: number, yT: number): number[][]{
  let belt = T.belt, D = carDims(T), ybot = bottomY(T,x), wp = planHalf(T,x);
  if (yT < ybot + .05) yT = ybot + .05;
  let cab = smooth(belt + .04, belt + .40, yT);
  let wt = (wp - .03) + (D.cwH - (wp - .03))*cab;
  let h = yT - ybot, rc = Math.min(.14 + .02*cab, h*.3), crown = .03 + .02*cab, edgeX = wt - rc;
  let pts: number[][] = [], i: number, z: number;
  for (i = 0; i <= N1; i++) { z = edgeX*i/N1; pts.push([z, yT - crown*Math.pow(z/wt,2)]); }
  let cy = yT - crown*Math.pow(edgeX/wt,2) - rc;
  for (i = 1; i <= N2; i++) { let a = (Math.PI/2)*(1 - i/N2); pts.push([edgeX + rc*Math.cos(a), cy + rc*Math.sin(a)]); }
  let zE = wt, yE = cy;
  let yS0 = yE + cab*(Math.min(belt, yE) - yE);
  let yS = Math.min(yE, Math.max(yS0, ybot + .06)), zS = zE + (wp - zE)*cab, u: number;
  for (i = 1; i <= N3; i++) { u = i/N3; pts.push([lerp(zE,zS,u) + .012*Math.sin(Math.PI*u)*cab, lerp(yE,yS,u)]); }
  let yL = Math.min(ybot + .05, yS - .01);
  for (i = 1; i <= N4; i++) { u = i/N4; pts.push([zS + .014*Math.sin(Math.PI*u) - .018*u, lerp(yS,yL,u)]); }
  let zL = pts[pts.length-1][0];
  pts.push([zL-.05, ybot+.025]); pts.push([zL-.11, ybot+.008]); pts.push([zL-.18, ybot]);
  return pts;
}

function windowRanges(T: CarSpec): WindowRange[]{
  let D = carDims(T), span = D.xA - T.xC;
  let fMid = (D.xA - T.xMid)/span, fEnd = (D.xA - T.drEnd)/span;
  let X = (f: number) => D.xA + (T.xC - D.xA)*f, W: WindowRange[] = [];
  function add(k: string, n: string, f0: number, f1: number){ W.push({k:k, n:n, x0:X(f1), x1:X(f0)}); }
  if (T.doors === 2) add('S','Vidro',-.07,1);
  else {
    let hasQ = fEnd < .85;
    add('F','Vidro diant.',-.07,fMid-.025);
    add('R','Vidro tras.',fMid+.025, hasQ ? fEnd-.02 : 1);
    if (hasQ) add('Q','Vidro lateral tras.',fEnd+.03,1);
  }
  return W;
}

export function buildBody(T: CarSpec): BodyData{
  let D = carDims(T), rr = D.rr, fr = D.fr, xA = D.xA, dx0 = D.dx0, yf = D.yf, belt = T.belt;
  let R2x = T.R2[0], R2y = T.R2[1], bed = T.rear === 'bed', gEndx = T.xRR + (R2x - T.xRR)*T.glassFrac;
  let wins = windowRanges(T);
  let seamX: number[] = [dx0, T.drEnd]; if (T.doors === 4) seamX.push(T.xMid);
  let xsplits = [xA, T.xRF, T.xRR, R2x, fr-.2, rr+.2].concat(seamX);
  [T.wb/2, -T.wb/2].forEach((wx) => { xsplits.push(wx - D.ra, wx + D.ra, wx); });
  let path = refinePath(filletPath(profilePts(T)), xsplits, .07);

  let S = path.length, RN = 2*MROW - 1, pos = new Float32Array(S*RN*3);
  path.forEach((p, i) => {
    let sec = crossSection(T, p[0], p[1]);
    for (let r = 0; r < MROW; r++) {
      let Lf = ((MROW-1) - r)*3, Rt = ((MROW-1) + r)*3, o = i*RN*3;
      pos[o + Rt] = p[0]; pos[o + Rt+1] = sec[r][1]; pos[o + Rt+2] = sec[r][0];
      pos[o + Lf] = p[0]; pos[o + Lf+1] = sec[r][1]; pos[o + Lf+2] = -sec[r][0];
    }
  });

  let groups: Record<string, BodyGroup> = {}, all: number[] = [];
  function group(z: Zone | null): BodyGroup{
    let key = z ? z.id : '_trim';
    if (!groups[key]) groups[key] = {id: z ? z.id : null, name: z ? z.name : null, mat: z ? z.mat : 'trim', idx: []};
    return groups[key];
  }
  let trunkName = T.rear === 'lid' ? 'Porta-malas' : 'Tampa traseira';
  function zone(xc: number, yc: number, zc: number, seg: string): Zone | null{
    let az = Math.abs(zc), sd = zc < 0 ? 'L' : 'R', sn = zc < 0 ? 'esq.' : 'dir.';
    let top = seg === 'top' || seg === 'corner';
    let trunkZ: Zone = bed ? {id:'tailgate', name:'Tampa da caçamba', mat:'paint'} : {id:'trunk', name:trunkName, mat:'paint'};
    if (xc < rr + .2 && yc < R2y - .01) {
      if (yc < .62) return {id:'bumperR', name:'Para-choque tras.', mat:'paint'};
      if (top && az > .3 && yc > .72) return {id:'tail'+sd, name:'Lanterna '+sn, mat:'tail'};
      if (top) return trunkZ;
    }
    if (xc > fr - .2 && yc < yf + .005) {
      if (yc < .62) return {id:'bumperF', name:'Para-choque diant.', mat:'paint'};
      if (top && az > .42 && yc > yf - .2) return {id:'head'+sd, name:'Farol '+sn, mat:'head'};
      if (top) return {id:'grille', name:'Grade frontal', mat:'trim'};
    }
    if (top) {
      if (xc >= xA) return {id:'hood', name:'Capô', mat:'paint'};
      if (xc >= T.xRF) return seg === 'top' ? {id:'windshield', name:'Para-brisa', mat:'glass'} : null;
      if (xc >= T.xRR) return {id:'roof', name:'Teto', mat:'paint'};
      if (xc >= R2x) {
        if (xc >= gEndx) return seg === 'top' ? {id:'rearglass', name:'Vidro traseiro', mat:'glass'} : null;
        return trunkZ;
      }
      if (bed) return seg === 'top' ? {id:'bedFloor', name:'Caçamba (piso)', mat:'floor'} : {id:'quarter'+sd, name:'Caçamba lateral '+sn, mat:'paint'};
      return trunkZ;
    }
    if (seg === 'tumble') {
      for (let i = 0; i < wins.length; i++) if (xc >= wins[i].x0 && xc <= wins[i].x1) return {id:'win'+wins[i].k+sd, name:wins[i].n+' '+sn, mat:'glass'};
      return null;
    }
    if (xc >= dx0) return {id:'fender'+sd, name:'Paralama '+sn, mat:'paint'};
    if (T.doors === 2) {
      if (xc >= T.drEnd) return {id:'door'+sd, name:'Porta '+sn, mat:'paint'};
    } else {
      if (xc >= T.xMid) return {id:'doorF'+sd, name:'Porta diant. '+sn, mat:'paint'};
      if (xc >= T.drEnd) return {id:'doorR'+sd, name:'Porta tras. '+sn, mat:'paint'};
    }
    return {id:'quarter'+sd, name:(bed ? 'Caçamba lateral ' : 'Lateral tras. ') + sn, mat:'paint'};
  }

  for (let i = 0; i < S-1; i++) {
    for (let j = 0; j < RN-1; j++) {
      let a = i*RN + j, b = a + 1, c = a + RN, d = c + 1;
      let ax = pos[a*3], ay = pos[a*3+1], az = pos[a*3+2], bx = pos[b*3], by = pos[b*3+1], bz = pos[b*3+2];
      let cx = pos[c*3], cy = pos[c*3+1], cz = pos[c*3+2], dx = pos[d*3], dy = pos[d*3+1], dz = pos[d*3+2];
      let e1x = bx-ax, e1y = by-ay, e1z = bz-az, e2x = cx-ax, e2y = cy-ay, e2z = cz-az;
      let nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
      let f1x = dx-bx, f1y = dy-by, f1z = dz-bz, f2x = cx-bx, f2y = cy-by, f2z = cz-bz;
      let mx = f1y*f2z - f1z*f2y, my = f1z*f2x - f1x*f2z, mz = f1x*f2y - f1y*f2x;
      let area = Math.hypot(nx,ny,nz) + Math.hypot(mx,my,mz);
      if (area < 1e-7) continue;
      let k = j < MROW - 1 ? (MROW - 2 - j) : (j - (MROW - 1));
      let z = zone((ax+bx+cx+dx)/4, (ay+by+cy+dy)/4, (az+bz+cz+dz)/4, SEGS[k]);
      let g = group(z);
      g.idx.push(a, b, c, b, d, c);
      all.push(a, b, c, b, d, c);
    }
  }

  /* linhas de junção (portas, capô, tampa) como listas de vértices */
  let seams: number[][] = [], rc = MROW - 1, s: number;
  function stationAt(x: number): number{ for (let q = 0; q < S; q++) if (Math.abs(path[q][0] - x) < 1e-6 && path[q][1] > .6) return q; return -1; }
  seamX.forEach((x) => {
    let st = stationAt(x); if (st < 0) return;
    [-1, 1].forEach((sg) => {
      let line: number[] = []; for (let r = IDX_S; r <= IDX_L; r++) line.push(st*RN + rc + sg*r);
      seams.push(line);
    });
  });
  [-1, 1].forEach((sg) => {
    let line: number[] = [];
    for (s = 0; s < S; s++) if (path[s][0] >= xA && path[s][0] <= fr - .2) line.push(s*RN + rc + sg*IDX_E);
    if (line.length > 1) seams.push(line);
    if (T.rear === 'lid') {
      line = [];
      for (s = 0; s < S; s++) if (path[s][0] >= rr + .2 && path[s][0] <= R2x) line.push(s*RN + rc + sg*IDX_E);
      if (line.length > 1) seams.push(line);
    }
  });
  return {pos:pos, groups:groups, all:all, seams:seams, rows:RN, stations:S, wins:wins};
}
