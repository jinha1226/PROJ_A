import { Game, REST_NAME } from './core/game';
import { FLASK } from './data/consumables';
import type { Color, ByproductInst, GroundItem, OptionId, WeaponInst } from './core/types';
import { COLOR_NAME, ELEMENT_NAME, SLOT_NAME } from './core/types';
import { OPTION_BY_ID, OPTIONS, optionFits } from './data/options';
import { infuseOptions, SUIT_INFUSE_MAX, suitInfusion } from './data/infuse';
import { TRAIT_TEXT, WEAPONS } from './data/weapons';
import { loadAssets, View3D, type Pace } from './render/view3d';
import { actorTooltip, clearThemeCache, esc, Hud, byproductTooltip, itemTooltip, weaponTooltip } from './ui/hud';
import { COLOR_STEP, colorLevel, heldWeapon } from './core/stats';

const view = document.getElementById('view')!;
const modal = document.getElementById('modal')!;
const hudEl = document.getElementById('hud')!;
let renderer!: View3D;
const hud = new Hud();

let game: Game | null = null;
/** 사격 조준 */
let targeting: { x: number; y: number } | null = null;
let overlay: null | 'pickup' | 'help' | 'suit' | 'map' | 'lab' = null;
let pickItem: GroundItem | null = null;
let auto: null | { kind: 'explore' } | { kind: 'travel'; x: number; y: number } = null;
let autoHp = 0;

// ─────────────── 타이틀 ───────────────
function showTitle() {
  hudEl.hidden = true;
  modal.hidden = false;
  const seed = (document.getElementById('seed') as HTMLInputElement | null)?.value ?? randomSeed();
  modal.innerHTML = `<div class="box title">
    <h1>MODEL 0</h1>
    <div class="sub">판타지 세계에 추락한 클론. 현지 무기를 갈아 들며 화력 · 기술 · 생존 중 하나를 키우고, 연료를 모아 탈출한다.</div>
    <div class="row"><span style="color:var(--dim)">시드</span><input id="seed" value="${esc(seed)}" size="16"/>
      <button class="ghost" data-act="reseed">무작위</button><span style="flex:1"></span><button class="ghost" data-act="lab">무기 실험실 (테스트)</button><button data-act="start">출격 (Enter)</button></div>
    ${keysHelp()}
  </div>`;
  bind(modal, {
    start: () => startGame(),
    lab: () => startGame(true),
    reseed: () => {
      (document.getElementById('seed') as HTMLInputElement).value = randomSeed();
    },
  });
}

function keysHelp() {
  const rows: [string, string][] = [
    ['방향키 · hjkl yubn · 숫자패드', '이동 / 공격'],
    ['. 또는 Space', '제자리 대기'],
    ['o', '오토탐험'],
    ['x', '출구로 자동 이동'],
    ['>', '출구에서 보급 지점으로'],
    ['g', '발밑 무기 줍기 · 부산물 부여(무기·슈트)·분해'],
    ['f', '사격 (원거리 무기, Tab 대상 변경)'],
    ['r', '재장전 (대기로 침)'],
    ['e', '무기 교체 (손 1 ↔ 2)'],
    ['q', '체력 플라스크 (보급 지점에서 다시 찬다)'],
    ['3 4 5', '벨트의 주사제 사용'],
    ['i', '슈트 화면 (손·색·부위 장갑)'],
    ['Tab', '구역 지도'],
    ['m', '기록(메시지) 보기'],
    ['p', 'HD / 도트 전환'],
    ['v', '연출 속도 (보통 · 빠름 · 즉시)'],
    ['c', 'HUD 색 (원본 · 녹색 · 주황)'],
    ['z', '시점 (45° ↔ 완전 탑뷰)'],
    ['t', '무기 실험실: 무기·옵션·색 편집, 초기화'],
    ['마우스', '클릭 이동·조준, 휠 확대, 올리면 정보'],
  ];
  return `<div class="keys">${rows.map(([k, d]) => `<div><b>${esc(k)}</b> ${d}</div>`).join('')}</div>`;
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function startGame(lab = false) {
  const seed = (document.getElementById('seed') as HTMLInputElement).value.trim() || randomSeed();
  game = new Game(seed, { lab });
  hud.clearLog();
  renderer.setGame(game);
  // 개발 모드에서만: 브라우저 테스트가 게임 상태를 볼 수 있게
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __view: renderer, __refresh: () => refresh() });
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

// HUD 주기 갱신
setInterval(() => {
  if (game && modal.hidden) hud.render(game);
}, 350);

// ─────────────── 모달 ───────────────
function renderModal() {
  const g = game!;
  if (g.mode === 'dead' || g.mode === 'won') return showEnd();
  if (g.mode === 'levelup') return showColorPick();
  if (overlay === 'pickup') return showPickup();
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
      <p class="lead">밝은 녹색 점 = 나 · 주황 = 출구 · 흰 점 = 바닥의 물건 · 빨강 = 보이는 적</p><div class="row"><button class="ghost" data-act="close">닫기 (Tab / Esc)</button></div></div>`;
    hud.drawMap(document.getElementById('bigmap') as HTMLCanvasElement, g, k);
    bind(modal, { close: closeOverlay });
    return;
  }
  if (overlay === 'help') {
    modal.hidden = false;
    modal.innerHTML = `<div class="box"><h2>도움말</h2>${keysHelp()}
      <p class="lead" style="margin-top:12px">무기는 손 2칸에 들고 E로 바꾼다(1턴). 무기마다 ★ 고유 효과가 치명타 조건을 정하고, 옵션은 상태(화상·빙결·출혈 등, 내 턴 기준 2턴)를 만들거나 상태에 따라 피해를 키운다.
      레벨업마다 화력 · 기술 · 생존 중 하나를 키우면 그 색의 무기가 강해진다.
      맞으면 맞은 부위(몸·팔·다리·감각)의 슈트 장갑이 먼저 깎이고, 0이 되면 그 부위가 파손된다(몸: 받는 피해 +20%, 팔: 공격 −20%, 다리: 이동 느림, 감각: 시야 감소·치명타 무효). 보급 지점에서 모두 수리된다.
      원소가 다른 공격이 잔류 원소와 섞이면 복합 반응(증기·플라즈마·초전도·충돌)이 일어난다. 오래 머물면 경보가 올라 정예 순찰대가 몰려온다.</p>
      <div class="row"><button data-act="close">닫기 (Esc)</button></div></div>`;
    bind(modal, { close: closeOverlay });
    return;
  }
  if (g.mode === 'rest') return showRest();
  modal.hidden = true;
}

/** 무기 실험실 편집: 색 레벨, 손마다 무기와 옵션 */
function showLab() {
  const g = game!;
  modal.hidden = false;
  // 무기: 손마다 무기 고르기 + 옵션 켜고 끄기
  const hands = [0, 1]
    .map((h) => {
      const w = g.player.hands[h];
      const pick = WEAPONS.map((d) => `<option value="${d.id}" ${w?.def.id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
      const opts = OPTIONS.filter((o) => !w || optionFits(o, w.def)).map((o) => {
        const sel = !!w?.options.includes(o.id);
        return `<div class="card ${sel ? 'sel' : ''}" data-opt="${h}:${o.id}"><div class="nm">${sel ? '■ ' : '□ '}${o.kind === 'cond' ? '◇' : '◆'} ${esc(o.name)}</div><div class="ds">${esc(o.desc)}</div></div>`;
      }).join('');
      return `<h3>손 ${h + 1}${g.player.activeHand === h ? ' (들고 있음)' : ''} <select data-hand="${h}">${pick}</select></h3>
        ${w?.def.trait ? `<p class="lead">★ ${esc(TRAIT_TEXT[w.def.trait])}</p>` : ''}<div class="cards">${opts}</div>`;
    })
    .join('');
  const colorRow = COLORS.map(
    (c) => `<span class="labcol"><span class="col ${c}">${COLOR_NAME[c]}</span> <button class="ghost" data-col="${c}:-1">−</button> <b>${g.player.colors![c]}</b> <button class="ghost" data-col="${c}:1">+</button></span>`,
  ).join(' ');
  const la = g.lastAction;
  modal.innerHTML = `<div class="box lab"><h2>무기 실험실</h2>
    <h3>색 레벨 (무기 피해 +${Math.round(COLOR_STEP * 100)}%/레벨)</h3><div class="row">${colorRow}</div>
    <p class="lead">손마다 무기를 고르고 옵션을 켜고 끈다(개수 제한 없음). ★ 무기 고유 효과가 치명타(×2) 조건을 정하고, ◆ 옵션은 상태를 만들고, ◇ 옵션은 상태·상황에 따라 피해를 키운다. 상태는 내 턴 기준 2턴.<br>
    직전 행동: 준 피해 <b>${la.damage}</b></p>
    ${hands}
    <div class="row"><button class="ghost" data-act="reset">허수아비·상태 초기화</button><span style="flex:1"></span><button data-act="close">닫기 (T / Esc)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-opt]').forEach(
    (el) =>
      (el.onclick = () => {
        const [h, o] = el.dataset.opt!.split(':');
        g.labToggleOption(Number(h), o as OptionId);
        refresh();
      }),
  );
  modal.querySelectorAll<HTMLElement>('[data-col]').forEach(
    (el) =>
      (el.onclick = () => {
        const [c, d] = el.dataset.col!.split(':');
        g.labSetColor(c as Color, g.player.colors![c as Color] + Number(d));
        refresh();
      }),
  );
  modal.querySelectorAll<HTMLSelectElement>('select[data-hand]').forEach(
    (el) =>
      (el.onchange = () => {
        g.labSetWeapon(Number(el.dataset.hand), el.value);
        refresh();
      }),
  );
  bind(modal, {
    reset: () => (g.labReset(), closeOverlay()),
    close: closeOverlay,
  });
}

function closeOverlay() {
  overlay = null;
  pickItem = null;
  refresh();
}

const COLORS: Color[] = ['power', 'tactics', 'survival'];
const COLOR_DESC: Record<Color, string> = {
  power: '근접 공격, 순간 화력, 폭발',
  tactics: '원거리, 원소, 설치',
  survival: '방어, 반격, 회복 · 체력 +4, 모든 부위 장갑 +1',
};

/** 레벨업: 화력 · 기술 · 생존 중 하나를 +1. 지금 든 무기들이 얼마나 강해지는지 보여준다 */
function showColorPick() {
  const g = game!;
  const p = g.player;
  modal.hidden = false;
  const cards = COLORS.map((c, i) => {
    const lv = p.colors![c];
    const gains = p.hands
      .filter((w): w is WeaponInst => !!w)
      .map((w) => {
        const now = colorLevel(p, w.def);
        const after = w.def.colors.includes(c) ? Math.max(now, lv + 1) : now;
        return after > now
          ? `<div class="gain up">${esc(w.def.name)} 피해 +${Math.round(COLOR_STEP * 100 * (after - now))}% (${Math.round(COLOR_STEP * 100 * now)}% → ${Math.round(COLOR_STEP * 100 * after)}%)</div>`
          : `<div class="gain">${esc(w.def.name)} 변화 없음</div>`;
      })
      .join('');
    return `<div class="card colorpick ${c}" data-color="${c}"><span class="key">${i + 1}</span><div class="nm"><span class="col ${c}">${COLOR_NAME[c]}</span> ${lv} → ${lv + 1}</div><div class="ds">${COLOR_DESC[c]}</div>${gains}</div>`;
  }).join('');
  modal.innerHTML = `<div class="box"><h2>레벨 ${g.plevel} — 무엇을 키울까</h2>
    <p class="lead">무기는 자기 색의 레벨당 피해 +${Math.round(COLOR_STEP * 100)}%. 색이 둘인 무기는 높은 쪽을 따른다. 레벨업마다 체력 +4.</p>
    <div class="cards">${cards}</div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-color]').forEach((el) => (el.onclick = () => (g.chooseColor(el.dataset.color as Color), refresh())));
}

/** [G] 발밑 물건: 무기는 손에 들고, 부산물은 무기·슈트에 부여하거나 분해한다 */
function showPickup() {
  const g = game!;
  const items = g.groundHere();
  modal.hidden = false;
  if (!pickItem || !items.includes(pickItem)) {
    if (items.length === 1) pickItem = items[0];
    else {
      modal.innerHTML = `<div class="box"><h2>발밑 — 고르기</h2><div class="cards">${items.map((r, i) => `<div class="card" data-i="${i}"><span class="key">${i + 1}</span>${itemTooltip(r)}</div>`).join('')}</div>
        <div class="row"><button class="ghost" data-act="close">취소 (Esc)</button></div></div>`;
      modal.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => (el.onclick = () => ((pickItem = items[Number(el.dataset.i)]), refresh())));
      bind(modal, { close: closeOverlay });
      return;
    }
  }
  if (pickItem!.kind === 'weapon') return showTakeWeapon(pickItem as WeaponInst);
  if (pickItem!.kind === 'consumable') {
    g.pickConsumable(pickItem);
    return closeOverlay();
  }
  const r = pickItem as ByproductInst;
  const p = g.player;
  const opts = infuseOptions(r.def).map((o) => esc(OPTION_BY_ID[o].name)).join(' · ');
  const inf = suitInfusion(r.def);
  const sm = p.suitMods![inf.slot];
  const hands = [0, 1]
    .map((h) => {
      const w = p.hands[h];
      if (!w) return `<div class="card disabled"><div class="nm">손${h + 1} — 비어 있음</div></div>`;
      return `<div class="card"><span class="key">${h + 1}</span><div class="nm">손${h + 1} ${esc(w.def.name)}에 부여</div>
        <div class="ds">+ ${opts}${w.infusion ? `<br><span style="color:var(--warn)">덮어씀: ${esc(w.infusion.from)} (${w.infusion.options.map((o) => esc(OPTION_BY_ID[o].name)).join(' · ')})</span>` : ''}</div>
        <div class="row"><button data-inf="${h}">부여 (${h + 1})</button></div></div>`;
    })
    .join('');
  const full = sm.n >= SUIT_INFUSE_MAX;
  modal.innerHTML = `<div class="box"><h2>부산물 — ${esc(r.def.name)}</h2>
    <div class="card" style="cursor:default">${byproductTooltip(r)}</div>
    <h3>무엇에 쓸까 (1턴)</h3>
    <div class="cards">${hands}
      <div class="card ${full ? 'disabled' : ''}"><span class="key">3</span><div class="nm">슈트 ${SLOT_NAME[inf.slot]}에 부여</div>
        <div class="ds">장갑 최대치 +${inf.armor}${inf.resist.length ? ` · ${inf.resist.map((e) => ELEMENT_NAME[e]).join('·')} 피해 −20%` : ''}<br>${SLOT_NAME[inf.slot]} 부여 ${sm.n}/${SUIT_INFUSE_MAX}</div>
        <div class="row"><button data-act="suit" ${full ? 'disabled' : ''}>부여 (3)</button></div></div>
      <div class="card"><span class="key">4</span><div class="nm">분해</div><div class="ds">마석 +${{ common: 2, holy: 4, forbidden: 6 }[r.def.grade]}</div>
        <div class="row"><button class="ghost" data-act="dismantle">분해 (4)</button></div></div>
    </div>
    <div class="row"><span style="flex:1"></span><button class="ghost" data-act="close">두고 가기 (Esc)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-inf]').forEach((el) => (el.onclick = () => (g.infuseWeapon(r, Number(el.dataset.inf)), closeOverlay())));
  bind(modal, {
    suit: () => (g.infuseSuit(r), closeOverlay()),
    dismantle: () => (g.dismantle(r), closeOverlay()),
    close: closeOverlay,
  });
}

function showTakeWeapon(w: WeaponInst) {
  const g = game!;
  const p = g.player;
  modal.innerHTML = `<div class="box"><h2>무기 — ${esc(w.def.name)}</h2>
    <div class="card" style="cursor:default">${weaponTooltip(w)}</div>
    <p class="lead" style="margin-top:12px">어느 손에 들까? 원래 든 무기는 바닥에 내려놓는다.</p>
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

function showRest() {
  const g = game!;
  modal.hidden = false;
  let body = '';
  if (g.restService === 'shop') {
    body = `<p class="lead">마석 <b>${g.ash}</b>. 산 물건은 보급 포드 바닥에 놓인다.</p>
      <div class="cards">${g.shop.map((s, i) => `<div class="card">${itemTooltip(s.item)}<div class="row"><button data-buy="${i}" ${g.ash < s.price ? 'disabled' : ''}>구매 (${s.price})</button></div></div>`).join('')}
      <div class="card"><div class="nm">플라스크 충전 +1</div><div class="ds">최대 ${g.flaskMax}/${FLASK.max} · 산 충전도 바로 채운다</div><div class="row"><button data-act="kit" ${g.ash < FLASK.upgradePrice || g.flaskMax >= FLASK.max ? 'disabled' : ''}>구매 (${FLASK.upgradePrice})</button></div></div></div>`;
  } else {
    body = g.restUsed
      ? '<p class="lead">재련을 마쳤다.</p>'
      : `<p class="lead">무기 하나의 옵션 하나를 다시 굴린다 (옵션이 없으면 하나를 붙인다). 한 번만.</p>
      <div class="cards">${g.player.hands
        .map((w, h) =>
          w
            ? `<div class="card">${weaponTooltip(w)}<div class="row">${
                w.options.length ? w.options.map((o, k) => `<button data-rf="${h}:${k}">${esc(OPTION_BY_ID[o].name)} 다시</button>`).join('') : `<button data-rf="${h}:0">옵션 붙이기</button>`
              }</div></div>`
            : '',
        )
        .join('')}</div>`;
  }
  const items = g.restItems;
  modal.innerHTML = `<div class="box"><h2>보급 지점 — ${REST_NAME[g.restService]}</h2>
    <p class="lead">${esc(g.depthLabel)}을(를) 지났다. 보급 포드가 슈트를 모두 수리했다. (체력 ${g.player.hp}/${g.st(g.player).maxHp})</p>
    ${body}
    ${items.length ? `<h3>보급 포드 바닥</h3><div class="cards">${items.map((r, i) => `<div class="card">${itemTooltip(r)}<div class="row"><button data-gr="${i}">${r.kind === 'weapon' ? '손에 들기' : r.kind === 'consumable' ? '벨트에 넣기' : '부여 · 분해'}</button></div></div>`).join('')}</div>` : ''}
    <div class="row"><span style="flex:1"></span><button data-act="leave">다음 층으로 (Enter)</button></div></div>`;
  modal.querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => (el.onclick = () => (g.buy(Number(el.dataset.buy)), refresh())));
  modal.querySelectorAll<HTMLElement>('[data-rf]').forEach(
    (el) =>
      (el.onclick = () => {
        const [h, k] = el.dataset.rf!.split(':').map(Number);
        g.reforge(h!, k!);
        refresh();
      }),
  );
  modal.querySelectorAll<HTMLElement>('[data-gr]').forEach(
    (el) =>
      (el.onclick = () => {
        pickItem = items[Number(el.dataset.gr)];
        overlay = 'pickup';
        refresh();
      }),
  );
  bind(modal, {
    kit: () => (g.buyFlask(), refresh()),
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
      <tr><td>색</td><td>${(['power', 'tactics', 'survival'] as const).map((c) => `${COLOR_NAME[c]} ${g.player.colors![c]}`).join(' · ')}</td></tr>
      <tr><td>복합 반응</td><td>${s.combos}</td></tr>
      <tr><td>무기</td><td>${g.player.hands.map((w) => (w ? esc(w.def.name) : '맨주먹')).join(' / ')}</td></tr>
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
  targeting = { x: foes[0].x, y: foes[0].y };
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
  game!.shoot(t.x, t.y);
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
  if (g.mode === 'levelup') {
    const c = COLORS[Number(e.key) - 1];
    if (c) (g.chooseColor(c), refresh());
    return;
  }
  if (overlay) {
    if (e.key === 'Escape' || (overlay === 'suit' && e.key === 'i') || (overlay === 'map' && e.key === 'Tab') || (overlay === 'lab' && e.key === 't')) {
      e.preventDefault();
      return closeOverlay();
    }
    const i = Number(e.key) - 1;
    if (overlay === 'pickup' && i >= 0) {
      if (pickItem?.kind === 'weapon') {
        if (i <= 1) {
          g.takeWeapon(pickItem, i);
          closeOverlay();
        }
      } else if (pickItem?.kind === 'consumable') {
        g.pickConsumable(pickItem);
        closeOverlay();
      } else if (pickItem) {
        const done = i <= 1 ? g.infuseWeapon(pickItem, i) : i === 2 ? g.infuseSuit(pickItem) : i === 3 ? g.dismantle(pickItem) : false;
        if (done) closeOverlay();
      } else {
        const items = g.groundHere();
        if (items[i]) ((pickItem = items[i]), refresh());
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
    else if (e.key === 'Enter' || e.key === 'f') return fireTarget();
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
    case '3':
    case '4':
    case '5':
      g.useInjection(Number(e.key) - 3);
      break;
    case 'g':
      if (g.groundHere().length) overlay = 'pickup';
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
    case 'q':
      g.useFlask();
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
    case 'c':
      cycleTheme();
      break;
    case 'z':
      toggleView();
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
  const thing = (items?.length || f || lv.barrels.has(i)) && lv.explored[i];
  if (foe || thing) {
    renderer.setMark(t[0], t[1]);
    renderer.setPath(null);
  } else {
    renderer.setMark(null);
    renderer.setPath(targeting ? null : g.pathTo(t[0], t[1]));
  }
  if (foe) return hud.showTooltip(actorTooltip(g, a), e.clientX, e.clientY);
  if (items?.length && lv.explored[i]) return hud.showTooltip(items.map(itemTooltip).join('<hr style="border-color:var(--g-line)">'), e.clientX, e.clientY);
  if (lv.barrels.has(i) && lv.explored[i]) return hud.showTooltip('<div class="t">기름통</div><div class="r">치거나 쏘거나 불이 닿으면 터진다 (주변 1칸 화염, 나도 맞는다)</div>', e.clientX, e.clientY);
  if (f?.kind === 'exit' && lv.explored[i]) return hud.showTooltip('<div class="t">출구</div><div class="r">보급 지점으로 이어진다</div>', e.clientX, e.clientY);
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

// 연출 속도 (V): 효과 사이 간격
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

// HUD 테마 (C): 원본 · 녹색 · 주황. 선택은 브라우저에 기억한다
type Theme = 'original' | 'green' | 'amber';
const THEMES: Theme[] = ['original', 'green', 'amber'];
const THEME_NAME: Record<Theme, string> = { original: '원본', green: '녹색', amber: '주황' };
const themebtn = document.getElementById('themebtn')!;
function loadTheme(): Theme {
  try {
    const t = localStorage.getItem('model0.theme') as Theme | null;
    if (t && THEMES.includes(t)) return t;
  } catch {
    /* 기본값 */
  }
  return 'amber';
}
function applyTheme(t: Theme) {
  document.body.dataset.theme = t;
  clearThemeCache();
  themebtn.textContent = `HUD ${THEME_NAME[t]} (C)`;
  try {
    localStorage.setItem('model0.theme', t);
  } catch {
    /* 이번 실행에서만 */
  }
}
function cycleTheme() {
  const cur = (document.body.dataset.theme as Theme) || 'amber';
  applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]!);
  if (game) refresh();
}
themebtn.addEventListener('click', cycleTheme);

// 시점 (Z): 45° 비스듬히 ↔ 완전 탑뷰
const viewbtn = document.getElementById('viewbtn')!;
function viewLabel() {
  viewbtn.textContent = renderer?.topDown ? '탑뷰 ▸ 45° (Z)' : '45° ▸ 탑뷰 (Z)';
}
function toggleView() {
  renderer.topDown = !renderer.topDown;
  viewLabel();
}
viewbtn.addEventListener('click', toggleView);
applyTheme(loadTheme());

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
  const barrel = g.level.barrels.has(g.level.idx(t[0], t[1]));
  if ((barrel || (foe && foe.faction === 'enemy')) && g.st(p).range > 1 && Math.max(Math.abs(dx), Math.abs(dy)) > 1) {
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
  const r = [...game.player.hands, ...game.groundHere()].find((x) => x?.uid === uid);
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
    viewLabel();
    showTitle();
  })
  .catch((err) => {
    modal.innerHTML = `<div class="box"><h2>에셋을 불러오지 못했다</h2><p class="lead">${esc(String(err))}</p></div>`;
  });

