// PROJ_R 격자 렌더러를 우리 게임에 붙인 화면. main.ts가 쓰는 사용법은 예전 렌더러와 같다.
import type { Game } from '../core/game';
import type { GameEvent } from '../core/types';
import { Bridge } from './bridge';
import './projr/overlay/runtime.css';
import { DungeonKit } from './projr/grid/dungeonKit';
import { GridRuntime } from './projr/grid/gridRuntime';
import { UalLibrary } from './projr/grid/ualActor';
import { setWeaponKit, WeaponKit } from './projr/grid/weaponKit';
import { CELL } from './projr/grid/gridTerrain';
import * as THREE from 'three';

const BASE = '/';

export interface Assets {
  lib: UalLibrary;
  kit: DungeonKit;
}

/** 에셋(캐릭터·애니메이션, 던전 조각, 무기)을 한 번만 불러온다 */
let assets: Promise<Assets> | null = null;
export function loadAssets(): Promise<Assets> {
  assets ??= Promise.all([UalLibrary.load(BASE), DungeonKit.load(BASE), WeaponKit.load(BASE)]).then(([lib, kit, weapons]) => {
    setWeaponKit(weapons);
    return { lib, kit };
  });
  return assets;
}

export class View3D {
  private rt: GridRuntime | null = null;
  private bridge: Bridge | null = null;
  private stage: HTMLElement;
  private last = performance.now();
  private lastTime = 0;

  constructor(container: HTMLElement, private readonly assets: Assets) {
    this.stage = document.createElement('div');
    this.stage.className = 'stage3d';
    container.appendChild(this.stage);
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.rt?.update(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** 새 런: 런타임을 새로 만든다 */
  setGame(g: Game) {
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.bridge = new Bridge(g);
    this.rt = new GridRuntime(this.stage, this.bridge.sim, this.assets.lib, this.assets.kit, false);
    this.rt.pixelated = loadPixel();
    this.lastTime = this.bridge.sim.s.time;
  }

  /** 한 번의 행동이 끝난 뒤: 상태를 다시 채우고 이벤트를 재생한다 */
  handleEvents(events: GameEvent[]) {
    if (!this.bridge || !this.rt) return;
    this.bridge.update();
    this.rt.apply(this.bridge.convert(events), this.lastTime);
    this.lastTime = this.bridge.sim.s.time;
  }

  /** 이벤트 없이 상태만 바뀌었을 때 (예전 렌더러 호환) */
  sync() {}

  setReticle(x: number | null, y?: number) {
    this.rt?.showAim(x === null ? null : [{ x, y: y! }], true);
  }

  /** 마우스를 올린 빈 칸까지 이동 경로 (바닥에 점과 끝 테두리) */
  setPath(cells: { x: number; y: number }[] | null) {
    this.rt?.showPath(cells);
  }

  /** 마우스를 올린 몬스터·물건 칸의 빨간 테두리 */
  setMark(x: number | null, y?: number) {
    this.rt?.showMark(x === null ? null : { x, y: y! });
  }

  /** HD / 도트 전환. 선택은 브라우저에 기억한다 */
  get pixelated(): boolean {
    return this.rt?.pixelated ?? loadPixel();
  }
  set pixelated(v: boolean) {
    if (this.rt) this.rt.pixelated = v;
    try {
      localStorage.setItem('model0.pixel', v ? '1' : '0');
    } catch {
      /* 저장소를 못 쓰면 이번 실행에서만 */
    }
  }

  /** 칸 → 화면 좌표 (브라우저 테스트용) */
  screenOf(x: number, y: number): { left: number; top: number } | null {
    if (!this.rt) return null;
    const r = this.stage.getBoundingClientRect();
    const p = this.rt.project(new THREE.Vector3(x * CELL, 0, y * CELL));
    return { left: r.left + p.left, top: r.top + p.top };
  }

  pick(clientX: number, clientY: number): [number, number] | null {
    const c = this.rt?.cellAt(clientX, clientY);
    return c ? [c.x, c.y] : null;
  }
}

function loadPixel(): boolean {
  try {
    return localStorage.getItem('model0.pixel') !== '0';
  } catch {
    return true;
  }
}
