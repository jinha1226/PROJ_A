import type { Element, OptionId, StatusKind } from '../core/types';

// 상태·옵션 아이콘: 색 배지에 한 글자. HUD와 캐릭터 머리 위에서 같은 모양을 쓴다.

export interface Badge {
  /** 배지 글자 */
  g: string;
  /** 배지 색 */
  c: string;
  /** 남은 턴·중첩 (없으면 생략) */
  n?: number;
  /** 마우스를 올렸을 때 설명 */
  tip?: string;
}

export const STATUS_ICON: Record<StatusKind, { g: string; c: string; name: string }> = {
  burn: { g: '불', c: '#ff7a2a', name: '화상' },
  slow: { g: '둔', c: '#7ab8ff', name: '둔화' },
  freeze: { g: '빙', c: '#9fe8ff', name: '빙결' },
  stun: { g: '절', c: '#ffe066', name: '기절' },
  blind: { g: '맹', c: '#b0a8a0', name: '실명' },
  bleed: { g: '혈', c: '#e8384a', name: '출혈' },
  poison: { g: '독', c: '#7ad04a', name: '중독' },
  oil: { g: '유', c: '#c8a040', name: '기름' },
};

/** 원소 잔류 (복합 반응의 재료) */
export const AURA_ICON: Record<Element, { g: string; c: string }> = {
  fire: { g: '화', c: '#ff9a50' },
  cold: { g: '냉', c: '#9fd8ff' },
  lightning: { g: '전', c: '#ffe680' },
  impact: { g: '충', c: '#c09060' },
};

/** 무기 옵션: 상태를 만드는 옵션은 그 상태의 배지, 조건 옵션은 ▲를 붙인 배지 */
export const OPTION_ICON: Record<OptionId, { g: string; c: string }> = {
  fire: STATUS_ICON.burn, cold: STATUS_ICON.freeze, lightning: { g: '전', c: '#ffe680' }, impact: { g: '충', c: '#c09060' },
  bleed: STATUS_ICON.bleed, poison: STATUS_ICON.poison, oil: STATUS_ICON.oil, leech: { g: '수', c: '#7fd6c0' },
  corpseBlast: { g: '폭', c: '#ff9a50' }, deathFreeze: { g: '냉', c: '#9fe8ff' }, deathFlame: { g: '잔', c: '#ff7a2a' },
  burnDmg: { g: '불▲', c: '#ff7a2a' }, bleedDmg: { g: '혈▲', c: '#e8384a' }, poisonDmg: { g: '독▲', c: '#7ad04a' }, freezeDmg: { g: '빙▲', c: '#9fe8ff' },
  stunDmg: { g: '절▲', c: '#ffe066' }, fullHp: { g: '갑▲', c: '#9fd6ff' }, despair: { g: '위▲', c: '#ff8a7a' }, ambush: { g: '이▲', c: '#d0d0d0' },
  aim: { g: '대▲', c: '#d0d0d0' }, riposte: { g: '반▲', c: '#d0d0d0' }, critDmg: { g: '치▲', c: '#ffd08a' },
  pierceShot: { g: '관', c: '#d0d0d0' }, extraAmmo: { g: '탄', c: '#d0d0d0' }, counter: { g: '역', c: '#d0d0d0' }, fireShield: { g: '불', c: '#ff7a2a' },
  iceShield: { g: '빙', c: '#9fe8ff' }, frenzy: { g: '폭주', c: '#ff4a3a' },
};

/** 액터의 상태 배지 목록 (상태 + 원소 잔류) */
export function statusBadges(statuses: Partial<Record<StatusKind, number>>, aura?: { element: Element; turns: number }): Badge[] {
  const out: Badge[] = [];
  for (const [k, n] of Object.entries(statuses) as [StatusKind, number][]) {
    if (!n) continue;
    const s = STATUS_ICON[k];
    out.push({ g: s.g, c: s.c, n, tip: `${s.name} ${n}${k === 'poison' ? '중첩' : '턴'}` });
  }
  if (aura) out.push({ ...AURA_ICON[aura.element], n: aura.turns, tip: '원소 잔류 (다른 원소에 맞으면 복합 반응)' });
  return out;
}

/** HTML 배지 */
export function badgeHtml(b: Badge, title?: string): string {
  const t = title ?? b.tip;
  return `<span class="badge-ic" style="--bc:${b.c}" ${t ? `title="${t.replace(/"/g, '&quot;')}"` : ''}>${b.g}${b.n !== undefined ? `<i>${b.n}</i>` : ''}</span>`;
}
