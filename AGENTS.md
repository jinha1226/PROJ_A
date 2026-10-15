# AGENTS.md — MODEL 0 (잔해의 탑)

턴제 로그라이크 (Vite 5 + TypeScript 5 + three.js). 기획 문서는 `design.md` (한국어). 작업 지시는 `docs/codex/`.

## 명령
- 타입 검사: `npx tsc --noEmit` (반드시 통과)
- 봇 시뮬레이션: `npm run sim -- N` (N판, `sim/sim.ts` + `sim/bot.ts`)
- 한 판 추적: `npx tsx sim/trace.ts <seed>`
- 개발 서버: `npx vite --port 5173`

## 구조
- `src/core/` 게임 규칙 (렌더링과 무관, 시뮬레이션이 그대로 씀): `game.ts`(턴·전투·피해), `stats.ts`(능력치 계산), `types.ts`, `dungeon.ts`, `josa.ts`(조사)
- `src/data/` 수치 표: `weapons.ts`, `enemies.ts`, `byproducts.ts`, `options.ts`, `consumables.ts`, `infuse.ts`
- `src/ui/` HUD·툴팁 (`hud.ts`), `src/main.ts` 입력·화면 흐름
- `src/render/` 3D 렌더러 — 규칙 작업에서는 건드리지 않는다

## 규칙
- 주석·로그·UI 문구는 한국어. 주변 코드의 말투와 주석 밀도를 따른다
- 로그 문구는 DCSS 원문 형식을 따른다 (예: "고블린을 맞혔다!", "고블린의 공격이 빗나갔다."), 조사는 `josa()`로
- 수치는 `src/data/`의 표나 이름 있는 상수로 둔다 (함수 안에 숫자를 흩뿌리지 않는다)
- `design.md`에 정해진 공식을 바꿔야 하면 코드보다 문서를 먼저 고치고 이유를 적는다
- 무기 실험실(`lab`)과 룩데브 쇼룸(`showroom`)이 계속 동작해야 한다
