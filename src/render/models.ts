import * as THREE from 'three';
import type { Actor, Element, RelicInst } from '../core/types';
import { isBroken } from '../core/stats';

// 재질: 슈트는 SF(무광 금속), 부산물은 원래 몬스터의 색을 남긴다.
export const ELEMENT_COLOR: Record<Element | 'none', number> = {
  fire: 0xd8682a,
  cold: 0x9cc8dc,
  lightning: 0xd9cf7a,
  impact: 0x9a7444,
  none: 0xcfc4a8,
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, opts: { emissive?: number; metal?: number; opacity?: number } = {}) {
  const key = `${color}-${opts.emissive ?? 0}-${opts.metal ?? 0.3}-${opts.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: opts.emissive ?? 0,
      emissiveIntensity: opts.emissive ? 0.6 : 0,
      metalness: opts.metal ?? 0.3,
      roughness: 0.75,
      flatShading: true,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

function relicMat(r: RelicInst | null, base: number, broken = false) {
  if (!r) return mat(base);
  const el = r.def.elements[0] ?? 'none';
  let c = ELEMENT_COLOR[el];
  if (broken) c = new THREE.Color(c).multiplyScalar(0.6).getHex();
  const emissive = broken ? 0x401010 : r.def.grade === 'forbidden' ? 0x3a0f2a : r.def.grade === 'holy' ? ELEMENT_COLOR[el] : 0;
  return mat(c, { emissive: r.dormant ? 0 : emissive, metal: 0.5, opacity: r.dormant ? 0.35 : 1 });
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 5),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  oct: new THREE.OctahedronGeometry(0.5, 0),
};

function part(geo: THREE.BufferGeometry, m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  return mesh;
}

/** 부산물 구성이 바뀌면 다시 조립해야 하는지 판별하는 서명 */
export function loadoutSignature(a: Actor): string {
  const parts: string[] = [];
  for (const s of ['body', 'arm', 'leg', 'sense'] as const)
    for (const r of a.slots[s]) parts.push(r ? `${r.def.id}${r.def.elements.join('')}${isBroken(a, s) ? 'b' : ''}${r.dormant ? 'z' : ''}` : '-');
  return parts.join('|');
}

/**
 * 부위 교체식 캐릭터 조립. 몸 슬롯 → 흉갑 판, 팔 슬롯 → 팔과 무기, 다리 슬롯 → 다리, 감각 → 머리의 눈/수정.
 * 화면에 보이는 부산물이 실제로 쓰는 부산물이다.
 */
export function buildActorModel(a: Actor): THREE.Group {
  const g = new THREE.Group();
  const isPlayer = a.isPlayer;
  const skin = a.ai === 'wraith' ? 0x8fa6b0 : isPlayer ? 0xc9b48a : 0x6e5d4a;
  const skinMat = a.ai === 'wraith' ? mat(skin, { emissive: 0x334455, opacity: 0.6 }) : mat(skin, { metal: 0.1 });

  // 다리
  const legs = a.slots.leg;
  const nLeg = Math.max(2, legs.length);
  for (let i = 0; i < nLeg; i++) {
    const r = legs[i % Math.max(1, legs.length)] ?? null;
    const br = isBroken(a, 'leg');
    const ang = (i / nLeg) * Math.PI * 2 + Math.PI / nLeg;
    const lx = Math.cos(ang) * 0.16,
      lz = Math.sin(ang) * 0.12;
    g.add(part(G.cyl, r ? relicMat(r, skin, br) : skinMat, 0.13, 0.42, 0.13, lx, 0.21, lz));
    if (r) g.add(part(G.box, relicMat(r, skin, br), 0.16, 0.08, 0.2, lx, 0.04, lz + 0.03));
  }
  // 몸통
  g.add(part(G.cyl, skinMat, 0.42, 0.5, 0.32, 0, 0.66, 0));
  const bodies = a.slots.body;
  bodies.forEach((r, i) => {
    if (!r) return;
    const m = relicMat(r, skin, isBroken(a, 'body'));
    if (i === 0) g.add(part(G.box, m, 0.46, 0.34, 0.2, 0, 0.7, 0.1));
    else if (i === 1) g.add(part(G.box, m, 0.5, 0.14, 0.38, 0, 0.92, 0)); // 어깨 판
    else g.add(part(G.cone, m, 0.3, 0.3, 0.3, 0, 0.45, -0.18)); // 등 부산물
  });
  // 머리
  const head = part(G.ico, skinMat, 0.3, 0.3, 0.3, 0, 1.08, 0);
  g.add(head);
  a.slots.sense.forEach((r, i) => {
    if (!r) return;
    const side = i === 0 ? -1 : 1;
    g.add(part(G.oct, relicMat(r, 0xffffff, isBroken(a, 'sense')), 0.09, 0.09, 0.09, side * 0.08, 1.11, 0.13));
  });
  // 팔 + 무기
  const arms = a.slots.arm;
  const nArm = Math.max(2, arms.length);
  for (let i = 0; i < nArm; i++) {
    const r = arms[i] ?? null;
    const side = i % 2 === 0 ? 1 : -1;
    const tier = Math.floor(i / 2);
    const ax = side * (0.28 + tier * 0.06),
      ay = 0.72 - tier * 0.14;
    const m = r ? relicMat(r, skin, isBroken(a, 'arm')) : skinMat;
    g.add(part(G.cyl, m, 0.1, 0.42, 0.1, ax, ay, 0.04));
    if (r) {
      const f = r.def.active?.form;
      if (f === 'sweep') g.add(part(G.box, m, 0.05, 0.12, 0.55, ax + side * 0.04, ay - 0.15, 0.3));
      else if (f === 'dash') g.add(part(G.cone, m, 0.12, 0.5, 0.12, ax, ay - 0.1, 0.32).rotateX(Math.PI / 2));
      else if (f === 'throw') g.add(part(G.ico, m, 0.2, 0.2, 0.2, ax, ay - 0.25, 0.12));
      else if (f === 'bolt') g.add(part(G.cyl, m, 0.05, 0.7, 0.05, ax, ay + 0.1, 0.12));
      else if (f === 'nova') g.add(part(G.box, m, 0.22, 0.22, 0.32, ax, ay - 0.22, 0.15));
      else g.add(part(G.box, m, 0.14, 0.14, 0.14, ax, ay - 0.22, 0.05));
    }
  }
  // 탑뷰에서도 읽히도록 크게
  g.scale.setScalar(a.boss ? 2.1 : a.elite ? 1.6 : isPlayer ? 1.45 : a.ai === 'wraith' ? 1.1 : 1.3);
  return g;
}
