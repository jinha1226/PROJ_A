# 작업: 전투 공식 v2 구현 + 밸런스 시뮬레이션

명세: `design.md`의 **「전투 공식 v2」** 절 (판정 순서, 능력치 출처, 무기 명중 표, 몬스터 명중·회피·AC 표, 시뮬레이션 명세). 그 절이 정답이다. 아래는 어디를 고치면 되는지의 안내.

## 1단계: 데이터
- `src/core/types.ts`
  - `WeaponDef`에 `accuracy: number`
  - `EnemyTemplate`(`src/data/enemies.ts`)에 `accuracy`, `evasion`, `ac`
  - 부산물 `stats`에 `ac?: number`, `accuracy?: number` (감각). 기존 `dodge`는 회피 **점수**로 의미만 바뀐다
  - `Actor`에 몬스터 종족 명중·회피·AC를 담을 칸 (예: `baseAccuracy`, `baseEvasion`, `baseAc`), 부위별 AC를 계산해 쓸 수 있게
- `src/data/weapons.ts`: 무기 명중 표 (맨주먹 `FISTS` 포함)
- `src/data/enemies.ts`: 몬스터 표
- `src/data/byproducts.ts`: 각 부산물에 `ac = ⌊integrity ÷ 5⌋` (integrity가 있는 것만)
- 슈트 기본값(`src/core/stats.ts`의 `SUIT` 근처): 기본 회피 3, 부위 AC 몸 3 · 팔 2 · 다리 2 · 감각 1. 공식 상수(80%, 3%p, 20%, 95%)도 이름 있는 상수로

## 2단계: 능력치 (`src/core/stats.ts` `computeStats`)
- `dodge`(%) → `evasion`(점수), 상한 45 제거. 플레이어: 슈트 3 + 다리·감각 부산물 dodge − ⌊슈트 칸 무게 합 ÷ 4⌋
- `accuracy` 추가: 플레이어 = 무기 명중 + 감각 부산물 accuracy + 연산(tactics) 회로 레벨, 몬스터 = 종족 명중 + 구역 × 2 (구역은 Game이 알므로 `Game.st()` 쪽에서 더해도 된다)
- 부위별 AC 함수 (예: `partAc(a, slot)`): 기본 + 그 칸 부산물 ac + 외피(survival) 회로 2레벨마다 +1, 파손이면 절반(내림). 몬스터 종족 AC는 몸에만
- 부산물 파손 배율(`byproductFactor`)이 다른 능력치처럼 ac·accuracy에도 적용되는지 확인

## 3단계: 판정 (`src/core/game.ts`)
- `dealDamage`(약 1551행): 지금의 회피 굴림(`ts.dodge / 100 + blindMiss`)을 **명중 굴림**으로 교체. 명중률 계산은 `hitChance(src, t)` 같은 공개 함수로 빼서 UI가 쓸 수 있게
  - 상태 보정: 실명(공격자) 명중 −6, 둔화(방어자) 회피 절반, 기절·빙결(방어자) 회피 0 + 95% 고정
  - 명세의 순서대로 명중 → 방패 막기. 지금 코드는 방패가 먼저다 — 명세 순서로 바꾼다
- 같은 함수의 장갑 블록(`const part = this.rng.weighted(SLOTS, ...)`): `감소량 = 무작위 0~부위 AC`, `체력 피해 = max(1, 피해 − 감소량)`, 부위 내구도(`partArmor`) −= 감소량, 0이면 `breakPart`. 관통은 건너뜀
  - **지금은 내구도가 피해 전부를 먼저 흡수한다 — 이 동작은 없앤다**
- 플레이어 공격 로그·연출(`emit({type:'damage'})`)은 체력 피해 기준으로

## 4단계: UI (`src/ui/hud.ts`, `src/data/infuse.ts`, `src/core/describe.ts`)
- 몬스터 툴팁(`actorTooltip`): "명중 74%"(플레이어가 이 몬스터를 맞힐 확률)와 "맞을 확률 77%"(이 몬스터가 플레이어를 맞힐 확률), 회피·AC 표기
- 슈트 화면 능력치: 명중, 회피, 부위별 AC
- 부산물 툴팁·슈트 칸 설명: `회피 +N%` → `회피 +N`, `AC +N` 추가

## 5단계: 시뮬레이션 (`sim/`)
- `sim/sim.ts`: 명세의 지표를 모두 집계해 콘솔 요약 + `sim/out/<날짜시각>.json`
  - 실측 명중률은 `Game.stats`에 시도·명중 수를 세어 얻는다 (플레이어→몬스터, 몬스터→플레이어 따로)
  - 장갑 감소 비율 = Σ감소량 ÷ Σ(감소 전 피해)
  - 몬스터 종류별·무기별 집계는 `templateId`, 무기 `def.id` 기준
- `sim/bot.ts`는 필요할 때만 고친다 (봇이 바뀌면 지표 비교가 깨지므로 바꾼 이유를 기록)

## 6단계: 밸런스
- 명세의 목표 (봇 승률 25~40%, 구역 1 보스 전 사망 ≤ 35%, 일반 몬스터 처치까지 2~4대, 플레이어 명중률 70~85%)에 맞춰 명세의 "조정 손잡이" 순서로 수치만 조정
- 조정할 때마다 `npm run sim -- 200` 이상으로 확인. 각 시도의 변경점과 결과 지표를 `docs/codex/combat-v2-log.md`에 표로 남긴다
- 최종 수치는 `design.md` 「전투 공식 v2」의 표에 반영 (문서와 코드가 같아야 한다)

## 완료 기준
- `npx tsc --noEmit` 통과
- `npm run sim -- 200` 오류 0, JSON 출력 생성, 목표 범위 충족 (못 맞춘 지표는 로그에 이유)
- 무기 실험실에서 허수아비 공격·로그 정상 (허수아비 회피·AC 0)
- 커밋은 단계별로 나눈다 (데이터 / 판정 / UI / 시뮬레이션 / 밸런스)
