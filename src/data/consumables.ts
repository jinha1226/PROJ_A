import type { InjectionId } from '../core/types';

// 소모품: 체력 플라스크(리필)와 슈트 주사제(방 단위 지속). 미확인 물건은 없다.

export interface InjectionDef {
  id: InjectionId;
  name: string;
  desc: string;
  /** 지속: 다른 방에 들어설 때마다 1씩 준다 */
  rooms: number;
  /** 바닥에서 보일 병 색 (렌더러 물약 색 이름) */
  color: string;
}

export const INJECTIONS: InjectionDef[] = [
  { id: 'haste', name: '가속 주사제', desc: '이동 비용 −25', rooms: 3, color: '푸른' },
  { id: 'ignite', name: '점화 주사제', desc: '모든 공격에 화염 적중 옵션', rooms: 3, color: '주황' },
  { id: 'harden', name: '경화 주사제', desc: '받는 피해 −25%', rooms: 3, color: '은빛' },
  { id: 'focus', name: '집중 주사제', desc: '치명타 피해 ×2.5, 시야 +2', rooms: 3, color: '보라' },
];
export const INJECTION_BY_ID = Object.fromEntries(INJECTIONS.map((d) => [d.id, d])) as Record<InjectionId, InjectionDef>;

/** 체력 플라스크: 충전 수 시작값·상한, 회복 비율, 함께 수리하는 장갑 */
export const FLASK = { start: 2, max: 4, heal: 0.4, repair: 6, upgradePrice: 8 };
/** 벨트 칸 수 */
export const BELT_SLOTS = 3;
/** 기름통 폭발 피해: 8 + 구역 × 3 */
export const BARREL_DAMAGE = (zone: number) => 8 + zone * 3;
