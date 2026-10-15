import { cellAtScreen, cellVec, shotGroup } from './runtimeHelpers';
import { ShipTerrain } from './shipTerrain';
import { heroLook } from './heroLook';
import { speciesOf } from './species';
import type { ShipKit } from './shipKit';
import type { MetaState } from '../sim';
import { STATIONS } from '../sim';
import * as THREE from 'three';
import { zoneOf } from '../sim';
import { applyZoneLook } from './zoneLook';
import type { GridSim } from '../sim';
import { archerCanShoot } from '../sim';
import { activeWeapon } from '../sim';
import { idx, type Cell, type GEvent } from '../sim';
import type { UalLibrary } from './ualActor';
import type { DungeonKit } from './dungeonKit';
import { createScene, type SceneHandle } from '../scene/renderer';
import { chase } from './chase';
import { GridActors } from './gridActors';
import { GridFx } from './gridFx';
import { GridItems } from './gridItems';
import { EngravePops } from './engravePops';
import { buffOn } from '../sim';
import { lootText } from './cueText';
import { comboCue, type CueKit } from './comboCues';
import { GridElements } from './gridElements';
import { GridParticles } from './gridParticles';
import { GridTorches } from './gridTorches';
import { CELL, GridTerrain } from './gridTerrain';
import { Playback } from './playback';
import { PixelPass } from './pixelPass';
import { ShipIntro } from './shipIntro';
import { Afterimages } from './afterimage';
import { sensedFoes } from '../sim';
import { feel } from './feel';
import { StrikeFx } from './strikeFx';
import { Gore } from './gore';
import { XRAY } from './xray';
import { StrikeCues } from './strikeCues';
let ELEVATION = (45 * Math.PI) / 180;
/** Scripted views (the comparison demo) may tilt the camera. */
export const setCameraElevation = (deg: number): void => { ELEVATION = (deg * Math.PI) / 180; elevationTarget = ELEVATION; };
/** (MODEL 0) 시점 전환: 카메라 높이각이 이 값을 향해 부드럽게 움직인다. 완전 탑뷰는 89.5°(90°는 lookAt의 위쪽 방향이 겹친다) */
let elevationTarget = ELEVATION;
export const TOP_DOWN_DEG = 89.5;
export const setCameraTarget = (deg: number): void => { elevationTarget = (deg * Math.PI) / 180; };
/** (MODEL 0 룩데브) 지금 카메라 고도각 (도) */
export const getCameraElevation = (): number => (elevationTarget * 180) / Math.PI;
const CAM_DIST = 40;
const CAM_K = 8;
/** Draws a grid sortie: the map, models chasing their cells, and each turn's events replayed as a quick overlapping show. */
export class GridRuntime {
  private readonly h: SceneHandle;
  private terrain: GridTerrain | ShipTerrain;
  actors: GridActors;
  private elements: GridElements;
  private mapRef: GridSim['s']['map'];
  private readonly banner = document.createElement('div');
  readonly fx: GridFx;
  private torches: GridTorches;
  private readonly particles = new GridParticles();
  private readonly items = new GridItems();
  private readonly pops: EngravePops;
  private readonly kit2: CueKit;
  private punch = 0;
  /** (MODEL 0 룩데브: 도트 크기 조절) */
  readonly pixel: PixelPass;
  /** rough pixel look on/off */
  pixelated = true;
  private playback = new Playback();
  /** (MODEL 0 룩데브: 패널이 세기를 조절) */
  readonly hemi = new THREE.HemisphereLight('#aab0c8', '#1a1410', 0.85);
  private readonly light = new THREE.PointLight('#ffd6a0', 14, 8, 1.6);
  /** (MODEL 0) 달빛: 벽이 바닥에 그림자를 드리운다. 주인공을 따라다니는 그림자 범위 */
  private readonly sun = new THREE.DirectionalLight('#9ab8ea', 1.15);
  private readonly center = new THREE.Vector3();
  private readonly pending = new Map<string, { ready: boolean; queue: GEvent[] }>();
  /** (MODEL 0) 기본 보이는 높이 12m: 도트에서 캐릭터가 뭉개지지 않는 크기 (18m에서는 25~30픽셀) */
  private height = 12;
  private clock = 0;
  /** the ship's waking shot and the hatch beacon (ship only) */
  private intro?: ShipIntro;
  private zoomMul = 1;
  /** keep the view inside the map instead of following the hero past its edge (the showcase) */
  stayInMap = false;
  private readonly ghosts = new Afterimages();
  private readonly strikeFx = new StrikeFx();
  /** (MODEL 0) 바닥의 피웅덩이 */
  private readonly decals = new Gore();
  private strikes!: StrikeCues;
  /** dims the screen edge while the game runs slow (an engraving moment) */
  private readonly slowmo = document.createElement('div');
  constructor(private readonly el: HTMLElement, private readonly sim: GridSim, private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly mobile: boolean, private readonly onCue: (e: GEvent) => void = () => undefined, theme?: { theme: 'ship'; kit: ShipKit; meta: MetaState }) {
    this.h = createScene(el);
    if (mobile) { this.h.renderer.shadowMap.enabled = false; this.h.renderer.setPixelRatio(1); }
    const scene = this.h.scene;
    scene.background = new THREE.Color('#0b0b0e');
    scene.fog = null;
    const look = applyZoneLook(this.hemi, sim.s.run.floor, mobile);
    const sun = this.sun;
    sun.position.set(-10, 30, 14);
    if (!mobile) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
      sun.shadow.bias = -0.0008;
      sun.shadow.normalBias = 0.02;
    }
    scene.add(this.hemi, sun, sun.target, this.light);
    this.pixel = new PixelPass(this.h.renderer, mobile ? 1 : 2);
    if (!theme) kit.tint(look.tint);
    this.terrain = theme ? new ShipTerrain(sim.s.map, theme.kit, theme.meta) : new GridTerrain(sim.s.map, kit, look.decal);
    for (const st of theme ? sim.s.map.stations ?? [] : []) this.stationAt.set(`st-${st.id}`, new THREE.Vector3(st.pos.x * CELL, 0, st.pos.y * CELL));
    if (theme) { this.intro = new ShipIntro(this.stationAt.get('st-pod'), this.stationAt.get('st-hatch'), theme.meta.best === 0); scene.add(this.intro.root); }
    if (theme) { this.hemi.color.set('#b7ddff'); this.hemi.groundColor.set('#162432'); this.hemi.intensity = 0.62; this.light.color.set('#b7eaff'); this.light.intensity = 3; }
    this.actors = new GridActors(lib);
    this.torches = new GridTorches(sim.s.map, kit, look.lights, theme ? 0 : look.density, look);
    this.elements = new GridElements(kit, sim.s);
    this.mapRef = sim.s.map;
    scene.add(this.terrain.root, this.actors.root, this.torches.root, this.particles.root, this.items.root, this.elements.root, this.ghosts.root, this.strikeFx.root, this.decals.root);
    this.slowmo.className = 'grid-slowmo';
    el.appendChild(this.slowmo);
    this.banner.className = 'grid-banner';
    el.appendChild(this.banner);
    this.fx = new GridFx(scene, el, (p) => this.project(p), mobile ? 1 : 4);
    this.pops = new EngravePops(el);
    this.kit2 = { actors: this.actors, fx: this.fx, particles: this.particles, pops: this.pops, at: (id) => (id ? this.actors.pos(id) : undefined), punch: () => { this.punch = 0.16; }, trail: (id, sec) => { if (id) this.ghosts.trailOf(() => this.actors.figure(id), sec, id === 'hero' ? '#6dffb4' : '#ff8a6a'); } };
    // the figures are rebuilt on each floor, so the cues ask for the current set
    this.strikes = new StrikeCues(this.strikeFx, () => this.actors, this.particles);
    this.actors.sync(sim.s);
    const hp = sim.s.hero.pos;
    this.center.set(hp.x * CELL, 0, hp.y * CELL);
    this.refresh();
  }
  project(p: THREE.Vector3): { left: number; top: number } {
    const v = p.clone().project(this.h.camera);
    return { left: ((v.x + 1) / 2) * this.el.clientWidth, top: ((1 - v.y) / 2) * this.el.clientHeight };
  }
  /** A new turn's events: hurry the last show, queue this one, and update what is seen. */
  apply(events: GEvent[], startTime: number): void {
    if (this.sim.s.map !== this.mapRef) { this.newFloor(); return; }
    this.skip();
    this.playback.push(events, startTime);
    this.actors.sync(this.sim.s);
    this.refresh();
  }
  /** Down the stairs: rebuild the floor, the figures and the lights; drop what was left of the last show. */
  private newFloor(): void {
    const s = this.sim.s;
    const scene = this.h.scene;
    for (const part of [this.terrain, this.torches, this.elements, this.actors]) { scene.remove(part.root); part.dispose(); }
    const look = applyZoneLook(this.hemi, s.run.floor, this.mobile);
    this.kit.tint(look.tint);
    this.terrain = new GridTerrain(s.map, this.kit, look.decal);
    this.torches = new GridTorches(s.map, this.kit, look.lights, look.density, look);
    this.elements = new GridElements(this.kit, s);
    this.actors = new GridActors(this.lib);
    scene.add(this.terrain.root, this.torches.root, this.elements.root, this.actors.root);
    this.mapRef = s.map;
    this.playback = new Playback();
    this.pending.clear();
    this.decals.clear();
    this.actors.sync(s);
    this.center.set(s.hero.pos.x * CELL, 0, s.hero.pos.y * CELL);
    this.banner.textContent = `${s.run.floor}층 · ${zoneOf(s.run.floor).name}`;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
    this.refresh();
  }
  /** A clone steps out of the pod: start close on it and pull back (any input cuts it short). */
  playIntro(): void {
    if (!this.intro?.pod) return;
    this.intro.start();
    this.fx.transient.burst(this.intro.pod.x, this.intro.pod.z, '#b8ffd0', 1.4, 0.9);
  }
  skipIntro(): void { this.intro?.skip(); }
  powerShip(meta: MetaState): void { if (this.terrain instanceof ShipTerrain) this.terrain.power(meta); }
  showPath(cells: { x: number; y: number }[] | null): void {
    this.elements.setPath(cells);
  }
  /** (MODEL 0 추가) */
  /** (MODEL 0) 마우스를 올린 몬스터의 외곽선 */
  showOutline(id: string | null): void {
    this.actors.setOutline(id);
  }
  showMark(c: { x: number; y: number } | null): void {
    this.elements.setMark(c);
  }
  showAim(cells: { x: number; y: number }[] | null, ok: boolean): void {
    this.elements.setAim(cells, ok);
  }
  hurry(): void {
    this.playback.hurry();
  }
  /** (MODEL 0) 남은 연출을 바로 끝낸다 (입력이 들어왔을 때) */
  skip(): void {
    for (const e of this.playback.flush()) this.cue(e);
  }
  get busy(): boolean {
    return this.playback.busy;
  }
  /** Sight shading, which foes show, aim lines and intent marks. */
  private refresh(): void {
    const s = this.sim.s;
    if (this.terrain instanceof GridTerrain) this.terrain.syncTiles();
    this.terrain.shade(s);
    this.items.sync(s);
    this.elements.sync(s);
    for (const e of [s.hero, ...s.foes]) this.actors.setStatus(e.id, e.status);
    const g = s.hero.gear;
    this.actors.setWeapon('hero', heroLook(activeWeapon(g)?.group, this.terrain instanceof ShipTerrain), heroLook(g.hands[g.active === 0 ? 1 : 0]?.group, this.terrain instanceof ShipTerrain));
    this.actors.setGhost('hero', buffOn(s.hero, 'invis', s.time));
    this.actors.setSuitLights('hero', s.hero.suit.length);
    this.torches.shade(s, new THREE.Vector3(s.hero.pos.x * CELL, 1, s.hero.pos.y * CELL));
    // a thermal sight shows foes behind walls as faint ghosts
    const sensed = new Set(sensedFoes(s));
    for (const f of s.foes) {
      this.actors.setVisible(f.id, s.visible.has(idx(s.map, f.pos)) || sensed.has(f.id) || (!f.alive && s.seen[idx(s.map, f.pos)] === 1));
      if (f.alive) this.actors.setGhost(f.id, sensed.has(f.id));
    }
    const hero = new THREE.Vector3(s.hero.pos.x * CELL, 0, s.hero.pos.y * CELL);
    const shown = s.foes.filter((f) => f.alive && f.awake && s.visible.has(idx(s.map, f.pos)));
    const aiming = shown.filter((f) => f.kind === 'archer' && archerCanShoot(s, f));
    this.fx.setAim(aiming.map((f) => [new THREE.Vector3(f.pos.x * CELL, 0, f.pos.y * CELL), hero]));
    // on the ship deck the floating labels name the stations instead
    this.icons = this.stationAt.size ? (s.map.stations ?? []).map((st) => ({ id: `st-${st.id}`, icon: STATIONS[st.id] })) : shown.map((f) => ({ id: f.id, icon: aiming.includes(f) ? '◎' : '!' }));
  }
  /** (MODEL 0) 처치: 허리·머리·팔 중 하나를 잘라 날린다 (허리면 상체 덩어리) */
  private dismember(id: string, p: THREE.Vector3, from?: THREE.Vector3): void {
    const r = Math.random();
    const part = r < 0.4 ? 'waist' : r < 0.65 ? 'head' : r < 0.83 ? 'armL' : 'armR';
    const cut = this.actors.sever(id, part);
    if (!cut) return;
    const away = p.clone().sub(from ?? p.clone().add(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5))).setY(0);
    if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
    this.strikeFx.limb(cut.at, away, cut.color, part === 'waist' ? 'torso' : part === 'head' ? 'head' : 'arm', cut.size);
    this.gore(cut.at, 12, from);
  }
  /** The dead of the crypt shed bone chips; goblins and orcs bleed. */
  private gore(p: THREE.Vector3, n: number, from?: THREE.Vector3): void {
    if (speciesOf(this.sim.s.run.floor) === 'skeleton') this.particles.bones(p, n, from); else this.particles.blood(p, n * 2, from);
  }
  private icons: { id: string; icon: string }[] = [];
  private readonly stationAt = new Map<string, THREE.Vector3>();
  private cue(e: GEvent): void {
    const a = this.actors;
    const at = (id?: string) => (id ? a.pos(id) : undefined);
    const key = `${e.src}>${e.dst}`;
    if (e.src === 'hero' || e.type === 'engrave') this.strikes.note(e);
    const shot = this.pending.get(key);
    if (shot && !shot.ready && (e.type === 'hit' || e.type === 'miss' || e.type === 'die')) { shot.queue.push(e); return; }
    if (comboCue({ ...this.kit2, actors: a }, e)) { this.onCue(e); return; }
    switch (e.type) {
      case 'move': if (e.to) a.moveTo(e.src, e.to.x, e.to.y); break;
      case 'bump': {
        const p = at(e.dst);
        if (p) {
          a.lunge(e.src, p, e.text === 'finisher' ? 'finisher' : undefined, e.group);
          const from = at(e.src)!;
          if (e.src === 'hero') this.strikes.slash(e, p, from); else this.fx.transient.slash(p.x, p.z, Math.atan2(p.z - from.z, p.x - from.x));
        }
        break;
      }
      case 'shoot': {
        const p = at(e.dst) ?? (e.to ? cellVec(e.to) : undefined);
        // a bounce, a chain jump or a volley's extra bullets fly on their own; the shooter does not draw again
        const quiet = e.text === 'ricochet' || e.text === 'chain' || e.text === 'volley' || e.text === 'burst';
        const from = quiet && e.from ? cellVec(e.from) : at(e.src);
        if (!p || !from) break;
        if (!quiet) a.shoot(e.src, p, shotGroup(e), e.text === 'spin');
        if (e.text === 'execute') this.punch = 0.16;
        if (!e.dst) break;
        const entry = { ready: false, queue: [] as GEvent[] };
        this.pending.set(key, entry);
        const magic = e.text === 'spell';
        const f = feel(), mine = e.src === 'hero';
        if (mine) this.strikes.shot(e, from, p);
        this.fx.flash(from, magic ? '#b48aff' : '#ffd890', mine ? f.flash : 22, 0.08);
        if (mine && f.shotKick) this.fx.shake(0.07, f.shotKick);
        this.fx.bolt(from, p, () => { entry.ready = true; if (this.pending.get(key) === entry) this.pending.delete(key); for (const q of entry.queue) this.cue(q); }, mine ? f.bolt : 1);
        break;
      }
      case 'hit': {
        const p = at(e.dst);
        if (e.crit) a.knock(e.dst); else a.hurt(e.dst, at(e.src));
        if (e.crit) a.flashOnly(e.dst);
        if (p) {
          this.fx.number(`${e.amount}${e.crit ? '!' : ''}`, e.crit ? 'crit' : e.dst === 'hero' ? 'ally-hurt' : 'dmg', p);
          this.particles.spray(p, e.dst === 'hero' ? '#ff4a30' : '#ffe6a8', e.crit ? 12 : 6);
          if (e.dst !== 'hero') this.gore(p, e.crit ? 8 : 4, at(e.src));
        }
        if (!this.playback.chaining) this.fx.hitStop(feel().hitStop);
        if (e.dst === 'hero') this.fx.hurt();
        if (e.crit) this.punch = 0.16;
        if (e.crit || e.dst === 'hero') this.fx.shake(e.crit ? 0.14 : 0.1, e.crit ? 0.22 : 0.14);
        break;
      }
      case 'miss': {
        const p = at(e.dst);
        if (p) { this.fx.number('빗나감', 'miss', p); this.fx.transient.burst(p.x, p.z, '#b8a890', 0.35, 0.3); }
        break;
      }
      case 'reload': a.anim(e.src, 'reload'); break;
      case 'die': {
        a.die(e.dst);
        const p = at(e.dst);
        if (p && e.dst && e.dst !== 'hero') {
          this.gore(p, 18, at(e.src));
          this.fx.hitStop(feel().killStop);
          // (MODEL 0) 쓰러질 때마다 몸 어딘가가 찢겨 나가고, 그 자리에 피웅덩이가 남는다
          if (!this.strikes.kill(e.dst, p)) this.dismember(e.dst, p, at(e.src));
          this.decals.pool(p, 1, speciesOf(this.sim.s.run.floor) === 'skeleton');
        }
        break;
      }
      case 'door': if (e.to) this.terrain.openDoor(idx(this.sim.s.map, e.to)); break;
      case 'open': a.anim('hero', 'interact'); if (e.to) { this.terrain.openChest(idx(this.sim.s.map, e.to)); this.fx.transient.burst(e.to.x * CELL, e.to.y * CELL, '#ffd76a', 0.7, 0.5); } break;
      case 'energy': if (e.to) this.fx.energy(cellVec(e.to), e.amount ?? 0); break;
      case 'loot': if (e.to) this.fx.number(lootText(e), 'combo', cellVec(e.to)); break;
      case 'stun': a.knock(e.dst); break;
      case 'dodge': a.anim('hero', e.text === 'L' ? 'weaveL' : 'weaveR'); { const p = at('hero'); if (p) this.fx.number('회피', 'miss', p); } break;
      case 'parry': a.anim('hero', 'parry'); { const p = at('hero'); if (p) { this.fx.number(e.text === 'block' ? '막기!' : '패링!', 'combo', p); this.particles.spray(p, '#e8f0ff', 12); } } break;
      case 'explode': if (e.to) { const p = cellVec(e.to); this.fx.transient.burst(p.x, p.z, '#ffb04a', 1.4, 0.5); this.fx.flash(p, '#ff8a2a', 40, 0.45, 9); this.particles.spray(p, '#ff8a2a', 30); this.fx.shake(0.25, 0.35); this.fx.hitStop(); } break;
      case 'telegraph': { const p = at(e.src); if (p) this.fx.transient.burst(p.x, p.z, e.text === 'frost' ? '#5ab4ff' : '#ff5a3a', 0.6, 0.4); break; }
      case 'levelUp': { const p = at('hero'); if (p) { this.fx.number(`레벨 ${e.amount}!`, 'combo', p); this.fx.transient.glow(p.x, p.z, '#ffd76a'); } break; }
      case 'heal': {
        if (e.text !== 'regen') a.anim(e.dst, 'drink');
        const p = at(e.dst); if (p) this.fx.number(`+${e.amount}`, 'heal', p); break; }
      case 'wake': { const p = at(e.src); if (p) this.fx.number('!', 'crit', p); break; }
      default: break;
    }
    this.onCue(e);
  }
  update(dt: number): void {
    this.clock += dt;
    const scaled = dt * this.fx.timeScale;
    for (const e of this.playback.update(this.fx.frozen ? 0 : scaled)) this.cue(e);
    this.fx.update(dt);
    this.pops.update(dt);
    if (this.terrain instanceof ShipTerrain) this.terrain.update(dt);
    this.actors.update(scaled, this.fx.frozen);
    this.torches.update(dt);
    this.items.update(dt);
    this.elements.update(dt);
    this.ghosts.update(dt);
    this.strikeFx.update(scaled);
    this.decals.update(scaled);
    this.strikes.update(dt);
    this.slowmo.classList.toggle('on', this.fx.timeScale < 1);
    this.particles.update(this.fx.frozen ? 0 : scaled, this.center);
    this.punch = Math.max(0, this.punch - dt);
    const hero = this.actors.pos('hero') ?? this.center;
    // the small ship deck stays framed in the middle; in the dungeon the camera follows the hero
    const deck = new THREE.Vector3(((this.sim.s.map.w - 1) / 2) * CELL, 0, ((this.sim.s.map.h - 1) / 2) * CELL);
    const shot = this.intro?.update(dt);
    this.zoomMul = shot?.zoom ?? 1;
    let aim = shot && this.intro?.pod ? this.intro.pod.clone().lerp(deck, shot.k) : this.stationAt.size ? deck : hero;
    if (shot) { this.center.x = aim.x; this.center.z = aim.z; }
    // a copy: the hero's own position must not be moved by the clamp
    if (this.stayInMap && !this.stationAt.size) aim = this.clampAim(aim.clone());
    this.center.x = chase(this.center.x, aim.x, dt, CAM_K);
    this.center.z = chase(this.center.z, aim.z, dt, CAM_K);
    this.light.position.set(hero.x, 2.6, hero.z);
    // 달빛 그림자 범위가 화면 중심을 따라간다 (비스듬히 들어와 벽마다 긴 그림자)
    this.sun.position.set(this.center.x - 9, 26, this.center.z - 6);
    this.sun.target.position.set(this.center.x, 0, this.center.z);
    if (this.sim.s.hero.exitTime > 0) this.terrain.pulseExit(this.clock);
    if (Math.abs(ELEVATION - elevationTarget) > 1e-4) ELEVATION = chase(ELEVATION, elevationTarget, dt, 6);
    // (MODEL 0) 벽 투시: 주인공 위치, 탑뷰에 가까울수록 끈다 (위에서 보면 가리지 않는다)
    XRAY.hero.value.set(hero.x, 0, hero.z);
    {
      // 보이는 살아 있는 몬스터 (가까운 순)
      const s = this.sim.s;
      const near = s.foes
        .filter((f) => f.alive && s.visible.has(idx(s.map, f.pos)))
        .map((f) => this.actors.pos(f.id))
        .filter((v): v is THREE.Vector3 => !!v)
        .sort((a, b) => a.distanceToSquared(hero) - b.distanceToSquared(hero));
      XRAY.foes.value.forEach((v, k) => { const f = near[k]; if (f) v.set(f.x, 0, f.z, 1); else v.w = 0; });
    }
    XRAY.on.value = THREE.MathUtils.clamp((80 - (ELEVATION * 180) / Math.PI) / 15, 0, 1);
    this.placeCamera();
    this.fx.setIcons(this.icons.map((i) => ({ ...i, at: this.actors.pos(i.id) ?? this.stationAt.get(i.id) ?? new THREE.Vector3() })));
    // (MODEL 0) 상태 배지: 보이는 살아 있는 액터만
    {
      const s = this.sim.s;
      const shown = [s.hero, ...s.foes.filter((f) => f.alive && s.visible.has(idx(s.map, f.pos)))];
      this.fx.setBadges(shown.map((e) => ({ id: e.id, at: this.actors.pos(e.id) ?? new THREE.Vector3(), badges: e.alive ? (e.badges ?? []) : [] })));
    }
    if (this.pixelated) this.pixel.render(this.h.scene, this.h.camera);
    else this.h.renderer.render(this.h.scene, this.h.camera);
  }
  /** Pulls the camera target in so the view's edge stops at the map's edge (centred when the map is smaller than the view). */
  private clampAim(aim: THREE.Vector3): THREE.Vector3 {
    const cam = this.h.camera;
    const aspect = (cam.userData.aspect as number | undefined) ?? 9 / 16;
    const halfX = (this.viewH() * aspect) / 2, halfZ = (this.viewH()) / 2 / Math.sin(ELEVATION);
    const maxX = (this.sim.s.map.w - 1) * CELL, maxZ = (this.sim.s.map.h - 1) * CELL;
    const fit = (v: number, half: number, max: number) => (max - 2 * half < 0 ? max / 2 : Math.min(max - half, Math.max(half, v)));
    return aim.set(fit(aim.x, halfX - CELL / 2, maxX), aim.y, fit(aim.z, halfZ - CELL / 2, maxZ));
  }
  private placeCamera(): void {
    const cam = this.h.camera;
    const aspect = (cam.userData.aspect as number | undefined) ?? 9 / 16;
    // a heavy hit punches the camera in for a moment
    const half = (this.viewH() * (1 - 0.07 * Math.sin((this.punch / 0.16) * Math.PI))) / 2;
    Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    cam.updateProjectionMatrix();
    const c = this.center.clone().add(this.fx.jolt());
    if (this.pixelated) this.pixel.snap(c, half, ELEVATION);
    cam.position.set(c.x, Math.sin(ELEVATION) * CAM_DIST, c.z + Math.cos(ELEVATION) * CAM_DIST);
    cam.lookAt(c);
  }
  /** (MODEL 0) 실제로 보이는 높이: 세로 화면이면 늘려서 좌우 폭이 최소 0.8 × 높이 설정값이 되게 한다 (폰 세로에서 옆이 너무 좁지 않게) */
  private viewH(): number {
    const aspect = (this.h.camera.userData.aspect as number | undefined) ?? 9 / 16;
    return this.height * this.zoomMul * (aspect < 1 ? Math.min(2.2, 0.8 / aspect) : 1);
  }
  setZoom(h: number): void {
    this.height = h;
  }
  get zoom(): number {
    return this.height;
  }
  /** The grid cell under a screen point (null off the map). */
  cellAt(clientX: number, clientY: number): Cell | null {
    return cellAtScreen(this.el, this.h.camera, this.sim.s.map, clientX, clientY);
  }

  dispose(): void {
    this.actors.dispose();
    this.fx.dispose();
    this.torches.dispose();
    this.particles.dispose();
    this.items.dispose();
    this.elements.dispose();
    this.banner.remove();
    this.pops.dispose();
    this.intro?.dispose();
    this.ghosts.dispose();
    this.strikeFx.dispose();
    this.decals.dispose();
    this.slowmo.remove();
    this.pixel.dispose();
    this.terrain.dispose();
    this.h.dispose();
  }
}
