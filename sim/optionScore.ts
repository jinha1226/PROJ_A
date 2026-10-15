import type { OptionId, WeaponTrait } from '../src/core/types';

// 밸런스 3차 81조합·★ 실험: 점수 = max(0, 평균 승률 상승분 × 20). 나머지 옵션은 초기 추정값.
export const OPTION_SCORE: Record<OptionId, number> = {
  fire: 0, cold: 5.333, lightning: 2, impact: 4.444, bleed: 0.667, poison: 2, oil: 0.5, leech: 3,
  corpseBlast: 2, deathFreeze: 2, deathFlame: 1, burnDmg: 1, bleedDmg: 1, poisonDmg: 1,
  freezeDmg: 1, stunDmg: 1, fullHp: 1, despair: 1, ambush: 1.481, aim: 0.815, riposte: 3.111,
  critDmg: 1, pierceShot: 1, extraAmmo: 1, counter: 2, fireShield: 1, iceShield: 2, frenzy: 3,
};
export const TRAIT_SCORE: Record<WeaponTrait, number> = {
  ambush: 0, combo3: 0, balanced: 2.667, grudge: 4.667, desperate: 3.333, execute: 1.333, pierce: 4, harpoon: 4,
  fourth: 2.667, nutcracker: 0, cleave: 0, sadist: 0, torch: 2, block: 3, smash: 2, giant: 4.667,
  flawless: 0, pyreBlade: 0.667, lastShot: 4, scatter: 3, steady: 4.667, marksman: 3.333, pointBlank: 8,
  repeater: 0, knives: 1, pyro: 3.333, frost: 2.667, storm: 1.333, arcane: 2, deathmark: 3,
};
export const BOT_VALUE = {
  diversity: 1.3, signature: 1.25, hp: 0.12, armor: 0.12, ac: 1.1, dodge: 0.35,
  damage: 0.4, accuracy: 0.25, sight: 0.15, move: 0.06, weight: 0.12,
  resistance: 0.7, weakness: 2, curse: 5, dismantle: 0.15,
  frenzyHp: 0.75, frenzyAc: 5, preFlask: 0.6, emergencyFlask: 0.4, hardenHp: 0.5, defaultHit: 0.8,
  swapMargin: 1.3, maxSteps: 20000,
} as const;
