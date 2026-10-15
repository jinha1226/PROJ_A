import type { Slot } from '../core/types';

// 기원 × 몸체 시작 조합 (MVP: 기원 3 × 몸체 2)
export interface OriginDef {
  id: string;
  name: string;
  desc: string;
  engraving: string;
  relic: string;
}

export const ORIGINS: OriginDef[] = [
  { id: 'furnace', name: '용광로 수도회', desc: '공격할 때마다 주변 적에게 화염 파편이 튄다.', engraving: 'furnace_vow', relic: 'furnace_arm' },
  { id: 'gravekeeper', name: '서리 묘지기단', desc: '피격될 때 공격자를 둔화시킨다.', engraving: 'gravekeeper_rite', relic: 'frost_shell' },
  { id: 'bellringer', name: '종지기 수도회', desc: '대기할 때 종을 울려 번개가 적들 사이를 튄다.', engraving: 'bellringer_toll', relic: 'bell_clapper' },
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
}

export const BODIES: BodyDef[] = [
  {
    id: 'light',
    name: '경량 순례자',
    desc: '다리 3, 팔 1. 빠르고 잘 피하지만 얇다. 고정 슬롯: 다리.',
    slots: { body: 2, arm: 1, leg: 3, sense: 2 },
    fixed: { slot: 'leg', relic: 'pilgrim_greaves' },
    relics: ['bone_plates', 'bone_stilts', 'glass_eye'],
    baseHp: 34,
    burdenCap: 16,
  },
  {
    id: 'heavy',
    name: '봉합 거인',
    desc: '몸 3, 팔 2, 다리 1. 느리지만 두껍다. 고정 슬롯: 몸.',
    slots: { body: 3, arm: 2, leg: 1, sense: 2 },
    fixed: { slot: 'body', relic: 'rusted_cuirass' },
    relics: ['bone_sickle', 'bone_plates', 'glass_eye'],
    baseHp: 42,
    burdenCap: 22,
  },
];

// 신앙 (MVP: 2)
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
    law: '계율: 유물을 버리지 말고 봉헌하라. (버리면 신앙 -2)',
    boons: ['봉헌 효과 +30%', '봉헌 시 체력 회복', '각인 칸 +1'],
  },
  {
    id: 'rust',
    name: '녹의 신',
    law: '계율: 새 유물을 접목하지 마라. (접목하면 신앙 -3)',
    boons: ['층마다 접목된 유물 강화 +1', '손상된 유물도 절반 효과', '고정 슬롯 외 유물도 손상 면역 확률 30%'],
  },
];
