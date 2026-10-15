import { feel } from './feel';
import type { GEvent } from '../sim';

/** One game turn (time 1.0) plays in this many seconds. */
export const TURN_SEC = 0.18;
/** Different actors acting at the same moment are offset by this much (nobody waits for anybody). */
export const STAGGER = 0.03;
/** A new input plays what is left of the previous turn this many times faster. */
export const CATCHUP = 3;

interface Cue { at: number; ev: GEvent }

/** (MODEL 0) 연출 속도: 보통 · 빠름 · 즉시 (각인 사이 간격만 바뀐다) */
export type Pace = 'normal' | 'fast' | 'instant';
let pace: Pace = 'normal';
export const getPace = (): Pace => pace;
export const setPace = (p: Pace): void => { pace = p; };
/** k번째 각인 뒤의 간격: 처음엔 또렷하게, 연쇄가 이어질수록 빨라진다 */
function engraveGap(k: number): number {
  if (pace === 'instant') return 0;
  const g = Math.max(0.05, 0.16 * Math.pow(0.85, k));
  return pace === 'fast' ? g * 0.5 : g;
}

/**
 * Moments the rest of a show waits for, so a combo reads in order: the dash step lands before its blow, a leap
 * lands before its strikes, a weave or parry shows before the counter, a shove before the shot that follows.
 */
function holdAfter(ev: GEvent): number {
  if (ev.type === 'move') return ev.text === 'leap' ? 0.26 : ev.text === 'dash' ? feel().dashHold : 0;
  if (ev.type === 'shoot' && ev.src === 'hero') return feel().shotHold;
  if (ev.type === 'die') return feel().dieHold;
  if (ev.type === 'dodge' || ev.type === 'parry') return 0.14;
  return ev.type === 'push' ? 0.12 : 0;
}

/** Turns a batch of time-stamped sim events into a short, overlapping show. */
export class Playback {
  private cues: Cue[] = [];
  private now = 0;
  private rate = 1;
  /** 이번 연출에서 지금까지 나온 각인 수 (간격 가속용) */
  private engraves = 0;

  push(events: GEvent[], startTime: number): void {
    if (!this.cues.length) this.engraves = 0;
    const base = Math.max(this.now, this.cues.length ? this.cues[this.cues.length - 1]!.at : 0);
    const order = new Map<number, string[]>();
    // (MODEL 0) 주인 없는 효과(번개 선·폭발)는 바로 앞 이벤트의 주인 순서에 붙는다 (연쇄 끝으로 밀리지 않게)
    let lastSrc = '';
    for (const ev of events) {
      const list = order.get(ev.t) ?? [];
      const src = ev.src ?? lastSrc;
      lastSrc = src;
      if (!list.includes(src)) list.push(src);
      order.set(ev.t, list);
      const at = base + Math.max(0, ev.t - startTime) * TURN_SEC + list.indexOf(src) * STAGGER;
      this.cues.push({ at, ev });
    }
    this.cues.sort((a, b) => a.at - b.at);
  }

  hurry(): void {
    if (this.cues.length) this.rate = CATCHUP;
  }

  /** (MODEL 0) 새 입력: 남은 연출을 한꺼번에 내보낸다 */
  flush(): GEvent[] {
    const out = this.cues.map((c) => c.ev);
    this.cues = [];
    this.rate = 1;
    return out;
  }

  /** Events whose moment has come. */
  update(dt: number): GEvent[] {
    this.now += dt * this.rate;
    const out: GEvent[] = [];
    while (this.cues.length && this.cues[0]!.at <= this.now + 1e-9) {
      const ev = this.cues.shift()!.ev;
      out.push(ev);
      const hold = ev.type === 'engrave' ? engraveGap(this.engraves++) : holdAfter(ev);
      if (hold) { for (const c of this.cues) c.at += hold; break; }
    }
    if (!this.cues.length) this.rate = 1;
    return out;
  }

  /** (MODEL 0) 각인 연쇄를 재생하는 중 (타격마다 멈추지 않는다) */
  get chaining(): boolean {
    return this.engraves > 0 && this.cues.length > 0;
  }

  get busy(): boolean {
    return this.cues.length > 0;
  }
}
