import type { Slot } from '../core/types';

// 시작 조합: MODEL 라인 × 슈트 프레임 (MVP: 라인 3 × 프레임 2)
// 2단계에서 무기가 분리되면 MODEL 0은 권총, W는 근접 무기, M은 원소 지팡이로 시작한다.
export interface OriginDef {
  id: string;
  name: string;
  desc: string;
  engraving: string;
  relic: string;
}

export const ORIGINS: OriginDef[] = [
  { id: 'model0', name: 'MODEL 0', desc: '빈 몸. 대기할 때(재장전 포함) 가장 가까운 적에게 보조 사격.', engraving: 'aux_fire', relic: 'bell_clapper' },
  { id: 'modelW', name: 'MODEL W', desc: '전사형. 피격될 때 공격자에게 반격한다.', engraving: 'counter_protocol', relic: 'brass_fist' },
  { id: 'modelM', name: 'MODEL M', desc: '마법사형. 공격할 때마다 주변 적에게 화염 파편이 튄다.', engraving: 'element_vent', relic: 'furnace_arm' },
];

export interface BodyDef {
  id: string;
  name: string;
  desc: string;
  slots: Record<Slot, number>;
  fixed: { slot: Slot; relic: string };
  relics: string[];
  baseHp: number;
  burdenCap: number;
  /** 부위별 슈트 장갑 기본값 (몸 부산물 장갑은 몸에 더해진다) */
  armor: Record<Slot, number>;
}

export const BODIES: BodyDef[] = [
  {
    id: 'light',
    name: '경량 프레임',
    desc: '다리 3, 팔 1. 빠르고 잘 피하지만 슈트 장갑이 얇다. 고정 슬롯: 다리.',
    slots: { body: 2, arm: 1, leg: 3, sense: 2 },
    fixed: { slot: 'leg', relic: 'pilgrim_greaves' },
    relics: ['bone_plates', 'bone_stilts', 'glass_eye'],
    baseHp: 34,
    burdenCap: 16,
    armor: { body: 12, arm: 10, leg: 12, sense: 8 },
  },
  {
    id: 'heavy',
    name: '중장 프레임',
    desc: '몸 3, 팔 2, 다리 1. 느리지만 슈트 장갑이 두껍다. 고정 슬롯: 몸.',
    slots: { body: 3, arm: 2, leg: 1, sense: 2 },
    fixed: { slot: 'body', relic: 'rusted_cuirass' },
    relics: ['bone_sickle', 'bone_plates', 'glass_eye'],
    baseHp: 42,
    burdenCap: 22,
    armor: { body: 18, arm: 12, leg: 8, sense: 8 },
  },
];

// 신앙: 판타지 세계의 옛 신 (MVP: 2)
export interface GodDef {
  id: string;
  name: string;
  law: string;
  boons: string[];
}

export const GODS: GodDef[] = [
  {
    id: 'furnace',
    name: '용광로의 신',
    law: '계율: 부산물을 버리지 말고 과부하로 태워라. (버리면 신앙 -2)',
    boons: ['과부하 효과 +30%', '과부하 시 체력 회복', '각인 칸 +1'],
  },
  {
    id: 'rust',
    name: '녹의 신',
    law: '계율: 새 부산물을 장착하지 마라. (장착하면 신앙 -3)',
    boons: ['층마다 장착된 부산물 강화 +1', '파손된 부위의 부산물도 온전한 효과', '보급 지점에서 체력 추가 회복'],
  },
];
