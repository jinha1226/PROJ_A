import { ALERT_THRESHOLDS, BREAK_PENALTY, type Game } from '../core/game';
import { infuseOptions, starOf, suitModule } from '../data/infuse';
import type { Actor, GameEvent, ByproductInst, GroundItem, InjectionId, Slot, WeaponInst } from '../core/types';
import { INJECTION_BY_ID } from '../data/consumables';
import { badgeHtml, OPTION_ICON, statusBadges } from '../data/statusIcons';
import { COLOR_NAME, ELEMENT_NAME, FAMILY_NAME, GRADE_NAME, SLOT_NAME, STATUS_NAME } from '../core/types';
import { COLOR_STEP, colorLevel, isBroken, magOf, partArmorMax, signatureOf, traitsOf, weaponName } from '../core/stats';
import { FORM_NAME } from '../data/forms';
import { OPTION_BY_ID } from '../data/options';
import { ELITE_DAMAGE, RANGED_TRAITS, SIGNATURE, TRAIT_NAME, TRAIT_TEXT, WEAPON_BY_ID } from '../data/weapons';
import { isChainLine } from '../render/bridge';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function elDots(r: ByproductInst | { def: { elements: string[] } }) {
  return r.def.elements.map((e) => `<i class="el ${e}" title="${ELEMENT_NAME[e as keyof typeof ELEMENT_NAME]}"></i>`).join('');
}

export function byproductName(r: ByproductInst) {
  return `<span class="g-${r.def.grade}">${elDots(r)} ${esc(r.def.name)}</span>`;
}

/** 연쇄 기록 줄이 찍히는 속도 (글자당 밀리초) */
const TYPE_MS = 4;

/** HUD 테마 색 (CSS 변수). 테마가 바뀌면 clearThemeCache */
const themeCache = new Map<string, string>();
export function themeColor(name: string): string {
  let c = themeCache.get(name);
  if (!c) {
    c = getComputedStyle(document.body).getPropertyValue(`--${name}`).trim() || '#888';
    themeCache.set(name, c);
  }
  return c;
}
export const clearThemeCache = () => themeCache.clear();

const $ = (id: string) => document.getElementById(id)!;

/** 화면 가장자리 HUD (감시 카메라 녹화 화면풍).
 *  왼쪽 위 임무 · 오른쪽 위 체류·미니맵 · 위 가운데 행동 순서·최근 메시지
 *  왼쪽 아래 MODEL 이름·생체 신호·부위별 슈트 장갑·상태이상 · 가운데 아래 안내·경보 · 오른쪽 아래 무기·탄약·퀵슬롯 */
export class Hud {
  private tl = $('mission');
  private order = $('order');
  private tickerEl = $('ticker');
  private vname = $('vname');
  private hpnum = $('hpnum');
  private armor = $('armor');
  private statusRow = $('statusrow');
  private alertBar = $('alertbar');
  private warn = $('warn');
  private br = $('br');
  private logEl = $('log');
  private hint = $('hint');
  private tooltip = $('tooltip');
  private ecg = $('ecg') as HTMLCanvasElement;
  private minimap = $('minimap') as HTMLCanvasElement;
  private lit = new Map<string, number>();
  private ticker: { text: string; cls: string; at: number }[] = [];
  private game: Game | null = null;
  private phase = 0;
  private lastTick = performance.now();
  /** 타이핑 중인 기록 줄 (글자당 TYPE_MS) */
  private typing: { el: HTMLElement; text: string; at: number }[] = [];

  clearLog() {
    this.logEl.innerHTML = '';
    this.ticker = [];
    this.typing = [];
  }

  handleEvents(events: GameEvent[]) {
    const now = performance.now();
    for (const e of events) {
      if (e.type === 'log' && e.text) {
        // 기록 줄은 연출이 재생될 때 typeLine으로 한 줄씩 찍힌다. 각인 연쇄 줄은 머리 위에 뜨므로 최근 메시지에는 넣지 않는다
        if (isChainLine(e.cls)) continue;
        this.ticker.push({ text: e.text, cls: e.cls ?? '', at: now });
      }
      if (e.type === 'trigger' && e.text) this.lit.set(e.text, now);
    }
    this.ticker = this.ticker.slice(-4);
  }

  /** 기록 한 줄 (연출 순서대로): 빠르게 타이핑되듯 찍힌다 */
  typeLine(line: { text: string; cls: string }) {
    const d = document.createElement('div');
    d.className = line.cls;
    this.logEl.appendChild(d);
    this.typing.push({ el: d, text: line.text, at: performance.now() });
    while (this.logEl.children.length > 150) this.logEl.firstChild!.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  setHint(text: string, targeting = false) {
    this.hint.innerHTML = text;
    this.hint.classList.toggle('target', targeting);
  }

  toggleLog() {
    this.logEl.hidden = !this.logEl.hidden;
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  render(g: Game) {
    this.game = g;
    viewer = g.player;
    const p = g.player;
    const s = g.st(p);
    // 왼쪽 위: 미니맵 아래 현재 위치와 체류 턴
    if (g.lab) {
      const la = g.lastAction;
      this.tl.innerHTML = `<div class="cap amber">테스트</div><div class="big">무기 실험실</div><div class="sub2">[T] 무기·옵션 편집·초기화 · [E] 손 바꾸기</div>
        <div class="labstat">직전 행동<br>준 피해 <b>${la.damage}</b> · 치명타 <b>${la.crits}</b></div>`;
    } else {
    this.tl.innerHTML = `<div class="big">${esc(g.depthLabel)}</div><div class="sub2">체류 ${g.floorTurns}턴</div>`;
    }
    this.drawMap(this.minimap, g, 0);
    // 위 가운데: 적이 보일 때만 행동 순서
    const foes = g.visibleEnemies().length > 0;
    this.order.hidden = !foes;
    if (foes)
      this.order.innerHTML = g
        .turnOrder(10)
        .map((a, i) => `<div class="tok ${a.isPlayer ? 'player' : a.faction === 'player' ? 'ally' : 'enemy'} ${i === 0 ? 'first' : ''}" title="${esc(a.name)}">${a.isPlayer ? '0' : esc(a.name[0])}</div>`)
        .join('');
    // 왼쪽 아래: 이름 · 생체 · 장갑 · 상태
    const origin = p.name;
    const cl = p.colors;
    this.vname.innerHTML = `${esc(origin)} <span class="lv">Lv ${g.plevel}<span class="xp"><i style="width:${(g.xp / g.xpToNext()) * 100}%"></i></span></span>${cl ? ` <span class="colors">${(['power', 'tactics', 'survival'] as const).map((c) => `<span class="col ${c}">${COLOR_NAME[c]} ${cl[c]}</span>`).join(' ')}</span>` : ''}`;
    this.hpnum.innerHTML = `${Math.max(0, p.hp)}<small>/${s.maxHp}</small>${p.shield ? ` <span class="shield">+${p.shield}</span>` : ''}`;
    this.armor.innerHTML = (['body', 'arm', 'leg', 'sense'] as Slot[])
      .map((k) => {
        const max = partArmorMax(p, k);
        const cur = Math.max(0, p.partArmor[k]);
        const broken = isBroken(p, k);
        const segs = Array.from({ length: 10 }, (_, i) => `<i class="${max && cur > (i * max) / 10 ? 'on' : ''}"></i>`).join('');
        return `<div class="vrow"><span class="vl">${SLOT_NAME[k]}</span><span class="seg ${broken ? 'broken' : ''}">${segs}</span><span class="vv ${broken ? 'bad' : ''}">${broken ? '파손' : `${cur}/${max}`}</span></div>`;
      })
      .join('');
    // 상태는 아이콘 배지 (마우스를 올리면 이름과 남은 턴), 주사제는 남은 방 수
    const st = statusBadges(p.statuses).map((b) => badgeHtml(b));
    if (p.imbue) st.push(`<span class="dim">다음 공격 ${ELEMENT_NAME[p.imbue]}</span>`);
    for (const [k, n] of Object.entries(p.injections ?? {})) st.push(`<span class="good">${esc(INJECTION_BY_ID[k as InjectionId].name.replace(' 주사제', ''))} ${n}방</span>`);
    this.statusRow.innerHTML = `<span class="vl">이상</span><span>${st.length ? st.join(' ') : '<span class="dim">없음</span>'}</span>`;
    // 가운데 아래: 경보 게이지
    const last = ALERT_THRESHOLDS[ALERT_THRESHOLDS.length - 1]!;
    const segs = 24;
    const filled = Math.min(segs, Math.round((g.floorTurns / last) * segs));
    const marks = ALERT_THRESHOLDS.map((t) => Math.round((t / last) * segs));
    this.alertBar.innerHTML = `<span class="lbl">경보 ${g.alert}</span><span class="segs">${Array.from({ length: segs }, (_, i) => `<i class="${i < filled ? (g.alert >= 2 ? 'hot' : 'on') : ''} ${marks.includes(i + 1) ? 'mk' : ''}"></i>`).join('')}</span>
      <span class="thr">${ALERT_THRESHOLDS.map((t, i) => `<span class="${g.alert > i ? 'hit' : ''}">${i + 1}단계 ${t}턴</span>`).join(' · ')}</span>`;
    const warns: string[] = [];
    const here = g.mode === 'play' ? g.groundHere() : [];
    if (here.length) warns.push(`발밑: ${here.map((r) => esc(r.def.name)).join(', ')} — [G] 줍기`);
    this.warn.innerHTML = warns.map((w) => `<div>${w}</div>`).join('');
    // 오른쪽 아래: 무기 · 탄약 · 퀵슬롯
    const w = p.hands[p.activeHand];
    const spare = p.hands[1 - p.activeHand];
    const ammo =
      w?.def.mag !== undefined
        ? `<span class="ammo ${w.ammo ? '' : 'bad'}">${w.ammo}</span><span class="mag">/ ${magOf(w)}${w.def.recharge ? ' 충전' : ''}</span>`
        : `<span class="mag">${w && w.def.range > 1 ? `사거리 ${w.def.range}` : '근접'}</span>`;
    const keys = !w || w.def.range <= 1 ? '' : w.def.mag !== undefined && !w.def.recharge ? ' · [R] 재장전 · [F] 사격' : ' · [F] 사격';
    this.br.innerHTML = `<div class="wrow"><span class="wname" ${w ? `data-byproduct="${w.uid}"` : ''}>${w ? esc(weaponName(w)) : '맨주먹'}</span>${ammo}</div>
      <div class="sub2">[E] 예비: ${spare ? esc(weaponName(spare)) : '맨주먹'}${keys}</div>
      ${w && (w.options.length || w.infusion) ? `<div class="sub2 opts">${w.infusion?.trait ? `<span class="star" title="${esc(TRAIT_TEXT[w.infusion.trait])}">★</span> ` : ''}${[...w.options, ...(w.infusion?.options ?? [])].map((o) => badgeHtml(OPTION_ICON[o], OPTION_BY_ID[o].desc)).join(' ')}</div>` : ''}
      <div class="quick">${p.belt!
        .map((c, i) => `<div class="qs ${c ? '' : 'off'}" ${c ? `data-byproduct="${c.uid}"` : ''}><span class="k">${i + 3}</span><span class="n">${c ? esc(c.def.name.replace(' 주사제', '')) : '—'}</span></div>`)
        .join('')}<div class="qs ${g.flask ? '' : 'off'}"><span class="k">Q</span><span class="n">플라스크 ${g.flask}/${g.flaskMax}</span></div></div>`;
  }

  /** 매 프레임: 심전도와 최근 메시지 */
  tick() {
    const tnow = performance.now();
    if (this.typing.length) {
      for (const t of this.typing) t.el.textContent = t.text.slice(0, Math.ceil((tnow - t.at) / TYPE_MS));
      this.typing = this.typing.filter((t) => t.el.textContent!.length < t.text.length);
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.tickerEl.innerHTML = this.ticker
      .filter((t) => now - t.at < 5000)
      .map((t) => `<div class="${t.cls}" style="opacity:${Math.min(1, (5000 - (now - t.at)) / 1200).toFixed(2)}">${esc(t.text)}</div>`)
      .join('');
    const g = this.game;
    if (!g) return;
    const p = g.player;
    const max = g.st(p).maxHp;
    const r = Math.max(0, Math.min(1, p.hp / max));
    const bpm = 55 + (1 - r) * 95;
    this.phase += (dt * bpm) / 60;
    drawEcg(this.ecg, r, this.phase, p.dead || p.hp <= 0);
  }

  /** 미니맵 (scale 0이면 캔버스 크기에 맞춤) */
  drawMap(c: HTMLCanvasElement, g: Game, scale: number) {
    const lv = g.level;
    const k = scale || Math.max(1, Math.floor(Math.min(c.width / lv.w, c.height / lv.h)));
    const ox = Math.floor((c.width - lv.w * k) / 2),
      oy = Math.floor((c.height - lv.h * k) / 2);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let y = 0; y < lv.h; y++)
      for (let x = 0; x < lv.w; x++) {
        const i = lv.idx(x, y);
        if (!lv.explored[i] || !lv.isFloor(x, y)) continue;
        ctx.fillStyle = lv.visible[i] ? themeColor('map-seen') : themeColor('map-dim');
        ctx.fillRect(ox + x * k, oy + y * k, k, k);
      }
    const dot = (x: number, y: number, color: string, big = 0) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * k - big, oy + y * k - big, k + big * 2, k + big * 2);
    };
    for (const [i, items] of g.ground) if (items.length && lv.explored[i]) dot(i % lv.w, (i / lv.w) | 0, themeColor('map-item'));
    for (const f of lv.features) if (lv.explored[lv.idx(f.x, f.y)]) dot(f.x, f.y, themeColor('map-exit'), 1);
    for (const a of g.actors) if (!a.dead && a.faction === 'enemy' && lv.visible[lv.idx(a.x, a.y)]) dot(a.x, a.y, themeColor('danger'));
    dot(g.player.x, g.player.y, themeColor('map-player'), 1);
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

  /** [I] 슈트 화면: 가운데 슈트 실루엣과 부위 칸(장갑·끼운 부산물·장점과 대가), 왼쪽 손 2칸, 오른쪽 회로와 능력치 */
  suitScreen(g: Game): string {
    const p = g.player;
    const s = g.st(p);
    const cl = p.colors!;
    // 부위 상태: 장갑 비율로 색
    const state = (slot: Slot): { cls: string; ratio: number } => {
      const max = partArmorMax(p, slot);
      const r = max ? Math.max(0, p.partArmor[slot]) / max : 1;
      return { cls: isBroken(p, slot) ? 'broken' : r < 0.5 ? 'warn' : 'ok', ratio: r };
    };
    const part = (slot: Slot) => {
      const st = state(slot);
      const max = partArmorMax(p, slot);
      const mod = p.slots[slot][0];
      const segs = Array.from({ length: 10 }, (_, k) => `<i class="${max && Math.max(0, p.partArmor[slot]) > (k * max) / 10 ? 'on' : ''}"></i>`).join('');
      const m = mod ? suitModule(mod.def) : null;
      return `<div class="sp sp-${slot} ${st.cls}">
        <div class="sp-h"><b>${SLOT_NAME[slot]}</b><span>${isBroken(p, slot) ? '파손' : `${Math.max(0, p.partArmor[slot])}/${max}`}</span></div>
        <div class="seg ${isBroken(p, slot) ? 'broken' : ''}">${segs}</div>
        ${
          mod
            ? `<div class="sp-mod" data-byproduct="${mod.uid}">${byproductName(mod)}</div>${m!.pros.map((x) => `<div class="up">+ ${esc(x)}</div>`).join('')}${m!.cons.map((x) => `<div class="warnc">− ${esc(x)}</div>`).join('')}`
            : `<div class="sp-empty">빈 칸 · ${SLOT_NAME[slot]} 부산물을 끼울 수 있다</div>`
        }
        <div class="sp-break">파손 시: ${BREAK_PENALTY[slot]}</div>
      </div>`;
    };
    const fill = (slot: Slot) => `class="sv-${state(slot).cls}"`;
    const svg = `<svg class="suit-svg" viewBox="0 0 200 320" aria-hidden="true">
      <g ${fill('sense')}><path d="M78 18 Q100 4 122 18 L126 50 Q100 62 74 50 Z"/><rect class="visor" x="82" y="28" width="36" height="9" rx="3"/></g>
      <g ${fill('body')}><path d="M66 64 L134 64 L142 132 L124 168 L76 168 L58 132 Z"/><path class="line" d="M100 70 L100 160 M72 100 L128 100"/></g>
      <g ${fill('arm')}><path d="M60 66 L40 74 L28 140 L40 186 L52 184 L48 142 L62 100 Z"/><path d="M140 66 L160 74 L172 140 L160 186 L148 184 L152 142 L138 100 Z"/></g>
      <g ${fill('leg')}><path d="M76 172 L98 172 L96 250 L92 306 L72 306 L74 250 Z"/><path d="M102 172 L124 172 L126 250 L128 306 L108 306 L104 250 Z"/></g>
    </svg>`;
    const hands = p.hands
      .map((w, i) => `<div class="card ${i === p.activeHand ? 'sel' : ''}" style="cursor:default"><div class="nm">손${i + 1}${i === p.activeHand ? ' (들고 있음)' : ''}</div>${w ? weaponTooltip(w) : '<div class="ds">맨주먹</div>'}</div>`)
      .join('');
    const right = `<h3>회로</h3><div class="circuits">${(['power', 'tactics', 'survival'] as const).map((c) => `<div><span class="col ${c}">${COLOR_NAME[c]}</span> <b>${cl[c]}</b></div>`).join('')}</div>
      <h3>능력치</h3><div class="stats">
        <span>체력 <b>${Math.max(0, p.hp)}/${s.maxHp}</b></span><span>슈트 장갑 <b>${s.armor}/${s.armorMax}</b></span>
        <span>피해 <b>${s.damage}</b></span><span>회피 <b>${s.dodge}%</b></span>
        <span>이동 <b>${speed(s.moveCost)}칸/턴</b></span><span>공격 <b>${speed(s.attackCost)}회/턴</b></span>
        <span>시야 <b>${s.sight}</b></span><span>마석 <b>${g.ash}</b></span>
      </div>
      <h3>상태</h3><div>${statusBadges(p.statuses).map((b) => badgeHtml(b)).join(' ') || '<span style="color:var(--dim)">없음</span>'}</div>`;
    return `<div class="box suit"><h2>슈트 — ${esc(p.name)}</h2>
      <div class="suit-lay">
        <div class="suit-hands"><h3>손</h3>${hands}</div>
        <div class="suit-body">${part('sense')}${part('arm')}<div class="suit-fig">${svg}</div>${part('body')}${part('leg')}</div>
        <div class="suit-side">${right}</div>
      </div>
      <div class="row"><button class="ghost" data-act="close">닫기 (I / Esc)</button></div></div>`;
  }
}

/** 심전도: 체력 비율만큼 살아 있는 파형, 나머지는 일자선. 체력이 낮을수록 빠르고 불규칙하고 붉다 */
function drawEcg(c: HTMLCanvasElement, r: number, phase: number, dead: boolean) {
  const ctx = c.getContext('2d')!;
  const W = c.width,
    H = c.height,
    mid = H / 2;
  ctx.clearRect(0, 0, W, H);
  const split = dead ? 0 : Math.max(2, Math.round(W * r));
  const color = dead ? themeColor('ecg-bad') : r > 0.6 ? themeColor('ecg-ok') : r > 0.3 ? themeColor('ecg-mid') : themeColor('ecg-bad');
  // 나머지: 어두운 일자선
  ctx.strokeStyle = dead ? themeColor('ecg-bad') : themeColor('ecg-base');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(split, mid);
  ctx.lineTo(W, mid);
  ctx.stroke();
  if (dead) return;
  const beatsShown = 3;
  const wave = (u: number, beat: number) => {
    // 낮은 체력: 박동마다 세기가 흔들리고, 가끔 박동이 빠진다
    const jitter = r < 0.35 ? (1 - r / 0.35) : 0;
    const h = Math.sin(beat * 12.9898) * 43758.5453;
    const rnd = h - Math.floor(h);
    if (jitter && rnd < jitter * 0.3) return 0;
    const amp = 1 - jitter * rnd * 0.6;
    const bump = (c0: number, w: number, a: number) => a * Math.exp(-(((u - c0) / w) ** 2));
    return amp * (bump(0.12, 0.04, 0.12) - bump(0.27, 0.012, 0.18) + bump(0.3, 0.018, 1) - bump(0.33, 0.014, 0.3) + bump(0.55, 0.06, 0.25));
  };
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  for (let x = 0; x <= split; x++) {
    const t = phase - ((split - x) / W) * beatsShown;
    const beat = Math.floor(t);
    const y = mid - wave(t - beat, beat) * (H * 0.42);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 쓰는 점
  ctx.fillStyle = color;
  ctx.fillRect(split - 1, mid - 1, 3, 3);
}

export function byproductTooltip(r: ByproductInst): string {
  const d = r.def;
  const mod = suitModule(d);
  const star = starOf(d);
  const weapon = infuseOptions(d)
    .map((o) => (OPTION_BY_ID[o].kind === 'hit' ? `${OPTION_ICON[o].g} 부여` : OPTION_ICON[o].g))
    .join(' · ');
  const suit = [...mod.pros.map((x) => esc(x)), ...mod.cons.map((x) => `<span style="color:var(--warn)">${esc(x)}</span>`)].join(' · ');
  return `<div class="t g-${d.grade}">${elDots(r)} ${esc(d.name)}</div>
    <div class="r">${GRADE_NAME[d.grade]} · 강화 재료</div>
    <div class="r"><b>무기:</b> ${esc(weapon)}</div>
    ${star ? `<div class="r trait"><b>★ ${esc(TRAIT_NAME[star] ?? '')}</b> ${esc(TRAIT_TEXT[star])}${SIGNATURE[star] ? ` <span style="color:var(--dim)">(${esc(WEAPON_BY_ID[SIGNATURE[star]!.weapon]!.name)}에 넣으면 고유 이름)</span>` : ''}</div>` : ''}
    <div class="r"><b>슈트(${SLOT_NAME[d.slot]}):</b> ${suit}</div>`;
}

export function actorTooltip(g: Game, a: Actor): string {
  const s = g.st(a);
  const byproducts = (['arm', 'body', 'leg', 'sense'] as Slot[]).flatMap((k) => a.slots[k]).filter((r): r is ByproductInst => !!r);
  const st = Object.entries(a.statuses).map(([k, v]) => `${STATUS_NAME[k as keyof typeof STATUS_NAME]} ${v}`);
  if (a.marked) st.push('표식');
  return `<div class="t">${esc(a.name)}${a.boss ? ' (보스)' : a.elite ? ' (정예)' : ''}</div>
    <div class="r">체력 ${a.hp}/${s.maxHp} · 장갑 ${s.armor} · 피해 ${s.damage} · 회피 ${s.dodge}% · 이동 ${speed(s.moveCost)}칸/턴</div>
    ${st.length ? `<div style="color:var(--warn)">${st.join(' · ')}</div>` : ''}
    ${byproducts.map((r) => `<div>${byproductName(r)}${isBroken(a, r.def.slot) ? ' <span class="badge bad">½</span>' : ''}${r.def.active ? ` <span class="r">— ${r.def.active.element ? ELEMENT_NAME[r.def.active.element] : ''} ${FORM_NAME[r.def.active.form]}${r.cd ? ` (${r.cd})` : ''}</span>` : ''}</div>`).join('')}
    ${a.dropChance ? `<div class="r">부산물 회수 확률 ${Math.round(a.dropChance * 100)}%</div>` : ''}`;
}

/** 툴팁 수치에 색 레벨을 반영할 플레이어 (render마다 갱신) */
let viewer: Actor | null = null;

export function weaponTooltip(w: WeaponInst): string {
  const d = w.def;
  const lv = viewer ? colorLevel(viewer, d) : 0;
  const bonus = lv ? ` <span class="up">(회로 ${lv}: +${Math.round(COLOR_STEP * 100 * lv)}%)</span>` : '';
  const ammo = d.mag === undefined ? '' : d.recharge ? `충전 ${w.ammo}/${magOf(w)} (${d.recharge}턴마다 1)` : `탄창 ${w.ammo}/${magOf(w)}`;
  const dmg = Math.round(d.damage * (w.elite ? ELITE_DAMAGE : 1));
  const parts = [`피해 ${dmg}${bonus}`, `공격 ${speed(d.attackCost)}회/턴`, d.range > 1 ? `사거리 ${d.range}` : '근접', ammo].filter(Boolean);
  const colors = d.colors.map((c) => `<span class="col ${c}">${COLOR_NAME[c]}</span>`).join(' ');
  const sig = signatureOf(w);
  const traits = traitsOf(w)
    .map((t) => {
      const ranged = RANGED_TRAITS.has(t) && d.range <= 1 ? ' <span style="color:var(--warn)">(이 무기에서는 발동하지 않음)</span>' : '';
      const pair = SIGNATURE[t];
      const hint = t === sig ? ' <span class="up">— 맞는 짝</span>' : pair && t === w.infusion?.trait ? ` <span style="color:var(--dim)">— ${esc(WEAPON_BY_ID[pair.weapon]!.name)}에 넣으면 고유 이름</span>` : '';
      return `<div class="r trait">★ ${TRAIT_NAME[t] ? `<b>${esc(TRAIT_NAME[t]!)}</b> ` : ''}${esc(TRAIT_TEXT[t])}${ranged}${hint}</div>`;
    })
    .join('');
  const opts = [...w.options, ...(w.infusion?.options ?? [])]
    .map((o) => {
      const od = OPTION_BY_ID[o];
      return `<div class="r opt ${od.kind}">${badgeHtml(OPTION_ICON[o])} ${esc(od.desc)}</div>`;
    })
    .join('');
  const inf = w.infusion ? `<div class="r opt infused"><b>⬡ 부여: ${esc(w.infusion.from)}</b></div>` : `<div class="r" style="color:var(--dim)">⬡ 부여 칸 비어 있음 (정예·보스 부산물을 넣으면 ★)</div>`;
  return `<div class="t ${w.elite ? 'g-holy' : 'g-common'}">⚔ ${esc(weaponName(w))}</div><div class="r">${w.elite ? '정예' : '일반'} ${esc(d.name)} · ${FAMILY_NAME[d.family]} · ${colors}</div><div class="r">${parts.join(' · ')}</div>${traits}${opts}${inf}`;
}

export function itemTooltip(r: GroundItem): string {
  if (r.kind === 'consumable') return `<div class="t">✚ ${esc(r.def.name)}</div><div class="r">${esc(r.def.desc)} · ${r.def.rooms}방 동안</div><div class="r" style="color:var(--dim)">밟으면 벨트에 들어간다 (3 · 4 · 5)</div>`;
  return r.kind === 'weapon' ? weaponTooltip(r) : byproductTooltip(r);
}

/** 행동 비용 → 1턴(100)당 속도 */
export function speed(cost: number): string {
  return (100 / cost).toFixed(1);
}
