import type { EffectSpec, EngravingDef, ByproductDef } from './types';
import { ELEMENT_NAME, GRADE_NAME, SLOT_NAME, STATUS_NAME, TRIGGER_NAME } from './types';
import { FORM_DESC, FORM_NAME } from '../data/forms';

const TARGET: Record<EffectSpec['target'], string> = {
  self: '자신',
  target: '대상',
  around: '주변 적',
  random: '무작위 적',
  marked: '표식된 적',
  nearest: '가장 가까운 적',
};

export function describeEffect(e: EffectSpec): string {
  return describeEffectBase(e) + (e.chainBonus ? ` (연쇄 단계마다 +${Math.round(e.chainBonus * 100)}%)` : '');
}

function describeEffectBase(e: EffectSpec): string {
  const el = e.inheritElement ? '같은 원소' : e.element ? ELEMENT_NAME[e.element] : '물리';
  const kinds = e.perElementKind ? ' (보유 원소 종류 수만큼)' : '';
  const t = TARGET[e.target];
  switch (e.kind) {
    case 'strike': return `${t}에게 ${el} 일격 ${e.power}`;
    case 'blast': return `${t} 위치에 ${el} 폭발 ${e.power} (반경 ${e.radius ?? 1})`;
    case 'shards': return `${el} 파편 ${e.count ?? 3}발 난사, 각 ${e.power}${kinds}`;
    case 'chain': return `${t}에게서 ${el} 연쇄 ${e.count ?? 2}회, 각 ${e.power}`;
    case 'push': return `${t}을(를) ${e.power}칸 밀쳐냄 (벽에 부딪히면 충돌 피해)`;
    case 'pull': return `${t}을(를) ${e.power}칸 끌어당김`;
    case 'status': return `${t}에게 ${STATUS_NAME[e.status!]} ${e.duration}턴`;
    case 'mark': return `${t}에게 표식`;
    case 'shield': return `보호막 +${e.power}`;
    case 'heal': return `체력 +${e.power}`;
    case 'repair': return `가장 많이 깎인 부위의 슈트 장갑 +${e.power}`;
    case 'blink': return '적에게서 먼 곳으로 도약';
    case 'cdReduce': return `액티브 쿨다운 -${e.power}${kinds}`;
    case 'haste': return `다음 행동 비용 -${e.power}%`;
    case 'imbue': return `다음 기본 공격에 ${el} 부여`;
    case 'terrain': return `${t} 칸에 ${{ flame: '불길', ice: '얼음', current: '전류 웅덩이' }[e.terrain!]} ${e.duration}턴`;
    case 'summon': return `홀로그램 분신 투사 (${e.duration}턴)`;
  }
}

export function describeEngraving(g: EngravingDef): string {
  return `${TRIGGER_NAME[g.trigger]} → ${describeEffect(g.effect)}`;
}

export function describeByproduct(r: ByproductDef): string[] {
  const st = r.stats;
  const lines: string[] = [];
  lines.push(`${GRADE_NAME[r.grade]} · ${SLOT_NAME[r.slot]}${r.elements.length ? ' · ' + r.elements.map((e) => ELEMENT_NAME[e]).join('/') : ''}`);
  const parts: string[] = [];
  if (st.integrity) parts.push(`몸 슈트 장갑 +${st.integrity}`);
  if (st.damage) parts.push(`피해 ${st.damage}`);
  if (st.attackCost && st.attackCost !== 100) parts.push(`공격 ${(100 / st.attackCost).toFixed(1)}회/턴`);
  if (st.moveBonus) parts.push(`이동 속도 +${Math.round((100 / (100 - st.moveBonus) - 1) * 100)}%`);
  if (st.dodge) parts.push(`회피 ${st.dodge}`);
  if (st.hp) parts.push(`체력 +${st.hp}`);
  if (st.sight) parts.push(`시야 +${st.sight}`);
  parts.push(`부담 ${st.burden}`);
  lines.push(parts.join(' · '));
  if (r.active) {
    const a = r.active;
    lines.push(`액티브: ${a.element ? ELEMENT_NAME[a.element] + ' ' : ''}${FORM_NAME[a.form]} ${a.power} (쿨 ${a.cooldown}${a.range ? `, 사거리 ${a.range}` : ''}) — ${FORM_DESC[a.form]}`);
  }
  if (r.curse) lines.push(`저주: ${r.curse.text}`);
  return lines;
}
