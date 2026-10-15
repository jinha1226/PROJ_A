import { Game, OVERLOAD_NAME, REST_NAME, MAX_KITS, type OverloadMode } from './core/game';
import { describeEffect, describeEngraving } from './core/describe';
import type { Element, ByproductInst, GroundItem, WeaponInst } from './core/types';
import { ELEMENTS, ELEMENT_NAME, SLOT_NAME, SLOTS, TRIGGER_NAME, TRIGGER_SHORT, TRIGGERS } from './core/types';
import { FORM_NEEDS_TARGET } from './data/forms';
import { BODIES, GODS, ORIGINS } from './data/start';
import { loadAssets, View3D, type Pace } from './render/view3d';
import { actorTooltip, esc, Hud, byproductName, byproductTooltip, itemTooltip, weaponTooltip } from './ui/hud';
import { heldWeapon } from './core/stats';

const view = document.getElementById('view')!;
const modal = document.getElementById('modal')!;
const hudEl = document.getElementById('hud')!;
let renderer!: View3D;
const hud = new Hud();

let game: Game | null = null;
/** arm = -1 이면 무기 사격 조준 */
let targeting: { arm: number; x: number; y: number } | null = null;
let overlay: null | 'install' | 'overload' | 'help' | 'suit' | 'map' | 'lab' = null;
let installItem: GroundItem | null = null;
let overloadSel: ByproductInst | null = null;
let engraveSel: string | null = null;
let auto: null | { kind: 'explore' } | { kind: 'travel'; x: number; y: number } = null;
let autoHp = 0;

// ─────────────── 타이틀 ───────────────
let pickOrigin = ORIGINS[0].id;
let pickBody = BODIES[0].id;

function showTitle() {
  hudEl.hidden = true;
  modal.hidden = false;
  const seed = (document.getElementById('seed') as HTMLInputElement | null)?.value ?? randomSeed();
  modal.innerHTML = `<div class="box title">
    <h1>MODEL 0</h1>
    <div class="sub">판타지 세계에 추락한 클론. 몬스터의 부산물을 슈트에 끼우고, 연료를 모아 탈출한다.</div>
    <h3>MODEL 라인 — 클론의 몸</h3>
    <div class="cards">${ORIGINS.map((o) => `<div class="card ${o.id === pickOrigin ? 'sel' : ''}" data-origin="${o.id}"><div class="nm">${esc(o.name)}</div><div class="ds">${esc(o.desc)}</div></div>`).join('')}</div>
    <h3>슈트 프레임 — 부위 슬롯 구성</h3>
    <div class="cards">${BODIES.map((b) => `<div class="card ${b.id === pickBody ? 'sel' : ''}" data-body="${b.id}"><div class="nm">${esc(b.name)}</div><div class="ds">${esc(b.desc)}</div></div>`).join('')}</div>
    <div class="row"><span style="color:var(--dim)">시드</span><input id="seed" value="${esc(seed)}" size="16"/>
      <button class="ghost" data-act="reseed">무작위</button><span style="flex:1"></span><button class="ghost" data-act="lab">각인 실험실 (테스트)</button><button data-act="start">출격 (Enter)</button></div>
    ${keysHelp()}
  </div>`;
  bind(modal, {
    start: () => startGame(),
    lab: () => startGame(true),
    reseed: () => {
      (document.getElementById('seed') as HTMLInputElement).value = randomSeed();
    },
  });
  modal.querySelectorAll<HTMLElement>('[data-origin]').forEach((el) => (el.onclick = () => ((pickOrigin = el.dataset.origin!), showTitle())));
  modal.querySelectorAll<HTMLElement>('[data-body]').forEach((el) => (el.onclick = () => ((pickBody = el.dataset.body!), showTitle())));
}

function keysHelp() {
  const rows: [string, string][] = [
    ['방향키 · hjkl yubn · 숫자패드', '이동 / 공격'],
    ['. 또는 Space', '제자리 대기'],
    ['o', '오토탐험'],
    ['x', '출구로 자동 이동'],
    ['>', '출구에서 보급 지점으로'],
    ['1 2 3', '팔 부산물 액티브 (Tab 대상 변경)'],
    ['g', '발밑 부산물 장착 · 무기 줍기'],
    ['f', '사격 (원거리 무기, Tab 대상 변경)'],
    ['r', '재장전 (대기로 침)'],
    ['e', '무기 교체 (손 1 ↔ 2)'],
    ['c', '과부하 (부산물을 태움)'],
    ['q', '응급 키트'],
    ['i', '슈트 화면 (부산물·각인)'],
    ['Tab', '구역 지도'],
    ['m', '기록(메시지) 보기'],
    ['p', 'HD / 도트 전환'],
    ['v', '연출 속도 (보통 · 빠름 · 즉시)'],
    ['t', '각인 실험실: 각인 편집·초기화'],
    ['마우스', '클릭 이동·조준, 휠 확대, 올리면 정보'],
  ];
  return `<div class="keys">${rows.map(([k, d]) => `<div><b>${esc(k)}</b> ${d}</div>`).join('')}</div>`;
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function startGame(lab = false) {
  const seed = (document.getElementById('seed') as HTMLInputElement).value.trim() || randomSeed();
  game = new Game(seed, pickOrigin, pickBody, { lab });
  hud.clearLog();
  renderer.setGame(game);
  // 개발 모드에서만: 브라우저 테스트가 게임 상태를 볼 수 있게
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __view: renderer });
  hudEl.hidden = false;
  modal.hidden = true;
  overlay = null;
  targeting = null;
  auto = null;
  game.log(`시드 ${seed}. 복제 포드에서 깨어난 클론이 던전으로 내려간다.`, 'floor');
  refresh();
}

// ─────────────── 갱신 ───────────────
function refresh() {
  if (!game) return;
  const ev = game.drainEvents();
  renderer.handleEvents(ev);
  hud.handleEvents(ev);
  hud.render(game);
  renderer.setReticle(targeting ? targeting.x : null, targeting?.y);
  if (targeting) hud.setHint('조준 중 — Tab: 다음 대상 · 클릭: 지점 선택 · Enter/같은 키: 발사 · Esc: 취소', true);
  else {
    const f = game.level.featureAt(game.player.x, game.player.y);
    hud.setHint(f?.kind === 'exit' ? '[&gt;] 보급 지점으로 이동' : auto ? '자동 이동 중… (아무 키나 눌러 중단)' : 'o 오토탐험 · 클릭 이동 · ? 도움말');
  }
  renderModal();
}

// 트리거 하이라이트가 사라지도록 주기적으로 HUD 갱신
setInterval(() => {
  if (game && modal.hidden) hud.render(game);
}, 350);

// ─────────────── 모달 ───────────────
function renderModal() {
  const g = game!;
  if (g.mode === 'dead' || g.mode === 'won') return showEnd();
  if (g.mode === 'levelup') return showEngravePick('레벨 업 — 새 각인', '몸에 새길 문장을 하나 고른다. 각인은 런이 끝날 때까지 잃지 않는다.');
  if (g.mode === 'altar') return showAltar();
  if (overlay === 'install') return showInstall();
  if (overlay === 'overload') return showOverload();
  if (overlay === 'lab') return showLab();
  if (overlay === 'suit') {
    modal.hidden = false;
    modal.innerHTML = hud.suitScreen(g);
    bind(modal, { close: closeOverlay });
    return;
  }
  if (overlay === 'map') {
    modal.hidden = false;
    const lv = g.level;
    const k = Math.max(4, Math.floor(Math.min((window.innerWidth * 0.8) / lv.w, (window.innerHeight * 0.7) / lv.h)));
    modal.innerHTML = `<div class="box mapbox"><h2>구역 지도 — ${esc(g.depthLabel)}</h2><canvas id="bigmap" width="${lv.w * k}" height="${lv.h * k}"></canvas>
      <p class="lead">청록 = 나 · 금색 = 출구 · 주황 = 제단 · 보라 = 바닥의 물건 · 빨강 = 보이는 적</p><div class="row"><button class="ghost" data-act="close">닫기 (Tab / Esc)</button></div></div>`;
    hud.drawMap(document.getElementById('bigmap') as HTMLCanvasElement, g, k);
    bind(modal, { close: closeOverlay });
    return;
  }
  if (overlay === 'help') {
    modal.hidden = false;
    modal.innerHTML = `<div class="box"><h2>도움말</h2>${keysHelp()}
      <p class="lead" style="margin-top:12px">부산물은 몬스터에게서 얻어 슈트 부위에 장착한다. 맞으면 맞은 부위(몸·팔·다리·감각)의 슈트 장갑이 먼저 깎이고, 0이 되면 그 부위가 파손되어 거기 붙은 부산물의 효과가 절반이 된다. 보급 지점에서 모두 수리된다.
      완전 파괴는 오직 <b>과부하</b>에서만 일어난다. 원소가 다른 공격이 잔류 원소와 섞이면 복합 반응(증기·플라즈마·초전도·충돌)이 일어난다.
      오래 머물면 경보가 올라 정예 순찰대가 몰려온다.</p>
      <div class="row"><button data-act="close">닫기 (Esc)</button></div></div>`;
    bind(modal, { close: closeOverlay });
    return;
  }
  if (g.mode === 'rest') return showRest();
  modal.hidden = true;
}

/** 각인 실험실 편집: 모든 각인을 행동별로 켜고 끈다 */
function showLab() {
  const g = game!;
  modal.hidden = false;
  const on = new Set(g.player.engravings.map((e) => e.id));
  const groups = TRIGGERS.map((t) => {
    const list = g.allEngravings.filter((e) => e.trigger === t);
    return `<h3>${TRIGGER_NAME[t]}</h3><div class="cards">${list
      .map((e) => `<div class="card ${on.has(e.id) ? 'sel' : ''}" data-eng="${e.id}"><div class="nm">${on.has(e.id) ? '■ ' : '□ '}${esc(e.name)}</div><div class="ds">→ ${esc(describeEffect(e.effect))}</div></div>`)
      .join('')}</div>`;
  }).join('');
  const la = g.lastAction;
  modal.innerHTML = `<div class="box lab"><h2>각인 실험실</h2>
    <p class="lead">눌러서 각인을 켜고 끈다 (칸 제한 없음). 피해를 주는 각인(일격·폭발·파편·연쇄)은 그 자체가 '공격'으로 쳐서 공격 각인을 다시 터뜨린다 — 최대 3단계, 같은 각인은 턴당 3회.<br>
    직전 행동: 각인 발동 <b>${la.triggers}</b> · 최대 연쇄 <b>${la.maxDepth}</b> · 준 피해 <b>${la.damage}</b></p>
    ${groups}
    <div class="row"><button class="ghost" data-act="none">모두 끄기</button><button class="ghost" data-act="reset">허수아비·상태 초기화</button><span style="flex:1"></span><button data-act="close">닫기 (T / Esc)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-eng]').forEach(
    (el) =>
      (el.onclick = () => {
        const id = el.dataset.eng!;
        const ids = g.player.engravings.map((e) => e.id);
        g.labSetEngravings(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
        refresh();
      }),
  );
  bind(modal, {
    none: () => (g.labSetEngravings([]), refresh()),
    reset: () => (g.labReset(), closeOverlay()),
    close: closeOverlay,
  });
}

function closeOverlay() {
  overlay = null;
  installItem = null;
  overloadSel = null;
  refresh();
}

function showEngravePick(title: string, lead: string) {
  const g = game!;
  modal.hidden = false;
  const full = g.player.engravings.length >= g.engravingCap();
  if (engraveSel && full) {
    const chosen = g.levelChoices.find((e) => e.id === engraveSel)!;
    modal.innerHTML = `<div class="box"><h2>각인 칸이 가득 찼다</h2><p class="lead">「${esc(chosen.name)}」을(를) 새기려면 기존 각인 하나를 지워야 한다.</p>
      <div class="cards">${g.player.engravings.map((e, i) => `<div class="card" data-i="${i}"><span class="key">${i + 1}</span><div class="nm">${esc(e.name)}</div><div class="ds">${esc(describeEngraving(e))}</div></div>`).join('')}</div>
      <div class="row"><button class="ghost" data-act="back">돌아가기</button></div></div>`;
    modal.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => (el.onclick = () => pickEngraving(engraveSel!, Number(el.dataset.i))));
    bind(modal, { back: () => ((engraveSel = null), refresh()) });
    return;
  }
  modal.innerHTML = `<div class="box"><h2>${title}</h2><p class="lead">${lead}</p>
    <div class="cards">${g.levelChoices.map((e, i) => `<div class="card" data-id="${e.id}"><span class="key">${i + 1} · ${TRIGGER_SHORT[e.trigger]}</span><div class="nm">${esc(e.name)}</div><div class="ds">${esc(describeEngraving(e))}</div></div>`).join('')}</div>
    <div class="row"><span style="color:var(--dim)">각인 ${g.player.engravings.length}/${g.engravingCap()}</span><span style="flex:1"></span><button class="ghost" data-act="skip">건너뛰기</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => (el.onclick = () => pickEngraving(el.dataset.id!)));
  bind(modal, { skip: () => pickEngraving(null) });
}

function pickEngraving(id: string | null, replace?: number) {
  const g = game!;
  if (id && g.player.engravings.length >= g.engravingCap() && replace === undefined) {
    engraveSel = id;
    return refresh();
  }
  engraveSel = null;
  g.chooseEngraving(id, replace);
  refresh();
}

function showAltar() {
  const g = game!;
  const f = g.level.featureAt(g.player.x, g.player.y);
  const god = GODS.find((x) => x.id === f?.godId);
  if (!god) return;
  modal.hidden = false;
  modal.innerHTML = `<div class="box"><h2>옛 신의 제단 — ${esc(god.name)}</h2>
    <p class="lead">녹슨 제단이 아직 따뜻하다. 섬기면 계율을 따라야 하며, 신앙이 쌓일수록 은총이 열린다.</p>
    <div>${esc(god.law)}</div>
    <ul>${god.boons.map((b, i) => `<li>신앙 ${[3, 7, 12][i]}: ${esc(b)}</li>`).join('')}</ul>
    <div class="row"><button data-act="yes">섬긴다 (Y)</button><button class="ghost" data-act="no">지나친다 (N)</button></div></div>`;
  bind(modal, { yes: () => (g.acceptGod(true), refresh()), no: () => (g.acceptGod(false), refresh()) });
}

function showInstall() {
  const g = game!;
  const items = g.groundHere();
  modal.hidden = false;
  if (!installItem || !items.includes(installItem)) {
    if (items.length === 1) installItem = items[0];
    else {
      modal.innerHTML = `<div class="box"><h2>장착 — 고르기</h2><div class="cards">${items.map((r, i) => `<div class="card" data-i="${i}"><span class="key">${i + 1}</span>${itemTooltip(r)}</div>`).join('')}</div>
        <div class="row"><button class="ghost" data-act="close">취소 (Esc)</button></div></div>`;
      modal.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => (el.onclick = () => ((installItem = items[Number(el.dataset.i)]), refresh())));
      bind(modal, { close: closeOverlay });
      return;
    }
  }
  if (installItem!.kind === 'weapon') return showTakeWeapon(installItem as WeaponInst);
  const r = installItem as ByproductInst;
  const slots = g.player.slots[r.def.slot];
  modal.innerHTML = `<div class="box"><h2>장착 — ${esc(r.def.name)}</h2>
    <div class="card" style="cursor:default">${byproductTooltip(r)}</div>
    <p class="lead" style="margin-top:12px">${SLOT_NAME[r.def.slot]} 부위 어느 슬롯에 장착할까? 기존 부산물은 버리거나(바닥에 남음) 과부하(태워서 쿨다운 초기화)할 수 있다.</p>
    <div class="cards">${slots
      .map((cur, i) => {
        if (!cur) return `<div class="card"><div class="nm">${SLOT_NAME[r.def.slot]}${i + 1} — 비어 있음</div><div class="row"><button data-install="${i}" data-d="drop">장착 (${i + 1})</button></div></div>`;
        if (cur.fixed) return `<div class="card disabled"><div class="nm">${SLOT_NAME[r.def.slot]}${i + 1} — 고정 슬롯</div>${byproductTooltip(cur)}</div>`;
        return `<div class="card"><div class="nm">${SLOT_NAME[r.def.slot]}${i + 1}</div>${byproductTooltip(cur)}
          <div class="row"><button data-install="${i}" data-d="overload">과부하하고 교체</button><button class="ghost" data-install="${i}" data-d="drop">버리고 교체</button></div></div>`;
      })
      .join('')}</div>
    <div class="row"><button class="ghost" data-act="close">취소 (Esc)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-install]').forEach(
    (el) =>
      (el.onclick = () => {
        g.install(r, Number(el.dataset.install), el.dataset.d as 'drop' | 'overload');
        closeOverlay();
      }),
  );
  bind(modal, { close: closeOverlay });
}

function showTakeWeapon(w: WeaponInst) {
  const g = game!;
  const p = g.player;
  modal.innerHTML = `<div class="box"><h2>무기 — ${esc(w.def.name)}</h2>
    <div class="card" style="cursor:default">${weaponTooltip(w)}</div>
    <p class="lead" style="margin-top:12px">어느 손에 들까? 원래 든 무기는 바닥에 내려놓는다. 무기는 과부하하지 않는다.</p>
    <div class="cards">${[0, 1]
      .map((i) => {
        const cur = p.hands[i];
        return `<div class="card"><div class="nm">손${i + 1}${p.activeHand === i ? ' (들고 있음)' : ''}</div>${cur ? weaponTooltip(cur) : '<div class="ds">비어 있음</div>'}
          <div class="row"><button data-hand="${i}">손${i + 1}에 들기 (${i + 1})</button></div></div>`;
      })
      .join('')}</div>
    <div class="row"><button class="ghost" data-act="close">취소 (Esc)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-hand]').forEach(
    (el) =>
      (el.onclick = () => {
        g.takeWeapon(w, Number(el.dataset.hand));
        closeOverlay();
      }),
  );
  bind(modal, { close: closeOverlay });
}

function overloadCandidates(): ByproductInst[] {
  const g = game!;
  const eq = SLOTS.flatMap((s) => g.player.slots[s]).filter((r): r is ByproductInst => !!r && !r.fixed);
  return [...g.groundHere().filter((r): r is ByproductInst => r.kind === 'byproduct'), ...eq];
}

function showOverload() {
  const g = game!;
  modal.hidden = false;
  const cands = overloadCandidates();
  if (!overloadSel || !cands.includes(overloadSel)) {
    overloadSel = null;
    const ground = new Set<GroundItem>(g.groundHere());
    modal.innerHTML = `<div class="box"><h2>과부하 — 무엇을 태울까</h2><p class="lead">부산물을 과부하시켜 태운다. 되돌릴 수 없다. 등급이 높을수록 일격이 강하다.</p>
      <div class="cards">${cands.map((r, i) => `<div class="card" data-i="${i}"><span class="key">${i < 9 ? i + 1 : ''} ${ground.has(r) ? '· 발밑' : '· 장착됨'}</span>${byproductTooltip(r)}</div>`).join('')}</div>
      <div class="row"><button class="ghost" data-act="close">취소 (Esc)</button></div></div>`;
    modal.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => (el.onclick = () => ((overloadSel = cands[Number(el.dataset.i)]), refresh())));
    bind(modal, { close: closeOverlay });
    return;
  }
  const r = overloadSel;
  const modes: [OverloadMode, string][] = [
    ['strike', '가장 가까운 적에게 장갑을 꿰뚫는 큰 일격'],
    ['retrigger', '모든 각인을 이 부산물의 원소로 즉시 한 번씩 발동'],
    ['cooldown', '모든 액티브 쿨다운 초기화'],
    ['repair', '슈트 전체 수리 + 체력 회복'],
  ];
  modal.innerHTML = `<div class="box"><h2>과부하 — ${byproductName(r)}</h2>
    <div class="cards">${modes.map(([m, d], i) => `<div class="card" data-m="${m}"><span class="key">${i + 1}</span><div class="nm">${OVERLOAD_NAME[m]}</div><div class="ds">${d}</div></div>`).join('')}</div>
    <div class="row"><button class="ghost" data-act="back">다른 부산물</button><button class="ghost" data-act="close">취소 (Esc)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-m]').forEach((el) => (el.onclick = () => doOverload(el.dataset.m as OverloadMode)));
  bind(modal, { back: () => ((overloadSel = null), refresh()), close: closeOverlay });
}

function doOverload(m: OverloadMode) {
  if (overloadSel) game!.overload(overloadSel, m);
  closeOverlay();
}

let reforgeSel: ByproductInst | null = null;
function showRest() {
  const g = game!;
  modal.hidden = false;
  let body = '';
  switch (g.restService) {
    case 'shop':
      body = `<p class="lead">마석 <b>${g.ash}</b>. 산 부산물은 보급 포드 바닥에 놓인다.</p>
        <div class="cards">${g.shop.map((s, i) => `<div class="card">${itemTooltip(s.item)}<div class="row"><button data-buy="${i}" ${g.ash < s.price ? 'disabled' : ''}>구매 (${s.price})</button></div></div>`).join('')}
        <div class="card"><div class="nm">응급 키트</div><div class="ds">소지 ${g.kits}/${MAX_KITS}</div><div class="row"><button data-act="kit" ${g.ash < 4 || g.kits >= MAX_KITS ? 'disabled' : ''}>구매 (4)</button></div></div></div>`;
      break;
    case 'reforge': {
      const eq = SLOTS.flatMap((s) => g.player.slots[s]).filter((r): r is ByproductInst => !!r);
      body = g.restUsed
        ? '<p class="lead">개조를 마쳤다.</p>'
        : `<p class="lead">부산물 하나의 첫 원소를 바꾼다 (액티브 원소도 바뀐다).</p>
        <div class="cards">${eq.map((r, i) => `<div class="card ${reforgeSel === r ? 'sel' : ''}" data-rf="${i}">${byproductTooltip(r)}</div>`).join('')}</div>
        ${reforgeSel ? `<div class="row">${ELEMENTS.map((e) => `<button data-el="${e}"><i class="el ${e}"></i> ${ELEMENT_NAME[e]}</button>`).join('')}</div>` : ''}`;
      setTimeout(() => {
        modal.querySelectorAll<HTMLElement>('[data-rf]').forEach((el) => (el.onclick = () => ((reforgeSel = eq[Number(el.dataset.rf)]), refresh())));
        modal.querySelectorAll<HTMLElement>('[data-el]').forEach(
          (el) =>
            (el.onclick = () => {
              if (reforgeSel) g.reforge(reforgeSel, el.dataset.el as Element);
              reforgeSel = null;
              refresh();
            }),
        );
      });
      break;
    }
    case 'engrave':
      body = g.restUsed || !g.levelChoices.length
        ? '<p class="lead">각인 기록을 마쳤다.</p>'
        : `<p class="lead">슈트에 새 각인 하나를 기록한다.</p>
        <div class="cards">${g.levelChoices.map((e) => `<div class="card" data-id="${e.id}"><span class="key">${TRIGGER_SHORT[e.trigger]}</span><div class="nm">${esc(e.name)}</div><div class="ds">${esc(describeEngraving(e))}</div></div>`).join('')}</div>`;
      break;
  }
  if (g.restService === 'engrave' && engraveSel && g.player.engravings.length >= g.engravingCap()) return showEngravePick('각인 기록기', '');
  const items = g.restItems;
  modal.innerHTML = `<div class="box"><h2>보급 지점 — ${REST_NAME[g.restService]}</h2>
    <p class="lead">${esc(g.depthLabel)}을(를) 지났다. 보급 포드가 슈트를 모두 수리했다. (체력 ${g.player.hp}/${g.st(g.player).maxHp})</p>
    ${body}
    ${items.length ? `<h3>보급 포드 바닥</h3><div class="cards">${items.map((r, i) => `<div class="card">${itemTooltip(r)}<div class="row">${r.kind === 'weapon' ? `<button data-gr="${i}">손에 들기</button>` : `<button data-gr="${i}">장착</button><button class="ghost" data-of="${i}">과부하 (쿨다운 초기화)</button>`}</div></div>`).join('')}</div>` : ''}
    <div class="row"><span style="flex:1"></span><button data-act="leave">다음 층으로 (Enter)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => (el.onclick = () => (g.buy(Number(el.dataset.buy)), refresh())));
  modal.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => (el.onclick = () => pickEngraving(el.dataset.id!)));
  modal.querySelectorAll<HTMLElement>('[data-gr]').forEach((el) => (el.onclick = () => ((installItem = items[Number(el.dataset.gr)]), (overlay = 'install'), refresh())));
  modal.querySelectorAll<HTMLElement>('[data-of]').forEach((el) => (el.onclick = () => (g.overload(items[Number(el.dataset.of)] as ByproductInst, 'cooldown'), refresh())));
  bind(modal, {
    kit: () => (g.buyKit(), refresh()),
    leave: () => {
      g.leaveRest();
      refresh();
    },
  });
}

function showEnd() {
  const g = game!;
  const s = g.stats;
  hudEl.hidden = false;
  modal.hidden = false;
  modal.innerHTML = `<div class="box"><h2>${g.mode === 'won' ? '이륙' : '클론 사망'}</h2>
    <p class="lead">${g.mode === 'won' ? '두 구역의 연료 결정을 회수했다. (MVP 끝)' : `${esc(g.depthLabel)}에서 생체 신호가 끊겼다.`}</p>
    <table class="summary">
      <tr><td>시드</td><td>${esc(g.seed)}</td></tr>
      <tr><td>레벨</td><td>${g.plevel}</td></tr>
      <tr><td>행동 수</td><td>${s.turns}</td></tr>
      <tr><td>처치</td><td>${s.kills}</td></tr>
      <tr><td>각인 발동</td><td>${s.triggers} (최대 연쇄 깊이 ${s.maxDepth})</td></tr>
      <tr><td>복합 반응</td><td>${s.combos}</td></tr>
      <tr><td>과부하 / 장착</td><td>${s.overloads} / ${s.installs}</td></tr>
      <tr><td>각인</td><td>${g.player.engravings.map((e) => esc(e.name)).join(', ')}</td></tr>
    </table>
    <div class="row"><button data-act="again">같은 시드로 다시</button><button data-act="title">새 클론 출격 (Enter)</button></div></div>`;
  bind(modal, {
    again: () => {
      (document.getElementById('seed') as HTMLInputElement | null)?.remove();
      const seed = g.seed;
      showTitle();
      (document.getElementById('seed') as HTMLInputElement).value = seed;
      startGame();
    },
    title: () => {
      game = null;
      showTitle();
    },
  });
}

function bind(root: HTMLElement, acts: Record<string, () => void>) {
  root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
    const f = acts[el.dataset.act!];
    if (f) el.onclick = f;
  });
}

// ─────────────── 입력 ───────────────
const DIR_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

function startTargeting(arm: number) {
  const g = game!;
  const r = g.equippedActives(g.player)[arm];
  if (!r) return;
  if (!FORM_NEEDS_TARGET[r.def.active!.form]) {
    g.useActive(arm);
    return refresh();
  }
  if (r.cd > 0 || r.dormant) {
    g.useActive(arm); // 이유를 로그로 남김
    return refresh();
  }
  const foes = sortedFoes();
  if (!foes.length) {
    g.log('보이는 적이 없다.');
    return refresh();
  }
  targeting = { arm, x: foes[0].x, y: foes[0].y };
  refresh();
}

function startShoot() {
  const g = game!;
  const s = g.st(g.player);
  const w = heldWeapon(g.player);
  if (s.range <= 1) {
    g.log('원거리 무기를 들고 있지 않다. [E] 무기 교체');
    return refresh();
  }
  if (w?.def.mag !== undefined && w.ammo <= 0) {
    g.reload();
    return refresh();
  }
  const foes = sortedFoes();
  if (!foes.length) {
    g.log('보이는 적이 없다.');
    return refresh();
  }
  targeting = { arm: -1, x: foes[0].x, y: foes[0].y };
  refresh();
}

function sortedFoes() {
  const g = game!;
  const p = g.player;
  return g.visibleEnemies().sort((a, b) => Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) - Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)));
}

function cycleTarget() {
  if (!targeting) return;
  const foes = sortedFoes();
  if (!foes.length) return;
  const i = foes.findIndex((f) => f.x === targeting!.x && f.y === targeting!.y);
  const n = foes[(i + 1) % foes.length];
  targeting.x = n.x;
  targeting.y = n.y;
  refresh();
}

function fireTarget() {
  if (!targeting) return;
  const t = targeting;
  targeting = null;
  if (t.arm < 0) game!.shoot(t.x, t.y);
  else game!.useActive(t.arm, t.x, t.y);
  refresh();
}

window.addEventListener('keydown', (e) => {
  if (!game) {
    if (e.key === 'Enter') startGame();
    return;
  }
  const g = game;
  // 아무 키나 누르면 남은 연출을 바로 끝낸다
  renderer?.skip();
  if (auto) {
    auto = null;
    refresh();
    if (e.key !== 'o' && e.key !== 'x') return;
  }
  // 모달 단축키
  if (g.mode === 'dead' || g.mode === 'won') {
    if (e.key === 'Enter') {
      game = null;
      showTitle();
    }
    return;
  }
  if (g.mode === 'altar') {
    if (e.key === 'y' || e.key === 'Enter') g.acceptGod(true);
    if (e.key === 'n' || e.key === 'Escape') g.acceptGod(false);
    return refresh();
  }
  if (g.mode === 'levelup') {
    const i = Number(e.key) - 1;
    if (engraveSel && i >= 0 && i < g.player.engravings.length) pickEngraving(engraveSel, i);
    else if (!engraveSel && g.levelChoices[i]) pickEngraving(g.levelChoices[i].id);
    if (e.key === 'Escape' && engraveSel) ((engraveSel = null), refresh());
    return;
  }
  if (overlay) {
    if (e.key === 'Escape' || (overlay === 'suit' && e.key === 'i') || (overlay === 'map' && e.key === 'Tab') || (overlay === 'lab' && e.key === 't')) {
      e.preventDefault();
      return closeOverlay();
    }
    const i = Number(e.key) - 1;
    if (overlay === 'overload' && i >= 0) {
      if (overloadSel) {
        const modes: OverloadMode[] = ['strike', 'retrigger', 'cooldown', 'repair'];
        if (modes[i]) doOverload(modes[i]);
      } else {
        const c = overloadCandidates();
        if (c[i]) ((overloadSel = c[i]), refresh());
      }
    }
    if (overlay === 'install' && i >= 0) {
      if (installItem?.kind === 'weapon') {
        if (i <= 1) {
          g.takeWeapon(installItem, i);
          closeOverlay();
        }
      } else if (installItem) {
        const cur = g.player.slots[installItem.def.slot][i];
        if (i < g.player.slots[installItem.def.slot].length && !cur?.fixed) {
          g.install(installItem, i, 'overload');
          closeOverlay();
        }
      } else {
        const items = g.groundHere();
        if (items[i]) ((installItem = items[i]), refresh());
      }
    }
    return;
  }
  if (g.mode === 'rest') {
    if (e.key === 'Enter') {
      g.leaveRest();
      refresh();
    }
    return;
  }
  if (g.mode !== 'play') return;

  if (targeting) {
    e.preventDefault();
    if (e.key === 'Escape') targeting = null;
    else if (e.key === 'Tab') return cycleTarget();
    else if (e.key === 'Enter' || e.key === String(targeting.arm + 1) || e.key === 'f') return fireTarget();
    else if (DIR_KEYS[e.key] || DIR_KEYS[e.code]) {
      const [dx, dy] = DIR_KEYS[e.key] ?? DIR_KEYS[e.code];
      targeting.x += dx;
      targeting.y += dy;
    }
    return refresh();
  }

  const dir = DIR_KEYS[e.key] ?? (e.code.startsWith('Numpad') ? DIR_KEYS[e.code] : undefined);
  if (dir) {
    e.preventDefault();
    // OS 키 반복은 무시하고, 누르고 있는 동안은 아래 걸음 루프가 WALK_EVERY마다 한 걸음씩 보낸다
    if (e.repeat) return;
    held = { key: e.key, code: e.code, dir, at: performance.now(), hp: g.player.hp, foes: g.visibleEnemies().length };
    g.move(dir[0], dir[1]);
    return refresh();
  }
  switch (e.key) {
    case '.':
    case ' ':
      e.preventDefault();
      g.wait();
      break;
    case 'o':
      auto = { kind: 'explore' };
      autoHp = g.player.hp;
      break;
    case 'x': {
      const ex = g.level.exit;
      if (g.level.explored[g.level.idx(ex.x, ex.y)]) {
        auto = { kind: 'travel', x: ex.x, y: ex.y };
        autoHp = g.player.hp;
      } else g.log('아직 출구를 찾지 못했다.');
      break;
    }
    case '>':
    case 'Enter':
      g.descend();
      break;
    case '1':
    case '2':
    case '3':
      return startTargeting(Number(e.key) - 1);
    case 'g':
      if (g.groundHere().length) overlay = 'install';
      else g.log('발밑에 주울 것이 없다.');
      break;
    case 'f':
      return startShoot();
    case 'r':
      g.reload();
      break;
    case 'e':
      g.swapWeapon();
      break;
    case 'c':
      overlay = 'overload';
      break;
    case 'q':
      g.useKit();
      break;
    case '?':
      overlay = 'help';
      break;
    case 'Tab':
      e.preventDefault();
      overlay = 'map';
      break;
    case 'i':
      overlay = 'suit';
      break;
    case 't':
      if (g.lab) overlay = 'lab';
      break;
    case 'm':
      hud.toggleLog();
      break;
    case 'p':
      togglePixel();
      break;
    case 'v':
      cyclePace();
      break;
    default:
      if (e.code === 'Numpad5') g.wait();
      else return;
  }
  refresh();
});

/** 한 걸음 간격: PROJ_R 렌더러의 걷는 속도(0.14초에 한 칸)와 맞춘다. 더 빠르면 모델이 뒤처졌다가 달려서 따라잡는다 */
const WALK_EVERY_MS = 140;
let held: { key: string; code: string; dir: [number, number]; at: number; hp: number; foes: number } | null = null;

window.addEventListener('keyup', (e) => {
  if (held && (e.key === held.key || e.code === held.code)) held = null;
});
window.addEventListener('blur', () => (held = null));

// 이동 키를 누르고 있는 동안: 일정한 간격으로 한 걸음씩. 새 적이 보이거나 맞으면 멈춘다
setInterval(() => {
  if (!held || !game) return;
  const g = game;
  if (!g.canAct() || overlay || targeting || !modal.hidden) return void (held = null);
  const now = performance.now();
  if (now - held.at < WALK_EVERY_MS) return;
  const foes = g.visibleEnemies().length;
  if (g.player.hp < held.hp || foes > held.foes) return void (held = null);
  held.at = now;
  held.foes = foes;
  if (!g.move(held.dir[0], held.dir[1])) held = null;
  refresh();
}, 20);

// 자동 이동 (오토탐험 / 이동): 적이 보이거나 피해를 입으면 멈춘다
setInterval(() => {
  if (!game || !auto) return;
  const g = game;
  if (!g.canAct() || g.player.hp < autoHp) {
    auto = null;
    return refresh();
  }
  let step: [number, number] | 'done' | 'enemy';
  if (auto.kind === 'explore') {
    step = g.autoExploreDir();
    if (step === 'done') {
      g.log('더 탐험할 곳이 없다. [x] 출구로 이동.');
    }
  } else {
    step = g.visibleEnemies().length ? 'enemy' : g.stepToward(auto.x, auto.y);
  }
  if (step === 'enemy') g.log('적이 보인다.', 'warn');
  if (step === 'done' || step === 'enemy' || !g.move(step[0], step[1])) auto = null;
  autoHp = Math.min(autoHp, g.player.hp);
  refresh();
}, WALK_EVERY_MS);

// 마우스
const canvas = view;
canvas.addEventListener('mousemove', (e) => {
  if (!game || !modal.hidden) return hud.showTooltip(null);
  const t = renderer.pick(e.clientX, e.clientY);
  if (!t) {
    renderer.setPath(null);
    renderer.setMark(null);
    return hud.showTooltip(null);
  }
  const g = game;
  const lv = g.level;
  const i = lv.idx(t[0], t[1]);
  const a = g.actorAt(t[0], t[1]);
  const items = g.ground.get(i);
  const f = lv.featureAt(t[0], t[1]);
  // 몬스터·물건·시설 위: 빨간 테두리 / 빈 칸: 이동 경로
  const foe = a && !a.isPlayer && lv.visible[i];
  const thing = (items?.length || f) && lv.explored[i];
  if (foe || thing) {
    renderer.setMark(t[0], t[1]);
    renderer.setPath(null);
  } else {
    renderer.setMark(null);
    renderer.setPath(targeting ? null : g.pathTo(t[0], t[1]));
  }
  if (foe) return hud.showTooltip(actorTooltip(g, a), e.clientX, e.clientY);
  if (items?.length && lv.explored[i]) return hud.showTooltip(items.map(itemTooltip).join('<hr style="border-color:#4a3a28">'), e.clientX, e.clientY);
  if (f && lv.explored[i]) return hud.showTooltip(f.kind === 'exit' ? '<div class="t">출구</div><div class="r">보급 지점으로 이어진다</div>' : `<div class="t">제단</div><div class="r">${esc(GODS.find((x) => x.id === f.godId)!.name)}</div>`, e.clientX, e.clientY);
  hud.showTooltip(null);
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!game || !modal.hidden) return;
    e.preventDefault();
    renderer.zoomBy(Math.sign(e.deltaY));
  },
  { passive: false },
);
canvas.addEventListener('mouseleave', () => {
  renderer?.setPath(null);
  renderer?.setMark(null);
});

// HD / 도트 전환 (P)
const pxbtn = document.getElementById('pxbtn')!;
function pixelLabel() {
  pxbtn.textContent = renderer?.pixelated ? '도트 ▸ HD (P)' : 'HD ▸ 도트 (P)';
}
function togglePixel() {
  renderer.pixelated = !renderer.pixelated;
  pixelLabel();
}
pxbtn.addEventListener('click', togglePixel);

// 연출 속도 (V): 각인 연쇄 사이 간격
const pacebtn = document.getElementById('pacebtn')!;
const PACE_NAME: Record<Pace, string> = { normal: '보통', fast: '빠름', instant: '즉시' };
function paceLabel() {
  pacebtn.textContent = `연출 ${PACE_NAME[renderer?.pace ?? 'normal']} (V)`;
}
function cyclePace() {
  const order: Pace[] = ['normal', 'fast', 'instant'];
  renderer.pace = order[(order.indexOf(renderer.pace) + 1) % order.length]!;
  paceLabel();
}
pacebtn.addEventListener('click', cyclePace);

// 심전도·최근 메시지 애니메이션
function hudLoop() {
  hud.tick();
  requestAnimationFrame(hudLoop);
}
requestAnimationFrame(hudLoop);

canvas.addEventListener('click', (e) => {
  if (!game || game.mode !== 'play' || overlay) return;
  const t = renderer.pick(e.clientX, e.clientY);
  if (!t) return;
  const g = game;
  if (targeting) {
    targeting.x = t[0];
    targeting.y = t[1];
    return fireTarget();
  }
  const p = g.player;
  const dx = t[0] - p.x,
    dy = t[1] - p.y;
  const foe = g.actorAt(t[0], t[1]);
  if (foe && foe.faction === 'enemy' && g.st(p).range > 1 && Math.max(Math.abs(dx), Math.abs(dy)) > 1) {
    g.shoot(t[0], t[1]);
    return refresh();
  }
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
    g.move(dx, dy);
    return refresh();
  }
  if (g.level.explored[g.level.idx(t[0], t[1])] && g.level.isFloor(t[0], t[1])) {
    auto = { kind: 'travel', x: t[0], y: t[1] };
    autoHp = p.hp;
  }
});

// 패널의 부산물 위에 마우스를 올리면 정보
document.getElementById('hud')!.addEventListener('mousemove', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-byproduct]');
  if (!el || !game) return hud.showTooltip(null);
  const uid = Number(el.dataset.byproduct);
  const r = [...SLOTS.flatMap((s) => game!.player.slots[s]), ...game.player.hands, ...game.groundHere()].find((x) => x?.uid === uid);
  if (r) hud.showTooltip(itemTooltip(r), e.clientX, e.clientY);
});

// 에셋(캐릭터·던전·무기)을 불러온 뒤 타이틀을 연다
modal.hidden = false;
modal.innerHTML = '<div class="box title"><h1>MODEL 0</h1><div class="sub">복제 포드 가동 중… (에셋 불러오는 중)</div></div>';
loadAssets()
  .then((a) => {
    renderer = new View3D(view, a);
    renderer.onLine = (line) => hud.typeLine(line);
    pixelLabel();
    paceLabel();
    showTitle();
  })
  .catch((err) => {
    modal.innerHTML = `<div class="box"><h2>에셋을 불러오지 못했다</h2><p class="lead">${esc(String(err))}</p></div>`;
  });

