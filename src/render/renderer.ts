import * as THREE from 'three';
import type { Game } from '../core/game';
import { Tile } from '../core/dungeon';
import type { Actor, Element, GameEvent } from '../core/types';
import { buildActorModel, ELEMENT_COLOR, loadoutSignature, mat } from './models';

// 렌더러는 로직 상태를 읽고 이벤트를 받아 그리기만 한다. 로직을 바꾸지 않는다.

interface ActorView {
  group: THREE.Group;
  model: THREE.Group;
  sig: string;
  pos: THREE.Vector3;
  lunge: number;
  lungeDir: THREE.Vector3;
  hpBar: THREE.Mesh;
  hpBack: THREE.Mesh;
  flash: number;
  dying: number;
}

interface Fx {
  obj: THREE.Object3D;
  t: number;
  life: number;
  update: (k: number) => void;
}

const FLOOR_COLOR = new THREE.Color(0x3a3128);
const FLOOR_SEEN = new THREE.Color(0x1d1915);
const WALL_COLOR = new THREE.Color(0x6b5236);
const WALL_SEEN = new THREE.Color(0x2c241c);
const BLACK = new THREE.Color(0x000000);

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  game!: Game;
  private floorMesh?: THREE.InstancedMesh;
  private wallMesh?: THREE.InstancedMesh;
  private wallIdx: number[] = [];
  private floorIdx: number[] = [];
  private levelGroup = new THREE.Group();
  private dynGroup = new THREE.Group();
  private actors = new Map<number, ActorView>();
  private fx: Fx[] = [];
  private playerLight: THREE.PointLight;
  private camTarget = new THREE.Vector3();
  private reticle: THREE.Mesh;
  private hoverMesh: THREE.Mesh;
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private zoom = 1;

  constructor(private container: HTMLElement, private fxLayer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x0b0908);
    this.scene.fog = new THREE.Fog(0x0b0908, 18, 34);
    this.camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0x9a8a70, 0x1a1210, 0.55));
    const dir = new THREE.DirectionalLight(0xffe2b0, 0.55);
    dir.position.set(-6, 14, 4);
    this.scene.add(dir);
    this.playerLight = new THREE.PointLight(0xffa860, 30, 14, 1.6);
    this.scene.add(this.playerLight);
    this.scene.add(this.levelGroup, this.dynGroup);

    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.48, 6), new THREE.MeshBasicMaterial({ color: 0xffcf6a, side: THREE.DoubleSide }));
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
    this.hoverMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }));
    this.hoverMesh.rotation.x = -Math.PI / 2;
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);

    window.addEventListener('resize', () => this.resize());
    container.addEventListener('wheel', (e) => {
      this.zoom = Math.min(1.6, Math.max(0.6, this.zoom + Math.sign(e.deltaY) * 0.08));
    });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setGame(g: Game) {
    this.game = g;
    this.rebuildLevel();
  }

  rebuildLevel() {
    const lv = this.game.level;
    this.levelGroup.clear();
    for (const v of this.actors.values()) this.dynGroup.remove(v.group);
    this.actors.clear();
    for (const f of this.fx) f.obj.parent?.remove(f.obj);
    this.fx = [];

    this.floorIdx = [];
    this.wallIdx = [];
    for (let y = 0; y < lv.h; y++)
      for (let x = 0; x < lv.w; x++) {
        const i = lv.idx(x, y);
        if (lv.tiles[i] === Tile.Floor) this.floorIdx.push(i);
        else {
          let nearFloor = false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lv.isFloor(x + dx, y + dy)) nearFloor = true;
          if (nearFloor) this.wallIdx.push(i);
        }
      }
    const m4 = new THREE.Matrix4();
    const floorGeo = new THREE.BoxGeometry(0.98, 0.2, 0.98);
    this.floorMesh = new THREE.InstancedMesh(floorGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), this.floorIdx.length);
    this.floorIdx.forEach((i, k) => {
      const x = i % lv.w,
        y = (i / lv.w) | 0;
      m4.makeTranslation(x, -0.1 - ((x * 7 + y * 13) % 5) * 0.012, y);
      this.floorMesh!.setMatrixAt(k, m4);
      this.floorMesh!.setColorAt(k, BLACK);
    });
    const wallGeo = new THREE.BoxGeometry(1, 0.75, 1);
    this.wallMesh = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.25, flatShading: true }), this.wallIdx.length);
    this.wallIdx.forEach((i, k) => {
      const x = i % lv.w,
        y = (i / lv.w) | 0;
      const h = 1 + ((x * 31 + y * 17) % 4) * 0.08;
      m4.makeScale(1, h, 1).setPosition(x, 0.375 * h - 0.05, y);
      this.wallMesh!.setMatrixAt(k, m4);
      this.wallMesh!.setColorAt(k, BLACK);
    });
    this.levelGroup.add(this.floorMesh, this.wallMesh);
    const p = this.game.player;
    this.camTarget.set(p.x, 0, p.y);
    this.sync();
  }

  /** 로직 상태 → 화면 동기화 */
  sync() {
    const g = this.game;
    const lv = g.level;
    // 타일 색: 보임 / 기억 / 미탐험
    this.floorIdx.forEach((i, k) => {
      const c = lv.visible[i] ? FLOOR_COLOR : lv.explored[i] ? FLOOR_SEEN : BLACK;
      this.floorMesh!.setColorAt(k, c);
    });
    this.wallIdx.forEach((i, k) => {
      const x = i % lv.w,
        y = (i / lv.w) | 0;
      let vis = 0,
        seen = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!lv.inBounds(x + dx, y + dy)) continue;
          const j = lv.idx(x + dx, y + dy);
          if (lv.visible[j]) vis = 1;
          if (lv.explored[j]) seen = 1;
        }
      this.wallMesh!.setColorAt(k, vis ? WALL_COLOR : seen ? WALL_SEEN : BLACK);
    });
    this.floorMesh!.instanceColor!.needsUpdate = true;
    this.wallMesh!.instanceColor!.needsUpdate = true;

    // 동적 오브젝트(지형, 부산물, 시설)
    for (const c of [...this.dynGroup.children]) {
      if (!c.userData.dyn) continue;
      this.dynGroup.remove(c);
      c.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        if (o.material instanceof THREE.MeshBasicMaterial) o.material.dispose();
      });
    }
    for (const [i, t] of lv.terrain) {
      if (!lv.explored[i]) continue;
      const color = t.kind === 'flame' ? 0xd8572a : t.kind === 'ice' ? 0xa9d6ea : 0xd9cf7a;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: lv.visible[i] ? 0.45 : 0.15 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(i % lv.w, 0.02, (i / lv.w) | 0);
      m.userData.dyn = true;
      this.dynGroup.add(m);
    }
    for (const [i, items] of g.ground) {
      if (!items.length || !lv.explored[i]) continue;
      const r = items[items.length - 1];
      // 부산물은 원소 색 결정, 무기는 길쭉한 금속 막대
      const color = r.kind === 'weapon' ? 0xb8bcc4 : ELEMENT_COLOR[r.def.elements[0] ?? 'none'];
      const geo = r.kind === 'weapon' ? new THREE.BoxGeometry(0.08, 0.08, 0.5) : new THREE.OctahedronGeometry(0.2, 0);
      const m = new THREE.Mesh(geo, mat(color, { emissive: r.def.grade === 'common' ? 0x221a10 : color, metal: 0.6 }));
      m.position.set(i % lv.w, 0.35, (i / lv.w) | 0);
      m.userData.dyn = true;
      m.userData.spin = true;
      this.dynGroup.add(m);
      if (items.length > 1) {
        const m2 = m.clone();
        m2.position.x += 0.18;
        m2.scale.setScalar(0.6);
        this.dynGroup.add(m2);
      }
    }
    for (const f of lv.features) {
      if (!lv.explored[lv.idx(f.x, f.y)]) continue;
      const grp = new THREE.Group();
      grp.userData.dyn = true;
      grp.position.set(f.x, 0, f.y);
      if (f.kind === 'exit') {
        const locked = g.isBossFloor && g.actors.some((a) => a.boss && !a.dead);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 6, 12), mat(locked ? 0x553322 : 0xc79a4a, { emissive: locked ? 0 : 0x6a4010, metal: 0.7 }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), new THREE.MeshBasicMaterial({ color: 0x050302 }));
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.03;
        grp.add(ring, hole);
      } else {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.6, 6), mat(0x7a6448, { metal: 0.5 }));
        pillar.position.y = 0.3;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mat(f.godId === 'furnace' ? 0xd8682a : 0x8a5a3a, { emissive: f.used ? 0 : 0x5a2a10 }));
        crystal.position.y = 0.8;
        crystal.userData.spin = true;
        grp.add(pillar, crystal);
      }
      this.dynGroup.add(grp);
    }

    // 액터
    const alive = new Set<number>();
    for (const a of g.actors) {
      if (a.dead) continue;
      alive.add(a.id);
      let v = this.actors.get(a.id);
      const sig = loadoutSignature(a);
      if (!v) {
        v = this.makeActorView(a);
        this.actors.set(a.id, v);
      } else if (v.sig !== sig) {
        v.group.remove(v.model);
        v.model = buildActorModel(a);
        v.group.add(v.model);
        v.sig = sig;
      }
      v.group.visible = a.isPlayer || !!lv.visible[lv.idx(a.x, a.y)];
      const max = g.st(a).maxHp;
      const frac = Math.max(0, a.hp / max);
      v.hpBar.scale.x = frac * 0.8;
      v.hpBar.position.x = -0.4 + frac * 0.4;
      (v.hpBar.material as THREE.MeshBasicMaterial).color.setHex(a.faction === 'player' ? (a.shield > 0 ? 0x9cc8dc : 0x8ab060) : a.marked ? 0xe0b040 : 0xb03a2a);
      const showBar = !a.isPlayer && frac < 1;
      v.hpBar.visible = v.hpBack.visible = showBar || a.marked;
    }
    for (const [id, v] of this.actors) {
      if (!alive.has(id) && v.dying <= 0) v.dying = 0.001;
    }
  }

  private makeActorView(a: Actor): ActorView {
    const group = new THREE.Group();
    const model = buildActorModel(a);
    group.add(model);
    const baseColor = a.isPlayer ? 0xc79a4a : a.faction === 'player' ? 0x9cc8dc : a.boss || a.elite ? 0xd04a30 : 0x8a2a1e;
    const base = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 16), new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.85 }));
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.025;
    if (a.boss) base.scale.setScalar(1.5);
    group.add(base);
    const hpBack = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.1), new THREE.MeshBasicMaterial({ color: 0x110b08 }));
    hpBack.rotation.x = -Math.PI / 2;
    hpBack.position.set(0, 1.9, -0.55);
    const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.07), new THREE.MeshBasicMaterial({ color: 0xb03a2a }));
    hpBar.rotation.x = -Math.PI / 2;
    hpBar.position.set(0, 1.91, -0.55);
    group.add(hpBack, hpBar);
    const pos = new THREE.Vector3(a.x, 0, a.y);
    group.position.copy(pos);
    if (a.faction === 'enemy') group.rotation.y = Math.PI;
    this.dynGroup.add(group);
    return { group, model, sig: loadoutSignature(a), pos, lunge: 0, lungeDir: new THREE.Vector3(), hpBar, hpBack, flash: 0, dying: 0 };
  }

  handleEvents(events: GameEvent[]) {
    const g = this.game;
    for (const e of events) {
      switch (e.type) {
        case 'floor':
          this.rebuildLevel();
          break;
        case 'attack': {
          const a = this.actors.get(e.actor!),
            t = g.actors.find((x) => x.id === e.target);
          if (a && t) {
            a.lunge = 1;
            a.lungeDir.set(t.x - a.pos.x, 0, t.y - a.pos.z).normalize();
          }
          break;
        }
        case 'damage': {
          const v = this.actors.get(e.target!);
          if (v) v.flash = 1;
          if (this.isVisible(e.x!, e.y!)) this.floatText(e.x!, e.y!, `${e.amount}`, e.element ? colorCss(e.element) : '#e8dcc0', e.target === g.player.id ? 'hurt' : '');
          break;
        }
        case 'dodge':
          if (this.isVisible(e.x!, e.y!)) this.floatText(e.x!, e.y!, '회피', '#bfb59a', '');
          break;
        case 'trigger':
          if (e.actor === g.player.id) this.floatText(e.x!, e.y!, e.text!, '#e0b45a', 'trig');
          break;
        case 'fx':
          this.spawnFx(e);
          break;
        case 'levelup':
          this.ring(g.player.x, g.player.y, 0xe0b45a, 2, 0.8);
          break;
      }
    }
  }

  private isVisible(x: number, y: number) {
    const lv = this.game.level;
    return lv.inBounds(x, y) && !!lv.visible[lv.idx(x, y)];
  }

  private spawnFx(e: GameEvent) {
    const color = e.element ? ELEMENT_COLOR[e.element] : 0xe8dcc0;
    switch (e.fx) {
      case 'blast':
        this.ring(e.x!, e.y!, color, (e.radius ?? 1) + 0.5, 0.45);
        break;
      case 'combo':
        this.ring(e.x!, e.y!, 0xffffff, 1.6, 0.6);
        this.floatText(e.x!, e.y!, e.text!, '#ffffff', 'combo');
        break;
      case 'line':
      case 'chain':
      case 'shards':
        this.beam(e.x!, e.y!, e.tx!, e.ty!, color, e.fx === 'chain' ? 0.35 : 0.25);
        break;
      case 'shield':
        this.ring(e.x!, e.y!, 0x9cc8dc, 0.7, 0.4);
        break;
      case 'heal':
        this.ring(e.x!, e.y!, 0x8ab060, 0.7, 0.5);
        break;
      case 'overload':
        this.pillar(e.x!, e.y!, color);
        break;
      case 'summon':
      case 'blink':
        this.ring(e.x!, e.y!, 0x8fa6b0, 0.8, 0.5);
        break;
    }
  }

  private ring(x: number, y: number, color: number, radius: number, life: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 24), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.08, y);
    this.scene.add(m);
    this.fx.push({
      obj: m, t: 0, life,
      update: (k) => {
        m.scale.setScalar(0.2 + k * radius);
        (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      },
    });
  }

  private beam(x0: number, y0: number, x1: number, y1: number, color: number, life: number) {
    const a = new THREE.Vector3(x0, 0.7, y0),
      b = new THREE.Vector3(x1, 0.7, y1);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, Math.max(0.1, len)), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(a).lerp(b, 0.5);
    m.lookAt(b);
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, life, update: (k) => ((m.material as THREE.MeshBasicMaterial).opacity = 1 - k) });
  }

  private pillar(x: number, y: number, color: number) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, 1.5, y);
    this.scene.add(m);
    this.fx.push({
      obj: m, t: 0, life: 0.8,
      update: (k) => {
        m.scale.set(1 - k * 0.6, 1 + k, 1 - k * 0.6);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      },
    });
  }

  private floatText(x: number, y: number, text: string, color: string, cls: string) {
    const d = document.createElement('div');
    d.className = `float ${cls}`;
    d.textContent = text;
    d.style.color = color;
    this.fxLayer.appendChild(d);
    const world = new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, 1.6, y);
    const obj = new THREE.Object3D();
    const life = cls === 'trig' || cls === 'combo' ? 1.3 : 0.9;
    this.fx.push({
      obj, t: 0, life,
      update: (k) => {
        const p = world.clone();
        p.y += k * 0.9;
        p.project(this.camera);
        d.style.left = `${((p.x + 1) / 2) * this.container.clientWidth}px`;
        d.style.top = `${((1 - p.y) / 2) * this.container.clientHeight}px`;
        d.style.opacity = `${1 - k * k}`;
        if (k >= 1) d.remove();
      },
    });
  }

  setReticle(x: number | null, y?: number) {
    this.reticle.visible = x !== null;
    if (x !== null) this.reticle.position.set(x, 0.06, y!);
  }

  setHover(x: number | null, y?: number) {
    this.hoverMesh.visible = x !== null;
    if (x !== null) this.hoverMesh.position.set(x, 0.03, y!);
  }

  /** 화면 좌표 → 타일 좌표 */
  pick(clientX: number, clientY: number): [number, number] | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null;
    const x = Math.round(hit.x),
      y = Math.round(hit.z);
    return this.game.level.inBounds(x, y) ? [x, y] : null;
  }

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    if (!this.game) return;
    const g = this.game;
    for (const [id, v] of this.actors) {
      const a = g.actors.find((x) => x.id === id);
      if (a && !a.dead) {
        const target = new THREE.Vector3(a.x, 0, a.y);
        const d = target.clone().sub(v.pos);
        if (d.lengthSq() > 0.0001) {
          const ang = Math.atan2(d.x, d.z);
          v.model.rotation.y = ang - v.group.rotation.y;
        }
        v.pos.lerp(target, 1 - Math.pow(0.0005, dt));
      }
      v.lunge = Math.max(0, v.lunge - dt * 6);
      const l = Math.sin(v.lunge * Math.PI) * 0.35;
      v.group.position.set(v.pos.x + v.lungeDir.x * l, Math.abs(Math.sin(t * 3 + id)) * 0.03, v.pos.z + v.lungeDir.z * l);
      v.flash = Math.max(0, v.flash - dt * 5);
      v.model.scale.setScalar(1 + v.flash * 0.12);
      if (v.dying > 0) {
        v.dying += dt * 2;
        v.group.rotation.z = v.dying * 1.4;
        v.group.position.y -= v.dying * 0.4;
        if (v.dying >= 1) {
          this.dynGroup.remove(v.group);
          this.actors.delete(id);
        }
      }
    }
    for (const c of this.dynGroup.children) if (c.userData.spin) c.rotation.y += dt * 1.5;
    for (const c of this.dynGroup.children) for (const cc of c.children) if (cc.userData.spin) cc.rotation.y += dt * 1.5;

    this.fx = this.fx.filter((f) => {
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      f.update(k);
      if (k >= 1) {
        f.obj.parent?.remove(f.obj);
        return false;
      }
      return true;
    });

    const pv = this.actors.get(g.player.id);
    const ppos = pv ? pv.pos : new THREE.Vector3(g.player.x, 0, g.player.y);
    this.camTarget.lerp(ppos, 1 - Math.pow(0.002, dt));
    const z = this.zoom;
    this.camera.position.set(this.camTarget.x, 17 * z, this.camTarget.z + 5.6 * z);
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z + 0.2);
    this.playerLight.position.set(ppos.x, 2.6, ppos.z);
    this.playerLight.intensity = 26 + Math.sin(t * 7) * 1.5 + Math.sin(t * 13) * 1;
    this.renderer.render(this.scene, this.camera);
  }
}

function colorCss(e: Element) {
  return '#' + ELEMENT_COLOR[e].toString(16).padStart(6, '0');
}
