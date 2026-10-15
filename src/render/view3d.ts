// PROJ_R 격자 렌더러를 우리 게임에 붙인 화면. main.ts가 쓰는 사용법은 예전 렌더러와 같다.
import type { Game } from '../core/game';
import type { GameEvent } from '../core/types';
import { Bridge } from './bridge';
import './projr/overlay/runtime.css';
import { DungeonKit } from './projr/grid/dungeonKit';
import { GridRuntime } from './projr/grid/gridRuntime';
import { UalLibrary } from './projr/grid/ualActor';
import { setWeaponKit, WeaponKit } from './projr/grid/weaponKit';

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

  setHover(x: number | null, y?: number) {
    this.rt?.showPath(x === null ? null : [{ x, y: y! }]);
  }

  pick(clientX: number, clientY: number): [number, number] | null {
    const c = this.rt?.cellAt(clientX, clientY);
    return c ? [c.x, c.y] : null;
  }
}
