import * as THREE from 'three';
import { idx, type GridMap, type GridState } from '../sim';
import type { DungeonKit, DungeonPiece } from './dungeonKit';
import { wallFaces, type WallFace } from './gridLayout';
import { addDecor, cornerColumns, runColumns } from './gridDecor';
import { chasmMesh, sealMesh } from './toolGates';
import { applyXray } from './xray';
import { applyFog, updateFog } from './fog';
import { buildDecals } from './gridDecals';

/** Metres per grid cell. */
export const CELL = 1.0;
export const WALL_H = 1.5;
const PANEL_DEPTH = 0.25;
const CAP = new THREE.Color('#77716a');
const SEEN = 0.3;

/** (MODEL 0) 구운 AO 띠의 폭 (칸 비율) */
const AO_DEPTH = 0.42;

/** (MODEL 0) 바닥 칸의 테두리 조각: 위(y-1)·아래(y+1)·왼쪽(x-1)·오른쪽(x+1)이 벽인 변에 테두리 */
function trimFor(m: GridMap, i: number): { name: DungeonPiece; turn: number } | null {
  const x = i % m.w, y = Math.floor(i / m.w);
  const wall = (dx: number, dy: number) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || m.tiles[ny * m.w + nx] === 'wall'; };
  const T = wall(0, -1), B = wall(0, 1), L = wall(-1, 0), R = wall(1, 0);
  const n = +T + +B + +L + +R;
  if (n === 0) return null;
  if (n >= 3) return { name: 'Floor_Trim_All', turn: 0 };
  if (n === 1) return { name: T ? 'Floor_Trim_T' : B ? 'Floor_Trim_B' : L ? 'Floor_Trim_L' : 'Floor_Trim_R', turn: 0 };
  // 세로 복도: 좌우 테두리 조각은 블록 결이 방과 어긋나 보여서 방과 같은 기본 바닥을 깐다
  if (L && R) return null;
  if (T && B) return { name: 'Floor_Trim_LR', turn: Math.PI / 2 };
  return { name: T ? (L ? 'Floor_Corner_TL' : 'Floor_Corner_TR') : L ? 'Floor_Corner_BL' : 'Floor_Corner_BR', turn: 0 };
}

export const toWorld = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(x * CELL, 0, y * CELL);
/** Yaw that turns a model's +z toward `dir` (grid y = world z). */
export const yawFor = (dir: { x: number; y: number }): number => Math.atan2(dir.x, dir.y);

/** Floor, wall panels and columns from the Quaternius modular dungeon pack, dark wall tops, pillars, doors, chests and exits — all shaded by what the hero has seen. */
export class GridTerrain {
  readonly root = new THREE.Group();
  /** fog: 시야 텍스처로 밝기를 받는 것 (인스턴스 색은 고정) */
  private readonly instanced: { mesh: THREE.InstancedMesh; cells: number[]; tint?: THREE.Color; fog?: boolean }[] = [];
  /** props shown only where the hero has seen (keyed by the cell that reveals them) */
  private props: [number, THREE.Object3D][] = [];
  private readonly seals = new Map<number, THREE.Object3D>();
  /** 벽 칸 → 그 칸의 벽면들 (어느 메시의 몇 번째인지) */
  private readonly facesOf = new Map<number, { mesh: THREE.InstancedMesh; at: number }[]>();
  private readonly built: string[];
  private readonly doors = new Map<number, THREE.Object3D>();
  private readonly chests = new Map<number, THREE.Object3D>();
  private readonly exits: THREE.Mesh[] = [];
  private readonly tmp = new THREE.Color();

  constructor(private readonly m: GridMap, private readonly kit: DungeonKit, decal?: string) {
    this.built = [...m.tiles];
    // (MODEL 0) 벽·기둥·문은 주인공을 가리면 비쳐 보이게
    for (const n of ['Wall_Modular', 'Wall_Modular2', 'Column', 'Column2', 'Arch_Door'] as DungeonPiece[]) for (const mt of [kit.piece(n)?.material ?? []].flat()) applyXray(mt);
    // (MODEL 0) 던전 조각은 모두 부드러운 시야 텍스처로 밝기를 받는다
    for (const mt of kit.materials()) applyFog(mt);
    const faces = wallFaces(m);
    const floors = m.tiles.map((t, i) => [t, i] as const).filter(([t]) => t !== 'wall' && t !== 'chasm').map(([, i]) => i);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    // most cells get the full flagstone, some a loose-brick tile for variety
    const loose = (i: number) => ((i * 2246822519) >>> 0) % 100 < 14;
    const tile = (name: DungeonPiece) => (i: number, p: THREE.Vector3) => {
      const pc = kit.piece(name) ?? kit.piece('Floor_Modular')!;
      // (MODEL 0) 블록 결이 한 방향으로 이어지게: 바닥은 돌리지 않고, 위에 얹는 깨진 벽돌만 180°로 뒤집어 변화를 준다
      q.setFromAxisAngle(up, name === 'Floor_Modular' ? 0 : ((i * 7) % 2) * Math.PI);
      return new THREE.Matrix4().compose(p.setY(-0.1), q, new THREE.Vector3(CELL / pc.size.x, 0.1 / pc.size.y, CELL / pc.size.z));
    };
    // (MODEL 0) 바닥 테두리: 벽에 닿은 변에 테두리가 있는 조각을 깐다 (돌려 놓지 않는다)
    const groups = new Map<DungeonPiece, { cells: number[]; turn: number }>();
    const plain: number[] = [];
    for (const i of floors) {
      const piece = kit.piece('Floor_Trim_T') ? trimFor(m, i) : null;
      if (!piece) { plain.push(i); continue; }
      const g = groups.get(piece.name) ?? { cells: [], turn: piece.turn };
      g.cells.push(i);
      groups.set(piece.name, g);
    }
    this.instance('Floor_Modular', plain, tile('Floor_Modular'));
    for (const [name, g] of groups) {
      const pc = kit.piece(name)!;
      const tq = new THREE.Quaternion().setFromAxisAngle(up, g.turn);
      this.instance(name, g.cells, (_i, p) => new THREE.Matrix4().compose(p.setY(-0.1), tq, new THREE.Vector3(CELL / pc.size.x, 0.1 / pc.size.y, CELL / pc.size.z)));
    }
    // loose bricks lie on top of a few flagstones
    if (kit.piece('Floor_BricksSeparate')) this.instance('Floor_BricksSeparate', floors.filter(loose), (i, p) => tile('Floor_BricksSeparate')(i, p).premultiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)));
    this.instanceFaces(faces);
    this.bakeOcclusion(faces);
    // a thin stone cap on top of each wall panel only, so walls read as walls and not as solid blocks
    const capMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    applyXray(capMat);
    applyFog(capMat);
    const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL + 0.02, 0.08, PANEL_DEPTH + 0.04), capMat, faces.length);
    const capQ = new THREE.Quaternion();
    faces.forEach((f, k) => {
      const p = toWorld(f.wall.x + f.dir.x * (0.5 - PANEL_DEPTH / 2), f.wall.y + f.dir.y * (0.5 - PANEL_DEPTH / 2));
      capQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(f.dir));
      caps.setMatrixAt(k, new THREE.Matrix4().compose(p.setY(WALL_H), capQ, new THREE.Vector3(1, 1, 1)));
      caps.setColorAt(k, new THREE.Color(0, 0, 0));
    });
    this.root.add(caps);
    this.instanced.push({ mesh: caps, cells: faces.map((f) => idx(m, f.floor)), tint: CAP, fog: true });
    for (const c of [...cornerColumns(m, faces), ...runColumns(m, faces)]) {
      const col = kit.clone('Column', { height: WALL_H * 1.08, maxWidth: CELL * 0.3 });
      col.position.set(c.at.x * CELL, 0, c.at.y * CELL);
      this.addProp(c.reveal, col);
    }
    this.addProps();
    for (const [cell, obj] of addDecor(m, faces, kit)) this.addProp(cell, obj);
    // (MODEL 0) 예전 칠각형 웅덩이 장식은 데칼로 대체 (decal 색은 쓰지 않음)
    void decal;
    // (MODEL 0) 바닥 균열·얼룩·혈흔 데칼과 벽 가장자리 잔해
    for (const d of buildDecals(m, floors)) {
      this.root.add(d.mesh);
      this.instanced.push({ ...d, fog: true });
    }
  }

  /** (MODEL 0) 구워 넣은 앰비언트 오클루전: 벽에 닿는 바닥 가장자리에 부드럽게 어두워지는 띠. 구석은 두 띠가 겹쳐 더 어둡다 */
  private bakeOcclusion(faces: WallFace[]): void {
    if (!faces.length) return;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.72)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    const depth = AO_DEPTH;
    // 평면의 텍스처 위쪽(v=1)이 눕힌 뒤 -z: 벽 쪽이 진하다
    const geo = new THREE.PlaneGeometry(CELL, depth).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: '#ffffff' });
    const mesh = new THREE.InstancedMesh(geo, mat, faces.length);
    mesh.renderOrder = 1;
    const q = new THREE.Quaternion();
    faces.forEach((f, k) => {
      // 벽면 바로 앞 바닥 칸의, 벽에 붙은 가장자리
      const p = toWorld(f.floor.x - f.dir.x * (0.5 - depth / 2), f.floor.y - f.dir.y * (0.5 - depth / 2));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(f.dir));
      mesh.setMatrixAt(k, new THREE.Matrix4().compose(p.setY(0.006), q, new THREE.Vector3(1, 1, 1)));
      mesh.setColorAt(k, new THREE.Color(0, 0, 0));
    });
    this.root.add(mesh);
    // 보이지 않는 칸에서는 꺼지도록 시야 음영을 같이 받는다 (밝기 0이면 투명 띠도 보이지 않는다)
    this.instanced.push({ mesh, cells: faces.map((f) => idx(this.m, f.floor)) });
  }

  /** One instanced mesh of a pack piece over many cells; matrices come from `place`. */
  private instance(name: DungeonPiece, cells: number[], place: (i: number, p: THREE.Vector3) => THREE.Matrix4): void {
    const pc = this.kit.piece(name);
    if (!pc || !cells.length) return;
    const mesh = new THREE.InstancedMesh(pc.geometry, pc.material, cells.length);
    mesh.receiveShadow = true;
    cells.forEach((i, k) => {
      mesh.setMatrixAt(k, place(i, toWorld(i % this.m.w, Math.floor(i / this.m.w))));
      mesh.setColorAt(k, new THREE.Color(0, 0, 0));
    });
    this.root.add(mesh);
    this.instanced.push({ mesh, cells, fog: true });
  }

  /** Wall panels on every wall side facing a walkable cell, inside the wall cell, front at the boundary. */
  private instanceFaces(faces: WallFace[]): void {
    // (MODEL 0) 벽면마다 벽 조각 두 종류를 섞는다 (칸 위치로 정해 매번 같은 모양)
    const kinds = (['Wall_Modular', 'Wall_Modular2'] as DungeonPiece[]).filter((n) => this.kit.piece(n));
    if (!kinds.length) return;
    const pick = (f: WallFace) => kinds[((idx(this.m, f.wall) * 2654435761 + f.dir.x * 7 + f.dir.y * 13) >>> 0) % kinds.length]!;
    for (const name of kinds) {
      const mine = faces.filter((f) => pick(f) === name);
      if (!mine.length) continue;
      const pc = this.kit.piece(name)!;
      const mesh = new THREE.InstancedMesh(pc.geometry, pc.material, mine.length);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      const scale = new THREE.Vector3(CELL / pc.size.x, WALL_H / pc.size.y, PANEL_DEPTH / pc.size.z);
      const q = new THREE.Quaternion();
      mine.forEach((f, k) => {
        const p = toWorld(f.wall.x + f.dir.x * (0.5 - PANEL_DEPTH / 2), f.wall.y + f.dir.y * (0.5 - PANEL_DEPTH / 2));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFor(f.dir));
        mesh.setMatrixAt(k, new THREE.Matrix4().compose(p, q, scale));
        mesh.setColorAt(k, new THREE.Color(0, 0, 0));
        const w = idx(this.m, f.wall);
        this.facesOf.set(w, [...(this.facesOf.get(w) ?? []), { mesh, at: k }]);
      });
      this.root.add(mesh);
      this.instanced.push({ mesh, cells: mine.map((f) => idx(this.m, f.floor)), fog: true });
    }
  }

  /** Tiles the sim changed since the floor was built: a cut seal or a scanned wall becomes a doorway. */
  syncTiles(): void {
    const m = this.m;
    m.tiles.forEach((t, i) => {
      if (this.built[i] === t) return;
      this.built[i] = t;
      if (t !== 'door') return;
      for (const f of this.facesOf.get(i) ?? []) {
        f.mesh.setMatrixAt(f.at, new THREE.Matrix4().makeScale(0, 0, 0));
        f.mesh.instanceMatrix.needsUpdate = true;
      }
      const seal = this.seals.get(i);
      if (seal) { seal.removeFromParent(); this.props = this.props.filter(([, o]) => o !== seal); }
      this.addDoor(i);
    });
  }

  private addDoor(i: number): void {
    const m = this.m;
    const door = this.kit.clone('Arch_Door', { width: CELL });
    door.scale.y *= 0.85;
    door.rotation.y = m.tiles[i - 1] === 'wall' && m.tiles[i + 1] === 'wall' ? 0 : Math.PI / 2;
    door.position.copy(toWorld(i % m.w, Math.floor(i / m.w)));
    this.doors.set(i, door);
    this.addProp(i, door);
  }

  private addProp(cell: number, obj: THREE.Object3D): void {
    obj.visible = false;
    this.props.push([cell, obj]);
    this.root.add(obj);
  }

  private addProps(): void {
    const m = this.m;
    m.tiles.forEach((t, i) => {
      const p = toWorld(i % m.w, Math.floor(i / m.w));
      if (t === 'pillar') {
        const col = this.kit.clone('Column2', { height: WALL_H * 1.1, maxWidth: CELL * 0.34 });
        col.position.copy(p);
        this.addProp(i, col);
      }
      if (t === 'door') this.addDoor(i);
      if (t === 'chasm') { const pit = chasmMesh(); pit.position.copy(p); this.addProp(i, pit); }
      if (t === 'seal') {
        const seal = sealMesh(this.kit, m.tiles[i - 1] === 'wall' && m.tiles[i + 1] === 'wall');
        seal.position.copy(p);
        this.seals.set(i, seal);
        this.addProp(i, seal);
      }
    });
    for (const c of m.chests) {
      const chest = this.kit.clone('Chest', { width: CELL * 0.62 });
      chest.position.copy(toWorld(c.x, c.y));
      this.chests.set(idx(m, c), chest);
      this.addProp(idx(m, c), chest);
    }
    for (const e of m.exits) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.42, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: '#5fe08a', emissive: '#2a9a50', emissiveIntensity: 1.4 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(toWorld(e.x, e.y)).setY(0.06);
      this.exits.push(ring);
      this.root.add(ring);
    }
  }

  /** Visible tiles in full light, remembered ones dim, unknown ones black; props follow. */
  shade(s: GridState): void {
    const level = (i: number) => (s.visible.has(i) ? 1 : s.seen[i] ? SEEN : 0);
    updateFog(this.m.w, this.m.h, level, (i) => this.m.tiles[i] === 'wall');
    for (const it of this.instanced) {
      if (it.fog) {
        // 밝기는 셰이더가 시야 텍스처에서 읽는다: 색은 고정, 모르는 칸은 0 (텍스처 흐림이 번져도 안 보이게)
        it.cells.forEach((cell, k) => it.mesh.setColorAt(k, level(cell) > 0 ? (it.tint ? this.tmp.copy(it.tint) : this.tmp.setScalar(1)) : this.tmp.setScalar(0)));
        it.mesh.instanceColor!.needsUpdate = true;
        continue;
      }
      it.cells.forEach((cell, k) => { const l = level(cell); it.mesh.setColorAt(k, it.tint ? this.tmp.copy(it.tint).multiplyScalar(l > 0 ? Math.max(0.6, l) : 0) : this.tmp.setScalar(l)); });
      it.mesh.instanceColor!.needsUpdate = true;
    }
    for (const [cell, o] of this.props) o.visible = level(cell) > 0;
    s.map.exits.forEach((e, n) => {
      const ring = this.exits[n]!;
      ring.visible = level(idx(this.m, e)) > 0;
      const closed = s.closedExits.includes(n);
      const mat = ring.material as THREE.MeshStandardMaterial;
      mat.color.set(closed ? '#d04a3a' : '#5fe08a');
      mat.emissive.set(closed ? '#7a1a10' : '#2a9a50');
    });
  }

  openDoor(i: number): void {
    const d = this.doors.get(i);
    if (d) { d.rotation.y += Math.PI / 2.2; d.position.x += CELL * 0.3; }
  }

  openChest(i: number): void {
    const c = this.chests.get(i);
    if (c) { c.scale.multiplyScalar(0.85); c.position.y = -0.04; }
  }

  pulseExit(t: number): void {
    for (const r of this.exits) r.scale.setScalar(1 + Math.sin(t * 8) * 0.06);
  }

  dispose(): void {
    for (const it of this.instanced) it.mesh.dispose();
  }
}
