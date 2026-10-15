import type { Element, OptionId, WeaponDef } from '../core/types';

/** 무기 옵션 28종. 치명타는 무기 고유 효과가 정하고, 옵션은 상태를 만들거나 상태에 따라 피해를 키운다 */
export interface OptionDef {
  id: OptionId;
  name: string;
  kind: 'hit' | 'kill' | 'cond' | 'ranged' | 'shield' | 'forbidden';
  desc: string;
  /** 원소 적중 옵션: 공격 원소가 된다 (한 무기에 하나만) */
  element?: Element;
}

export const OPTIONS: OptionDef[] = [
  { id: 'fire', name: '화염', kind: 'hit', element: 'fire', desc: '맞은 적에게 화상 2턴' },
  { id: 'cold', name: '냉기', kind: 'hit', element: 'cold', desc: '맞은 적 둔화 2턴, 이미 둔화면 빙결 2턴' },
  { id: 'lightning', name: '번개', kind: 'hit', element: 'lightning', desc: '옆의 적 하나에게 피해 절반이 튐' },
  { id: 'impact', name: '충격', kind: 'hit', element: 'impact', desc: '맞은 적을 1칸 밀침, 막히면 기절 2턴' },
  { id: 'bleed', name: '출혈', kind: 'hit', desc: '맞은 적에게 출혈 2턴 (이동할 때마다 피해)' },
  { id: 'poison', name: '중독', kind: 'hit', desc: '맞은 적에게 중독 1중첩 (최대 5)' },
  { id: 'oil', name: '기름', kind: 'hit', desc: '맞은 적에게 기름 4턴 (화염에 맞으면 점화)' },
  { id: 'leech', name: '장갑 회수', kind: 'hit', desc: '준 피해의 1/4만큼 가장 많이 깎인 부위의 장갑 수리' },
  { id: 'corpseBlast', name: '잔해 폭파', kind: 'kill', desc: '처치하면 슈트가 잔해를 터뜨려 주변 1칸에 무기 피해 절반' },
  { id: 'deathFreeze', name: '냉각 방출', kind: 'kill', desc: '처치하면 주변 적 빙결 2턴' },
  { id: 'deathFlame', name: '잔불', kind: 'kill', desc: '처치하면 그 자리와 주변에 불길' },
  { id: 'burnDmg', name: '화염 피해', kind: 'cond', desc: '불붙은 적에게 피해 +60%' },
  { id: 'bleedDmg', name: '출혈 피해', kind: 'cond', desc: '출혈 적에게 피해 +50%' },
  { id: 'poisonDmg', name: '독 피해', kind: 'cond', desc: '중독 중첩마다 피해 +15%' },
  { id: 'freezeDmg', name: '빙결 피해', kind: 'cond', desc: '빙결 적에게 피해 +100%' },
  { id: 'stunDmg', name: '기절 피해', kind: 'cond', desc: '기절 적에게 피해 +60%' },
  { id: 'fullHp', name: '무손상', kind: 'cond', desc: '슈트의 모든 부위 장갑이 가득일 때 피해 +40%' },
  { id: 'despair', name: '궁지', kind: 'cond', desc: '내 체력 50% 이하일 때 피해 +30%' },
  { id: 'ambush', name: '기습', kind: 'cond', desc: '이동한 바로 다음 공격의 피해 +40%' },
  { id: 'aim', name: '정조준', kind: 'cond', desc: '대기·재장전한 바로 다음 공격의 피해 +60%' },
  { id: 'riposte', name: '반격', kind: 'cond', desc: '적에게 맞은 바로 다음 공격의 피해 +50% (반격)' },
  { id: 'critDmg', name: '치명 증폭', kind: 'cond', desc: '치명타 피해 +0.5배' },
  { id: 'pierceShot', name: '관통탄', kind: 'ranged', desc: '대상 뒤의 적까지 뚫는다' },
  { id: 'extraAmmo', name: '확장 탄창', kind: 'ranged', desc: '탄창·충전 +3' },
  { id: 'counter', name: '역습 증폭', kind: 'shield', desc: '막은 뒤 다음 공격 피해 +200%' },
  { id: 'fireShield', name: '발화 방패', kind: 'shield', desc: '막으면 공격자에게 화상 2턴' },
  { id: 'iceShield', name: '냉각 방패', kind: 'shield', desc: '막으면 공격자 빙결 2턴' },
  { id: 'frenzy', name: '폭주', kind: 'forbidden', desc: '이 무기를 든 동안 주는 피해 +100%, 받는 피해 +100% (금지 부산물의 저주)' },
];
export const OPTION_BY_ID = Object.fromEntries(OPTIONS.map((o) => [o.id, o])) as Record<OptionId, OptionDef>;

/** 이 무기에 붙을 수 있는 옵션인가: 원거리 옵션은 원거리에만(추가 탄창은 탄창이 있는 무기만), 방패 옵션은 방패에만, 광기는 금지 등급에만 */
export function optionFits(o: OptionDef, w: WeaponDef): boolean {
  if (o.kind === 'ranged') return w.range > 1 && (o.id !== 'extraAmmo' || w.mag !== undefined);
  if (o.kind === 'shield') return w.trait === 'block';
  if (o.kind === 'forbidden') return w.grade === 'forbidden';
  return true;
}

/** 치명타 배율 (치명타는 무기 고유 효과로만 생긴다) */
export const CRIT_MULT = 2;
/** 무기가 거는 상태의 기본 지속 (플레이어 턴) */
export const STATUS_TURNS = 2;
