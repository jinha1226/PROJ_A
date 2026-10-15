import type { Element, OptionId, StatusKind } from '../core/types';

// 상태·옵션 배지: 색 배지에 줄이지 않은 이름. HUD와 캐릭터 머리 위에서 같은 모양을 쓴다.

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
  burn: { g: '화상', c: '#ff7a2a', name: '화상' },
  slow: { g: '둔화', c: '#7ab8ff', name: '둔화' },
  freeze: { g: '빙결', c: '#9fe8ff', name: '빙결' },
  stun: { g: '기절', c: '#ffe066', name: '기절' },
  blind: { g: '실명', c: '#b0a8a0', name: '실명' },
  bleed: { g: '출혈', c: '#e8384a', name: '출혈' },
  poison: { g: '중독', c: '#7ad04a', name: '중독' },
  oil: { g: '기름', c: '#c8a040', name: '기름' },
};

/** 원소 잔류 (복합 반응의 재료) */
export const AURA_ICON: Record<Element, { g: string; c: string }> = {
  fire: { g: '화염 잔류', c: '#ff9a50' },
  cold: { g: '냉기 잔류', c: '#9fd8ff' },
  lightning: { g: '번개 잔류', c: '#ffe680' },
  impact: { g: '충격 잔류', c: '#c09060' },
};

/** 무기 옵션: 줄이지 않은 짧은 문구 (자세한 설명은 마우스를 올리면) */
export const OPTION_ICON: Record<OptionId, { g: string; c: string }> = {
  fire: STATUS_ICON.burn, cold: STATUS_ICON.freeze, lightning: { g: '번개', c: '#ffe680' }, impact: { g: '충격', c: '#c09060' },
  bleed: STATUS_ICON.bleed, poison: STATUS_ICON.poison, oil: STATUS_ICON.oil, leech: { g: '장갑 회수', c: '#7fd6c0' },
  corpseBlast: { g: '처치 시 폭발', c: '#ff9a50' }, deathFreeze: { g: '처치 시 빙결', c: '#9fe8ff' }, deathFlame: { g: '처치 시 불길', c: '#ff7a2a' },
  burnDmg: { g: '화상 적 +60%', c: '#ff7a2a' }, bleedDmg: { g: '출혈 적 +50%', c: '#e8384a' }, poisonDmg: { g: '중독 적 +15%/중첩', c: '#7ad04a' }, freezeDmg: { g: '빙결 적 +100%', c: '#9fe8ff' },
  stunDmg: { g: '기절 적 +60%', c: '#ffe066' }, fullHp: { g: '장갑 가득 +40%', c: '#9fd6ff' }, despair: { g: '체력 절반 이하 +30%', c: '#ff8a7a' }, ambush: { g: '이동 직후 +40%', c: '#d0d0d0' },
  aim: { g: '대기 직후 +60%', c: '#d0d0d0' }, riposte: { g: '맞은 직후 +50%', c: '#d0d0d0' }, critDmg: { g: '치명타 +0.5배', c: '#ffd08a' },
  pierceShot: { g: '관통', c: '#d0d0d0' }, extraAmmo: { g: '탄창 +3', c: '#d0d0d0' }, counter: { g: '막은 뒤 +200%', c: '#d0d0d0' }, fireShield: { g: '막으면 화상', c: '#ff7a2a' },
  iceShield: { g: '막으면 빙결', c: '#9fe8ff' }, frenzy: { g: '폭주', c: '#ff4a3a' },
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
