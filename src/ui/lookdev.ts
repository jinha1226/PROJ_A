// 룩데브 데모 페이지 (/?lookdev): 쇼룸 방에서 카메라·조명을 조절하며 비교한다. 게임 화면에는 영향이 없다.
import type { View3D } from '../render/view3d';
import { getCameraElevation, setCameraTarget } from '../render/projr/grid/gridRuntime';

interface CamShot { name: string; elevation: number; zoom: number }
const KEY = 'model0.lookdev.cams';

function loadShots(): CamShot[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CamShot[];
  } catch {
    return [];
  }
}
function saveShots(s: CamShot[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 못 하면 이번 실행에서만 */
  }
}

/** 체크리스트 (design.md 룩데브 절과 같은 순서) */
const CHECKLIST: [string, boolean][] = [
  ['현재 카메라 위치·회전값 저장하고 60° 고도각 테스트', true],
  ['벽 메시를 하단·상단으로 나누고 카메라 쪽 벽 숨김 구현', false],
  ['환경광을 약하게 추가하고 시야 시스템 유지 확인', false],
  ['바닥 균열·잔해·혈흔 데칼 추가', false],
  ['기둥과 벽의 변형 모델 배치', false],
  ['블룸과 횃불 연출 최종 조정', false],
];

export function mountLookdev(view: View3D, hudEl: HTMLElement) {
  const el = document.createElement('div');
  el.id = 'lookdev';
  document.body.appendChild(el);
  let shots = loadShots();

  const render = () => {
    const rt = view.rt!;
    const elev = getCameraElevation();
    el.innerHTML = `<h3>룩데브</h3>
      <div class="ld-sec">카메라</div>
      <label>고도각 <b>${elev.toFixed(1)}°</b><input type="range" id="ld-elev" min="30" max="89.5" step="0.5" value="${elev}"></label>
      <div class="ld-row">${[45, 60, 75, 89.5].map((d) => `<button data-elev="${d}">${d === 89.5 ? '탑뷰' : `${d}°`}</button>`).join('')}</div>
      <label>보이는 높이 <b>${rt.zoom.toFixed(1)}m</b><input type="range" id="ld-zoom" min="6" max="32" step="0.5" value="${rt.zoom}"></label>
      <div class="ld-dim">회전(방위각): 0° 고정 — 북쪽이 화면 위</div>
      <div class="ld-row"><button id="ld-save">현재 카메라 저장</button></div>
      ${shots.map((s, i) => `<div class="ld-shot"><button data-load="${i}">${s.name}</button><span class="ld-dim">${s.elevation.toFixed(1)}° · ${s.zoom.toFixed(1)}m</span><button class="x" data-del="${i}">×</button></div>`).join('')}
      <div class="ld-sec">조명</div>
      <label>환경광 <b>${rt.hemi.intensity.toFixed(2)}</b><input type="range" id="ld-hemi" min="0" max="2" step="0.05" value="${rt.hemi.intensity}"></label>
      <div class="ld-sec">화면</div>
      <label class="ld-chk"><input type="checkbox" id="ld-hud" ${hudEl.hidden ? '' : 'checked'}> HUD 보이기</label>
      <div class="ld-dim">P: 도트/HD · 방향키: 이동</div>
      <div class="ld-sec">체크리스트</div>
      ${CHECKLIST.map(([t, done]) => `<div class="ld-todo ${done ? 'done' : ''}">${done ? '☑' : '☐'} ${t}</div>`).join('')}`;
  };
  render();
  el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const rt = view.rt!;
    if (t.id === 'ld-elev') setCameraTarget(Number(t.value));
    if (t.id === 'ld-zoom') rt.setZoom(Number(t.value));
    if (t.id === 'ld-hemi') rt.hemi.intensity = Number(t.value);
    if (t.id === 'ld-hud') hudEl.hidden = !t.checked;
    const b = t.parentElement?.querySelector('b');
    if (b && t.type === 'range') b.textContent = t.id === 'ld-elev' ? `${Number(t.value).toFixed(1)}°` : t.id === 'ld-zoom' ? `${Number(t.value).toFixed(1)}m` : Number(t.value).toFixed(2);
  });
  el.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    const rt = view.rt!;
    if (t.dataset.elev) setCameraTarget(Number(t.dataset.elev));
    if (t.id === 'ld-save') {
      shots.push({ name: `카메라 ${shots.length + 1}`, elevation: getCameraElevation(), zoom: rt.zoom });
      saveShots(shots);
    }
    if (t.dataset.load) {
      const s = shots[Number(t.dataset.load)]!;
      setCameraTarget(s.elevation);
      rt.setZoom(s.zoom);
    }
    if (t.dataset.del) {
      shots.splice(Number(t.dataset.del), 1);
      saveShots(shots);
    }
    shots = loadShots();
    render();
  });
  // 키 입력이 게임으로 넘어가지 않게 (슬라이더 조작 중)
  el.addEventListener('keydown', (e) => e.stopPropagation());
}
