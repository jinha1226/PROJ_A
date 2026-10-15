import * as THREE from 'three';
import type { GridMap } from '../sim';
import { applyFog } from './fog';

// (MODEL 0) 바닥 데칼: 균열 · 혈흔 · 얼룩 (캔버스로 그린 아틀라스) + 벽 가장자리 잔해 (작은 돌 조각 메시).
// 칸 번호 해시로 자리를 정하므로 같은 맵은 늘 같은 모습이다. 모두 시야 텍스처(fog)로 밝기를 받는다.

type Kind = 'crack' | 'blood' | 'stain';
const VARIANTS = 4;
const TILE = 256;

/** 결정적 난수 (칸 번호 + 소금) */
function hash(i: number, salt: number): number {
  let h = (Math.imul(i + 1, 374761393) + Math.imul(salt + 1, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 갈라지며 뻗는 균열선 */
function drawCrack(g: CanvasRenderingContext2D, r: () => number) {
  const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    g.beginPath();
    g.moveTo(x, y);
    let cx = x, cy = y;
    const steps = 6 + Math.floor(r() * 5);
    const pts: [number, number][] = [[cx, cy]];
    for (let s = 0; s < steps; s++) {
      ang += (r() - 0.5) * 0.9;
      cx += Math.cos(ang) * (len / steps);
      cy += Math.sin(ang) * (len / steps);
      pts.push([cx, cy]);
    }
    // 어두운 틈 + 한쪽 밝은 모서리
    // 틈 둘레의 그늘
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = w * 3.2;
    g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = w + 1.5;
    g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + 1, py + 1) : g.moveTo(px + 1, py + 1))); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.95)';
    g.lineWidth = w;
    g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    if (depth > 0) for (let b = 0; b < 2; b++) if (r() < 0.7) {
      const [bx, by] = pts[1 + Math.floor(r() * (pts.length - 2))]!;
      branch(bx, by, ang + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.8), len * 0.45, w * 0.6, depth - 1);
    }
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const c = TILE / 2;
  const arms = 2 + Math.floor(r() * 2);
  for (let a = 0; a < arms; a++) branch(c, c, r() * Math.PI * 2, TILE * (0.36 + r() * 0.14), 5, 2);
  // 갈라진 중심의 파인 자국
  const grd = g.createRadialGradient(c, c, 0, c, c, 22);
  grd.addColorStop(0, 'rgba(0,0,0,0.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(c - 24, c - 24, 48, 48);
}

/** 피 웅덩이와 튄 방울 */
function drawBlood(g: CanvasRenderingContext2D, r: () => number) {
  const c = TILE / 2;
  const blob = (x: number, y: number, rad: number, alpha: number) => {
    g.fillStyle = `rgba(70,4,4,${alpha})`;
    g.beginPath();
    const n = 14;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = rad * (0.75 + r() * 0.4);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
  };
  blob(c, c, 34 + r() * 22, 0.82);
  for (let k = 0; k < 3; k++) blob(c + (r() - 0.5) * 34, c + (r() - 0.5) * 34, 12 + r() * 12, 0.75);
  // 튄 방울 (한쪽 방향으로 길게)
  const dir = r() * Math.PI * 2;
  for (let k = 0; k < 26; k++) {
    const d = 40 + r() * 80, a = dir + (r() - 0.5) * 1.2;
    blob(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.5 + r() * 4.5, 0.75);
  }
  // 마른 가장자리를 조금 어둡게
  g.globalCompositeOperation = 'source-atop';
  const grd = g.createRadialGradient(c, c, 10, c, c, 90);
  grd.addColorStop(0, 'rgba(120,10,10,0.25)');
  grd.addColorStop(1, 'rgba(10,0,0,0.5)');
  g.fillStyle = grd;
  g.fillRect(0, 0, TILE, TILE);
  g.globalCompositeOperation = 'source-over';
}

/** 그을음·물 자국 같은 넓은 얼룩 */
function drawStain(g: CanvasRenderingContext2D, r: () => number) {
  for (let k = 0; k < 9; k++) {
    const x = TILE / 2 + (r() - 0.5) * 110, y = TILE / 2 + (r() - 0.5) * 110, rad = 30 + r() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(10,8,6,${0.22 + r() * 0.2})`);
    grd.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // 작은 자갈 부스러기
  for (let k = 0; k < 40; k++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.12)';
    const s = 1 + r() * 3;
    g.fillRect(TILE / 2 + (r() - 0.5) * 180, TILE / 2 + (r() - 0.5) * 180, s, s);
  }
}

const KINDS: Kind[] = ['crack', 'blood', 'stain'];
let atlas: THREE.CanvasTexture | null = null;
function getAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = TILE * VARIANTS;
  c.height = TILE * KINDS.length;
  const g = c.getContext('2d')!;
  KINDS.forEach((k, row) => {
    for (let v = 0; v < VARIANTS; v++) {
      g.save();
      g.translate(v * TILE, row * TILE);
      g.beginPath();
      g.rect(0, 0, TILE, TILE);
      g.clip();
      const r = mulberry(row * 97 + v * 13 + 5);
      if (k === 'crack') drawCrack(g, r);
      else if (k === 'blood') drawBlood(g, r);
      else drawStain(g, r);
      g.restore();
    }
  });
  atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}

export interface DecalLayer { mesh: THREE.InstancedMesh; cells: number[] }

/** 맵의 바닥 데칼과 잔해를 만든다 */
export function buildDecals(m: GridMap, floors: number[]): DecalLayer[] {
  const out: DecalLayer[] = [];
  const tex = getAtlas();
  const wallNear = (i: number) => {
    const x = i % m.w, y = Math.floor(i / m.w);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.tiles[(y + dy!) * m.w + x + dx!] === 'wall');
  };
  const plain = floors.filter((i) => m.tiles[i] === 'floor');
  // 종류별 확률과 크기 (칸 비율)
  const plan: [Kind, number, number, number][] = [
    ['crack', 0.12, 1.1, 1.8],
    ['stain', 0.12, 1.2, 2.2],
    ['blood', 0.022, 0.8, 1.5],
  ];
  plan.forEach(([kind, chance, smin, smax], n) => {
    const salt = n + 11;
    const row = KINDS.indexOf(kind); // 아틀라스 줄
    for (let v = 0; v < VARIANTS; v++) {
      const cells = plain.filter((i) => hash(i, salt) < chance && Math.floor(hash(i, salt + 50) * VARIANTS) === v);
      if (!cells.length) continue;
      const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      // 이 변형의 아틀라스 칸으로 UV를 옮긴다 (캔버스 위쪽 = UV 1)
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (v + uv.getX(k)) / VARIANTS, 1 - (row + 1 - uv.getY(k)) / KINDS.length);
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: kind === 'blood' ? 0.35 : 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
      applyFog(mat);
      const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
      mesh.renderOrder = 1;
      mesh.receiveShadow = true;
      cells.forEach((i, k) => {
        const h = hash(i, salt + 99), x = i % m.w, y = Math.floor(i / m.w);
        const s = smin + (smax - smin) * h;
        mesh.setMatrixAt(k, new THREE.Matrix4().compose(
          new THREE.Vector3(x + (hash(i, salt + 3) - 0.5) * 0.6, 0.004 + n * 0.001, y + (hash(i, salt + 4) - 0.5) * 0.6),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, salt + 5) * Math.PI * 2),
          new THREE.Vector3(s, 1, s),
        ));
        mesh.setColorAt(k, new THREE.Color(0, 0, 0));
      });
      out.push({ mesh, cells });
    }
  });
  // 잔해: 벽 가장자리 바닥에 작은 돌 조각 2~5개
  const rubbleCells = plain.filter((i) => wallNear(i) && hash(i, 77) < 0.3);
  const per = rubbleCells.map((i) => 2 + Math.floor(hash(i, 78) * 4));
  const total = per.reduce((a, b) => a + b, 0);
  if (total) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 1, flatShading: true });
    applyFog(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, total);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const cells: number[] = [];
    let k = 0;
    rubbleCells.forEach((i, n) => {
      const x = i % m.w, y = Math.floor(i / m.w);
      // 가장 가까운 벽 쪽으로 몰아 놓는다
      let wx = 0, wy = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (m.tiles[(y + dy) * m.w + x + dx] === 'wall') { wx += dx; wy += dy; }
      for (let j = 0; j < per[n]!; j++) {
        const a = hash(i, 80 + j), b = hash(i, 90 + j), c = hash(i, 100 + j);
        const s = 0.04 + a * 0.09;
        mesh.setMatrixAt(k, new THREE.Matrix4().compose(
          new THREE.Vector3(x + wx * 0.3 + (b - 0.5) * 0.7, s * 0.5, y + wy * 0.3 + (c - 0.5) * 0.7),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(a * 6, b * 6, c * 6)),
          new THREE.Vector3(s * (0.8 + c * 0.6), s * (0.5 + a * 0.5), s * (0.8 + b * 0.5)),
        ));
        mesh.setColorAt(k, new THREE.Color(0, 0, 0));
        cells.push(i);
        k++;
      }
    });
    out.push({ mesh, cells });
  }
  return out;
}
