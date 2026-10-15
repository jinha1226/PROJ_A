import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type DungeonPiece =
  | 'Wall_Modular' | 'Wall_Modular2' | 'Floor_Modular'
  | 'Floor_Trim_All' | 'Floor_Trim_T' | 'Floor_Trim_B' | 'Floor_Trim_L' | 'Floor_Trim_R' | 'Floor_Trim_LR'
  | 'Floor_Corner_TL' | 'Floor_Corner_TR' | 'Floor_Corner_BL' | 'Floor_Corner_BR' | 'Column' | 'Column2' | 'Arch_Door' | 'Barrel' | 'Chest' | 'Chest_Gold' | 'Torch' | 'Banner_wall'
  | 'Cobweb' | 'Cobweb2' | 'Skull' | 'Crate' | 'Stairs_Modular' | 'Trapdoor' | 'Trap_spikes' | 'Vase' | 'Bucket' | 'Brick' | 'Bag_Coins' | 'Sword_WallMount' | 'Coin_Pile'
  | 'Barrel2' | 'Floor_BricksSeparate' | 'Floor_BricksSeparate2' | 'Table_Small' | 'Table_Big' | 'Chair' | 'Banner' | 'Woodfire' | 'Bag_Standing' | 'Pedestal' | 'Statue_Horse';

/** how much brighter the pack's colours are made */
const LIFT = 1.7;

/**
 * (MODEL 0) SigilsVault Modular Dungeon Kit v1.0 (CC0): 손으로 그린 트림 시트의 어두운 판타지 던전.
 * 구조물(벽·바닥·기둥·문·계단)과 소품 일부를 이 킷으로 바꾼다. 새 킷에 없는 것(기름통·횃불·거미줄·깃발 등)은 Quaternius 그대로.
 */
const SIGILS: Partial<Record<DungeonPiece, string>> = {
  Floor_Modular: 'floor_small_01',
  // 바닥 테두리: 이름의 T·B·L·R은 모델의 -z·+z·-x·+x 변 (위에서 볼 때 위·아래·왼쪽·오른쪽)
  Floor_Trim_All: 'floor_small_trim_01',
  Floor_Trim_T: 'floor_small_trim_T_01',
  Floor_Trim_B: 'floor_small_trim_B_01',
  Floor_Trim_L: 'floor_small_trim_L_01',
  Floor_Trim_R: 'floor_small_trim_R_01',
  Floor_Trim_LR: 'floor_small_trim_LR_01',
  Floor_Corner_TL: 'floor_small_cornertrim_TL_01',
  Floor_Corner_TR: 'floor_small_cornertrim_TR_01',
  Floor_Corner_BL: 'floor_small_cornertrim_BL_01',
  Floor_Corner_BR: 'floor_small_cornertrim_BR_01',
  Wall_Modular: 'wall_small_01',
  Wall_Modular2: 'wall_small_02',
  Column: 'pillar_01',
  Column2: 'pillar_02',
  Arch_Door: 'door_arched_01_001',
  Stairs_Modular: 'stairs_small_01',
  Crate: 'crate',
  Vase: 'pot',
};
/** 새 킷은 이미 어두운 손그림 텍스처라 밝기를 덜 올린다 */
const SIGILS_LIFT = 1.35;

/** One pack piece, re-centred: footprint centred on the origin, resting on y = 0. */
export interface Piece { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; size: THREE.Vector3 }

/** The Quaternius modular dungeon pack (walls, floors, columns, doors, props). */
export class DungeonKit {
  private readonly pieces = new Map<string, Piece>();

  private constructor(scene: THREE.Group, overrides: [DungeonPiece, THREE.Group][] = []) {
    this.addPieces(scene, (o) => o.name);
    // the pack is coloured for a bright render; lift it so stone reads under torchlight (once per material)
    for (const p of this.pieces.values()) for (const m of [p.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.color || m.userData.lifted) continue;
      m.userData.lifted = true;
      m.color.multiplyScalar(LIFT);
    }
    // (MODEL 0) 예전 킷의 흩어진 벽돌은 새 바닥과 어울리지 않아 뺀다
    this.pieces.delete('Floor_BricksSeparate');
    this.pieces.delete('Floor_BricksSeparate2');
    // (MODEL 0) 새 킷 조각이 같은 이름 자리를 덮어쓴다. 한 파일이 한 조각이라 장면 전체를 한 조각으로 합친다
    for (const [name, g] of overrides) {
      const wrap = new THREE.Group();
      wrap.add(g);
      wrap.name = name;
      const holder = new THREE.Group();
      holder.add(wrap);
      this.addPieces(holder, () => name);
      for (const m of [this.pieces.get(name)?.material ?? []].flat() as THREE.MeshStandardMaterial[]) {
        if (!m.color || m.userData.lifted) continue;
        m.userData.lifted = true;
        m.color.multiplyScalar(SIGILS_LIFT);
      }
    }
  }

  private addPieces(scene: THREE.Object3D, nameOf: (o: THREE.Object3D) => string): void {
    scene.updateMatrixWorld(true);
    for (const o of scene.children) {
      // a piece with several materials loads as several meshes: merge them, one group per material
      const parts: THREE.Mesh[] = [];
      o.traverse((c) => { if ((c as THREE.Mesh).isMesh) parts.push(c as THREE.Mesh); });
      if (!parts.length) continue;
      const geos = parts.map((m) => {
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
        return g.index ? g.toNonIndexed() : g;
      });
      const geometry = geos.length === 1 ? geos[0]! : mergeGeometries(geos, true);
      if (!geometry) continue;
      const material = parts.length === 1 ? parts[0]!.material : parts.map((m) => m.material as THREE.Material);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const c = box.getCenter(new THREE.Vector3());
      geometry.translate(-c.x, -box.min.y, -c.z);
      this.pieces.set(nameOf(o), { geometry, material, size: box.getSize(new THREE.Vector3()) });
    }
  }

  static async load(baseUrl: string): Promise<DungeonKit> {
    const loader = new GLTFLoader();
    const [g, ...extra] = await Promise.all([
      loader.loadAsync(`${baseUrl}assets/models/qpack/dungeon.glb`),
      ...Object.values(SIGILS).map((f) => loader.loadAsync(`${baseUrl}assets/models/sigils/${f}.glb`)),
    ]);
    const names = Object.keys(SIGILS) as DungeonPiece[];
    return new DungeonKit(g!.scene, extra.map((x, i) => [names[i]!, x.scene]));
  }

  /** Tints every pack material (the stone of a zone); the pack's own colours are kept to tint from. */
  tint(color: string): void {
    const c = new THREE.Color(color);
    for (const p of this.pieces.values()) for (const m of [p.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.color) continue;
      const base = (m.userData.base ??= m.color.clone()) as THREE.Color;
      m.color.copy(base).multiply(c);
    }
  }

  /** (MODEL 0) 모든 조각의 재질 (시야 감쇠를 걸 때) */
  materials(): THREE.Material[] {
    return [...this.pieces.values()].flatMap((p) => [p.material].flat());
  }
  piece(name: DungeonPiece): Piece | undefined {
    return this.pieces.get(name);
  }

  /** A standalone copy scaled to a footprint width (or height), resting on the floor. */
  clone(name: DungeonPiece, fit: { width?: number; height?: number; maxWidth?: number }): THREE.Object3D {
    const p = this.pieces.get(name);
    if (!p) return new THREE.Group();
    const mesh = new THREE.Mesh(p.geometry, p.material);
    const s = fit.width ? fit.width / Math.max(0.01, Math.max(p.size.x, p.size.z)) : (fit.height ?? 1) / Math.max(0.01, p.size.y);
    mesh.scale.setScalar(s);
    // (MODEL 0) 높이에 맞춘 조각이 너무 굵으면 가로만 줄인다 (새 킷의 기둥)
    const w = Math.max(p.size.x, p.size.z) * s;
    if (fit.maxWidth && w > fit.maxWidth) { mesh.scale.x *= fit.maxWidth / w; mesh.scale.z *= fit.maxWidth / w; }
    mesh.castShadow = mesh.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(mesh);
    return holder;
  }
}
