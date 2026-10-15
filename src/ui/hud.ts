import type { Game } from '../core/game';
import { describeEffect, describeRelic } from '../core/describe';
import type { Actor, GameEvent, RelicInst, Slot } from '../core/types';
import { ELEMENT_NAME, SLOT_NAME, STATUS_NAME, TRIGGERS, TRIGGER_NAME } from '../core/types';
import { FORM_NAME } from '../data/forms';
import { GODS } from '../data/start';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function elDots(r: RelicInst | { def: { elements: string[] } }) {
  return r.def.elements.map((e) => `<i class="el ${e}" title="${ELEMENT_NAME[e as keyof typeof ELEMENT_NAME]}"></i>`).join('');
}

export function relicName(r: RelicInst) {
  return `<span class="g-${r.def.grade}">${elDots(r)} ${esc(r.def.name)}</span>`;
}

/** HTML/CSS 오버레이: 행동 순서 바, 유물 슬롯, 각인 목록, 로그 */
export class Hud {
  private logEl = document.getElementById('log')!;
  private left = document.getElementById('left')!;
  private right = document.getElementById('right')!;
  private order = document.getElementById('order')!;
  private depth = document.getElementById('depth')!;
  private alert = document.getElementById('alert')!;
  private hint = document.getElementById('hint')!;
  private tooltip = document.getElementById('tooltip')!;
  private lit = new Map<string, number>();

  clearLog() {
    this.logEl.innerHTML = '';
  }

  handleEvents(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === 'log') {
        const d = document.createElement('div');
        d.className = e.cls ?? '';
        d.textContent = e.text ?? '';
        this.logEl.appendChild(d);
      }
      if (e.type === 'trigger' && e.text) this.lit.set(e.text, performance.now());
    }
    while (this.logEl.children.length > 120) this.logEl.firstChild!.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setHint(text: string, targeting = false) {
    this.hint.innerHTML = text;
    this.hint.classList.toggle('target', targeting);
  }

  render(g: Game) {
    const p = g.player;
    const s = g.st(p);
    // 상단
    this.depth.innerHTML = `<b>${esc(g.depthLabel)}</b> <span style="color:var(--dim)">· 체류 ${g.floorTurns}턴</span>`;
    this.alert.innerHTML = `경보 ${[0, 1, 2].map((i) => `<span class="pip ${g.alert > i ? 'on' : ''}"></span>`).join('')}`;
    const order = g.turnOrder(12);
    this.order.innerHTML = order
      .map((a, i) => `<div class="tok ${a.isPlayer ? 'player' : a.faction === 'player' ? 'ally' : 'enemy'} ${i === 0 ? 'first' : ''}" title="${esc(a.name)}">${a.isPlayer ? '나' : esc(a.name[0])}</div>`)
      .join('');

    // 왼쪽: 심장 + 능력치 + 유물
    const hpPct = Math.max(0, (p.hp / s.maxHp) * 100);
    const shPct = Math.min(100, (p.shield / s.maxHp) * 100);
    let html = `<h3>심장</h3>
      <div class="bar"><i style="width:${hpPct}%"></i>${p.shield ? `<b style="width:${shPct}%"></b>` : ''}<span>${p.hp} / ${s.maxHp}${p.shield ? ` (+${p.shield} 보호막)` : ''}</span></div>
      <div class="bar xp"><i style="width:${(g.xp / g.xpToNext()) * 100}%"></i></div>
      <div class="stats">
        <span>레벨 <b>${g.plevel}</b></span><span>잿가루 <b>${g.ash}</b></span>
        <span>장갑 <b>${s.armor}</b></span><span>회피 <b>${s.dodge}%</b></span>
        <span>피해 <b>${s.damage}</b></span><span>시야 <b>${s.sight}</b></span>
        <span>이동 비용 <b>${s.moveCost}</b></span><span>공격 비용 <b>${s.attackCost}</b></span>
        <span>부담 <b class="${s.burden > s.burdenCap ? 'over' : ''}">${s.burden}/${s.burdenCap}</b></span><span>수리 키트 <b>${g.kits}</b></span>
      </div>`;
    const st = Object.entries(p.statuses).map(([k, v]) => `${STATUS_NAME[k as keyof typeof STATUS_NAME]} ${v}`);
    if (p.aura) st.push(`${ELEMENT_NAME[p.aura.element]} 잔류`);
    if (p.imbue) st.push(`다음 공격: ${ELEMENT_NAME[p.imbue]}`);
    if (p.haste) st.push(`가속 ${p.haste}%`);
    if (st.length) html += `<div style="margin-top:4px;color:#e0a050;font-size:12px">${st.join(' · ')}</div>`;

    let armIdx = 0;
    for (const slot of ['arm', 'body', 'leg', 'sense'] as Slot[]) {
      html += `<h3>${SLOT_NAME[slot]}</h3>`;
      p.slots[slot].forEach((r, i) => {
        if (!r) {
          html += `<div class="slot empty"><span class="k">${SLOT_NAME[slot]}${i + 1}</span><span class="n">비어 있음</span></div>`;
          return;
        }
        const badges: string[] = [];
        if (r.fixed) badges.push('<span class="badge fixed">고정</span>');
        if (r.damaged) badges.push('<span class="badge bad">손상</span>');
        if (r.dormant) badges.push('<span class="badge bad">잠듦</span>');
        if (r.upgrade) badges.push(`<span class="badge">+${r.upgrade}</span>`);
        let sub = '';
        if (r.def.active) {
          const k = ++armIdx;
          const a = r.def.active;
          badges.push(r.cd > 0 ? `<span class="badge cd">[${k}] ${r.cd}</span>` : `<span class="badge ready">[${k}] 준비</span>`);
          sub = `${a.element ? ELEMENT_NAME[a.element] + ' ' : ''}${FORM_NAME[a.form]} ${a.power}`;
        }
        if (slot === 'body') sub = `장갑 ${r.integrity}/${r.def.stats.integrity ?? 0}`;
        html += `<div class="slot ${r.damaged ? 'damaged' : ''} ${r.dormant ? 'dormant' : ''}" data-relic="${r.uid}">
          <span class="k">${SLOT_NAME[slot]}${i + 1}</span>
          <span class="n">${relicName(r)}${sub ? `<div class="sub">${sub}</div>` : ''}</span><span>${badges.join('')}</span></div>`;
      });
    }
    this.left.innerHTML = html;

    // 오른쪽: 각인 + 신앙 + 발밑
    const now = performance.now();
    let rh = `<h3>각인 ${p.engravings.length} / ${g.engravingCap()}</h3>`;
    // 행동별로 묶어서: "공격할 때" 아래에 그 행동에 붙은 각인들
    for (const trig of TRIGGERS) {
      const list = p.engravings.filter((e) => e.trigger === trig);
      if (!list.length) continue;
      rh += `<div class="trig-head">${TRIGGER_NAME[trig]}</div>`;
      for (const e of list) {
        const t = this.lit.get(e.name);
        const lit = t !== undefined && now - t < 700;
        rh += `<div class="eng ${lit ? 'lit' : ''}"><div class="nm">${esc(e.name)}</div><div class="ds">→ ${esc(describeEffect(e.effect))}</div></div>`;
      }
    }
    if (g.god) {
      const god = GODS.find((x) => x.id === g.god!.id)!;
      const tier = g.godTier();
      rh += `<h3>신앙</h3><div><b style="color:var(--brass)">${esc(god.name)}</b> · 신앙 ${g.god.piety}</div>
        <div style="color:var(--dim);font-size:11.5px">${esc(god.law)}</div>
        ${god.boons.map((b, i) => `<div style="font-size:12px;color:${tier > i ? 'var(--good)' : '#5a4c3a'}">${'Ⅰ Ⅱ Ⅲ'.split(' ')[i]} ${esc(b)} <span style="color:var(--dim)">(${[3, 7, 12][i]})</span></div>`).join('')}`;
    }
    const here = g.mode === 'play' ? g.groundHere() : [];
    if (here.length) {
      rh += `<h3>발밑</h3>`;
      for (const r of here) rh += `<div class="slot" data-relic="${r.uid}"><span class="n">${relicName(r)}${r.damaged ? ' <span class="badge bad">손상</span>' : ''}<div class="sub">${esc(describeRelic(r.def)[1])}</div></span></div>`;
      rh += `<div style="color:var(--dim);font-size:11.5px">[G] 접목 · [F] 봉헌</div>`;
    }
    this.right.innerHTML = rh;
  }

  showTooltip(html: string | null, x = 0, y = 0) {
    if (!html) {
      this.tooltip.hidden = true;
      return;
    }
    this.tooltip.hidden = false;
    this.tooltip.innerHTML = html;
    const w = this.tooltip.offsetWidth,
      h = this.tooltip.offsetHeight;
    this.tooltip.style.left = `${Math.min(window.innerWidth - w - 8, x + 16)}px`;
    this.tooltip.style.top = `${Math.min(window.innerHeight - h - 8, y + 12)}px`;
  }
}

export function relicTooltip(r: RelicInst): string {
  const lines = describeRelic(r.def);
  return `<div class="t g-${r.def.grade}">${elDots(r)} ${esc(r.def.name)}${r.damaged ? ' (손상)' : ''}${r.dormant ? ' (잠듦)' : ''}</div>${lines.map((l) => `<div class="r">${esc(l)}</div>`).join('')}`;
}

export function actorTooltip(g: Game, a: Actor): string {
  const s = g.st(a);
  const relics = (['arm', 'body', 'leg', 'sense'] as Slot[]).flatMap((k) => a.slots[k]).filter((r): r is RelicInst => !!r);
  const st = Object.entries(a.statuses).map(([k, v]) => `${STATUS_NAME[k as keyof typeof STATUS_NAME]} ${v}`);
  if (a.aura) st.push(`${ELEMENT_NAME[a.aura.element]} 잔류`);
  if (a.marked) st.push('표식');
  return `<div class="t">${esc(a.name)}${a.boss ? ' (수문장)' : a.elite ? ' (정예)' : ''}</div>
    <div class="r">체력 ${a.hp}/${s.maxHp} · 장갑 ${s.armor} · 피해 ${s.damage} · 회피 ${s.dodge}% · 이동 ${s.moveCost}</div>
    ${st.length ? `<div style="color:#e0a050">${st.join(' · ')}</div>` : ''}
    ${relics.map((r) => `<div>${relicName(r)}${r.damaged ? ' <span class="badge bad">손상</span>' : ''}${r.def.active ? ` <span class="r">— ${r.def.active.element ? ELEMENT_NAME[r.def.active.element] : ''} ${FORM_NAME[r.def.active.form]}${r.cd ? ` (${r.cd})` : ''}</span>` : ''}</div>`).join('')}
    ${a.engravings.length ? `<div class="r">각인: ${a.engravings.map((e) => esc(e.name)).join(', ')}</div>` : ''}
    ${a.dropChance ? `<div class="r">유물 회수 확률 ${Math.round(a.dropChance * 100)}%</div>` : ''}`;
}
