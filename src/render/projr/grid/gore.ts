import * as THREE from 'three';

// (MODEL 0) 처치 자국: PROJ_SV(DCSS)처럼 쓰러진 자리에 피웅덩이와 튄 핏자국을 바닥에 남긴다.
// 타일 이미지 대신 캔버스에 불규칙한 얼룩을 그려 쓴다. 층이 바뀌면 지운다.

const MAX_DECALS = 90;
/** 웅덩이가 번지는 시간 (초) */
const SPREAD = 0.7;

interface Decal { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; age: number; size: number }

/** 불규칙한 얼룩 하나: 겹친 원 여러 개 + 가장자리 방울 */
function splatCanvas(color: string, drops: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  const blob = (x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  for (let i = 0; i < 7; i++) blob(32 + (Math.random() - 0.5) * 18, 32 + (Math.random() - 0.5) * 18, 7 + Math.random() * 9);
  for (let i = 0; i < drops; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 16 + Math.random() * 13;
    blob(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 1.5 + Math.random() * 2.5);
  }
  return c;
}

export class Gore {
  readonly root = new THREE.Group();
  private readonly plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private decals: Decal[] = [];
  /** 미리 그린 얼룩 몇 장을 돌려 쓴다 */
  private readonly blood: THREE.CanvasTexture[] = [];
  private readonly dust: THREE.CanvasTexture[] = [];

  constructor() {
    for (let i = 0; i < 6; i++) this.blood.push(this.texture(splatCanvas('#5a0606', 8)));
    for (let i = 0; i < 4; i++) this.dust.push(this.texture(splatCanvas('#9a9384', 10)));
  }

  private texture(c: HTMLCanvasElement): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** 쓰러진 자리에 웅덩이 하나와 둘레의 핏방울. bones: 해골은 피 대신 뼛가루 */
  pool(at: THREE.Vector3, size: number, bones = false): void {
    const set = bones ? this.dust : this.blood;
    this.add(set, at.x, at.z, 1.5 * size, 0.012);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 0.6;
      this.add(set, at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, 0.35 + Math.random() * 0.3, 0.011);
    }
  }

  private add(set: THREE.CanvasTexture[], x: number, z: number, size: number, lift: number): void {
    const mat = new THREE.MeshStandardMaterial({ map: set[Math.floor(Math.random() * set.length)], transparent: true, depthWrite: false, roughness: 0.35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(this.plane, mat);
    mesh.position.set(x, lift + this.decals.length * 1e-5, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0.01);
    mesh.renderOrder = 1;
    this.root.add(mesh);
    this.decals.push({ mesh, age: 0, size });
    while (this.decals.length > MAX_DECALS) this.drop(this.decals.shift()!);
  }

  update(dt: number): void {
    for (const d of this.decals) {
      if (d.age >= SPREAD) continue;
      d.age = Math.min(SPREAD, d.age + dt);
      const k = 1 - Math.pow(1 - d.age / SPREAD, 3);
      d.mesh.scale.set(d.size * k, 1, d.size * k);
    }
  }

  clear(): void {
    for (const d of this.decals) this.drop(d);
    this.decals = [];
  }

  private drop(d: Decal): void {
    d.mesh.removeFromParent();
    d.mesh.material.dispose();
  }

  dispose(): void {
    this.clear();
    for (const t of [...this.blood, ...this.dust]) t.dispose();
    this.plane.dispose();
    this.root.removeFromParent();
  }
}
