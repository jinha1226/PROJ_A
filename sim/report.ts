import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SUIT } from '../src/core/game';
import { SUIT_AC, SUIT_EVASION } from '../src/core/stats';
import { ENEMIES, ENEMY_DAMAGE_MULT } from '../src/data/enemies';
import { WEAPONS, SIGNATURE } from '../src/data/weapons';
import { INFUSION_TUNING } from '../src/data/options';
import { FLASK } from '../src/data/consumables';
import { OPTION_SCORE, TRAIT_SCORE } from './optionScore';
import type { Metrics } from './runner';

type Bundle={metrics:Metrics[];elapsedMs:number;c1:{id:string;name:string;damage:number;mult:number;oneHit:number;c1:boolean|null}[]};
const read=(name:string):Bundle=>JSON.parse(readFileSync(`sim/out/${name}.json`,'utf8'));
const initialWeapons=read('r3-step2-weapons'),initialMatrix=read('r3-step3-matrix'),initialStars=read('r3-step3-stars');
const weapons=read('r3-final-weapons'),matrix=read('r3-final-matrix'),stars=read('r3-final-stars');
const attempts=Array.from({length:8},(_,i)=>i+1).filter(i=>existsSync(`sim/out/r3-attempt-${i}.json`)).map(i=>({i,data:read(`r3-attempt-${i}`)}));
const final=attempts.at(-1)!.data;
// 표를 쓰기 전에 조건 수와 시드 집합을 검증한다. 단순 봇의 원본 행동한도 초과는 별도 기록한다.
for(const [bundle,count,runs]of [[initialWeapons,9,100],[initialMatrix,81,30],[initialStars,23,30],[weapons,9,100],[matrix,81,30],[stars,23,30]] as const){
  assert.equal(bundle.metrics.length,count);
  for(const m of bundle.metrics){
    assert.equal(m.runs,runs);assert.equal(m.runsDetail.length,runs);assert.equal(m.errors.length,0);
    assert.deepEqual(m.runsDetail.map(r=>r.summary.seed),Array.from({length:runs},(_,i)=>`sim-${i}`));
  }
}
assert.equal(attempts.length,8);
for(const {data}of attempts)for(const m of data.metrics){assert.equal(m.runs,200);assert.equal(m.runsDetail.length,200);assert.equal(m.errors.length,0);}
for(const m of [...final.metrics.filter(m=>m.spec.bot==='smart'),...weapons.metrics,...matrix.metrics,...stars.metrics])assert.equal(m.unfinished.length,0,`smart 미종료: ${m.spec.key}`);

const learned=JSON.parse(readFileSync('sim/out/r3-learned.json','utf8')) as {deltas:Record<string,number>;scores:Record<string,number>;traitDeltas:Record<string,number>};
const notes=JSON.parse(readFileSync('sim/out/r3-notes.json','utf8')) as string[];
const pct=(n:number)=>(n*100).toFixed(1)+'%';
const num=(n:number)=>n.toFixed(2);
const table=(heads:string[],rows:(string|number)[][])=>`| ${heads.join(' | ')} |\n| ${heads.map(()=>'---').join(' | ')} |\n${rows.map(r=>`| ${r.join(' | ')} |`).join('\n')}\n`;
const normal=(m:Metrics)=>ENEMIES.filter(e=>!e.boss&&e.id!=='inquisitor').map(e=>m.monsterCombat[e.id]).filter(Boolean);
const attackRange=(m:Metrics)=>{const a=normal(m).map(x=>x.averageAttacksToKill);return `${num(Math.min(...a))}~${num(Math.max(...a))}`;};
const attackMean=(m:Metrics)=>{const a=normal(m);return a.reduce((n,x)=>n+x.attacks,0)/a.reduce((n,x)=>n+x.kills,0);};
const weaponTable=(d:Bundle)=>table(['무기','판 수','승률','도달 깊이','기대 DPT','실측 DPT','명중률'],d.metrics.map(m=>[WEAPONS.find(w=>w.id===m.spec.weapon)!.name,m.runs,pct(m.winRate),num(m.averageDepth),num(m.expectedDpt),num(m.measuredDpt),pct(m.playerHitRate)]));
const opts=['none','fire','cold','lightning','impact','riposte','bleed','ambush','aim'];
const matrixTable=(d:Bundle)=>table(['무기',...opts],WEAPONS.map(w=>[w.name,...opts.map(o=>{const m=d.metrics.find(m=>m.spec.weapon===w.id&&m.spec.infuse===o)!;return `${pct(m.winRate)} / ${num(m.measuredDpt)}`;})]));
const starTable=(d:Bundle)=>table(['★','짝 무기','승률','실측 DPT','none 대비'],d.metrics.map(m=>{
  const base=(d===stars?matrix:initialMatrix).metrics.find(x=>x.spec.weapon===m.spec.weapon&&x.spec.infuse==='none')!;
  return [m.spec.star!,SIGNATURE[m.spec.star!]!.name,pct(m.winRate),num(m.measuredDpt),((m.winRate-base.winRate)*100).toFixed(1)+'%p'];
}));
const average=matrix.metrics.reduce((n,m)=>n+m.winRate,0)/matrix.metrics.length;
const dominant=matrix.metrics.filter(m=>m.winRate>average*1.5);
const worse=matrix.metrics.filter(m=>m.spec.infuse!=='none'&&m.winRate<matrix.metrics.find(x=>x.spec.weapon===m.spec.weapon&&x.spec.infuse==='none')!.winRate);
const comboList=(rows:Metrics[])=>rows.map(m=>`${m.spec.key} ${pct(m.winRate)}`).join(', ')||'없음';
const finalMetricTable=table(['지표','simple 최종','simple 목표','smart 최종','smart 목표'],[
 ['승률',pct(final.metrics[0].winRate),'10~25%',pct(final.metrics[1].winRate),'35~55%'],
 ['구역1 보스 전 사망',pct(final.metrics[0].preBossDeathRate),'≤45%',pct(final.metrics[1].preBossDeathRate),'≤25%'],
 ['일반 적 종류별 처치 공격 수',attackRange(final.metrics[0]),'모두 2~4',attackRange(final.metrics[1]),'모두 2~4'],
 ['일반 적 전체 평균 공격 수',num(attackMean(final.metrics[0])),'2~4',num(attackMean(final.metrics[1])),'2~4'],
 ['실측 명중률',pct(final.metrics[0].playerHitRate),'70~85%',pct(final.metrics[1].playerHitRate),'70~85%'],
]);
const min=Math.min(...weapons.metrics.map(m=>m.winRate)),max=Math.max(...weapons.metrics.map(m=>m.winRate));
const finalNotes=`- 고정 무기 최저/최고 승률 = ${pct(min)} / ${pct(max)}, 비율 ${pct(min/max)} (목표 ≥60%).\n- 조합 평균 ${pct(average)}, 최고 ${pct(Math.max(...matrix.metrics.map(m=>m.winRate)))}, 최고/평균 ${num(Math.max(...matrix.metrics.map(m=>m.winRate))/average)} (목표 ≤1.5). none 미만 부여 ${worse.length}/72개 (목표 0개).\n- 30판의 승률 간격은 3.33%p이다. 아래의 지배적/쓸모없는 표시는 이 표본에서의 관측이며 통계적 유의성을 주장하지 않는다.\n`;
const residualAnalysis=`### 남은 미달과 원인

- smart 승률 ${pct(final.metrics[1].winRate)}는 목표 상한 55%를 ${(final.metrics[1].winRate*100-55).toFixed(1)}%p 넘는다. 선제 회복과 교전 기억을 포함한 정상 smart를 유지했으며 승률을 맞추기 위해 판단을 약화하지 않았다. 피해 배율까지 조정했지만 제어 부여가 생존에 주는 이득을 8회 안에 모두 평준화하지 못했다.
- 조합 최고/평균 ${num(Math.max(...matrix.metrics.map(m=>m.winRate))/average)}와 none 미만 ${worse.length}개는 미달이다. 지팡이+cold는90%, 같은 무기 none은30%다. raw DPT만으로 드러나지 않는 연속 둔화·빙결의 생존 이득이 크다는 해석을 지지한다. 화염·번개 부여는 공격 원소를 바꾸므로 적 저항과 복합 반응도 바꾸며, 단순 피해 상향만으로 모든 무기의 우열이 같아지지 않았다. 30판 표본 변동도 포함한다.
- ★ 단독(none 옵션)에서 frost 지팡이는83.3%(none 대비+53.3%p), 장검 combo3는16.7%(-16.7%p), desperate는30%(-3.3%p), flawless는13.3%(-20%p)다. combo3는 일반 적2~4타 처치·대상 전환으로 조건을 자주 잃고, desperate와 flawless는 선제 회복 또는 장갑 손상과 발동 조건이 충돌한다. 이 설명은 코드의 조건과 관측을 함께 본 해석이며, 30판 결과가 인과 효과의 확정값이라는 뜻은 아니다. repeater·nutcracker 같은 상태 의존 ★는 이번 단독 시험에서 별도 냉기 지원을 제공하지 않았다.
- simple sim-142는 원본 정책이 통로를 막는 기름통을 제거하지 않아 경로 대기로 행동한도에 도달한다. 비교 기준을 보존하기 위해 simple의 전술을 바꾸지 않았다. smart 및 최종 무기·조합·★에는 미종료가 없다.
- 무기 고정 시험은 부산물을 계속 부여할 수 있고, 조합 none 시험은 재부여를 잠근다. 따라서 무기 고정 승률과 행렬 none 승률을 같은 조건으로 비교하면 안 된다.

`;
let log=`# 밸런스 3차 기록\n\n## 실행 조건\n\n- AGENTS.md와 balance-r3.md의 1→2→3→4 순서로 수행. stash 미사용, commit/push 없음, src/render/ 미수정. 사용자 지시에 따라 원 명세의 판 수 축소 예외는 사용하지 않았다.\n- 시드는 각 조건에서 sim-0부터 고정: 무기 100판, 조합·★ 30판, 각 조정 시도 simple/smart 각각 200판. 병렬 jobs=12, 작업 묶음 10판. 결과는 완료 순서와 무관하게 시드 순서로 집계한다.\n- 명령: \`node --import tsx sim/sim.ts --suite weapons|matrix|stars|balance --jobs 12 --out <파일>\`. 일반 CLI는 \`node --import tsx sim/sim.ts N --bot smart|simple --weapon <id> --offhand <id> --infuse <option|none> --star <trait> --no-pickup --jobs N\` 중 필요한 인자를 쓴다.\n- 원시 결과: sim/out/r3-step2-weapons.json, r3-step3-matrix.json, r3-step3-stars.json, r3-learned.json, r3-attempt-번호.json, r3-final-{weapons,matrix,stars}.json (기존 gitignore 대상). 이 문서에는 모든 필수 집계표를 보존한다.\n- 도달 깊이: 구역 번호(0부터)×4 + 층 번호(0부터), 승리=8. DPT는 100 행동시간당 피해. 기대 DPT는 공격 직전 Game.hitChance × Game.st.damage × 옵션·★ 조건부 배율 ÷ (attackCost/100)의 공격 표본 평균. 실측 DPT는 무기에 기록된 체력 피해 합 / 공격 행동시간 합 ×100이며 상태 피해·연쇄도 게임의 기존 귀속 규칙을 따른다. 이동·교체·재장전 시간은 두 DPT의 분모에 포함하지 않는다.\n- 종류별 공격 수는 기존 계측의 해당 종류 기본 공격 시도/처치 수다. 진행 중 적에 대한 시도도 포함되고 기름통·상태 처치에는 기본 공격이 없을 수 있다. 두 봇 모두 같은 정의다.\n\n## 1. 봇 구현과 검증\n\n- simple의 기본 정책 보존. smart는 전투를 simple에 위임하지 않는다.\n- 무기: 실제 명중·정예 피해·회로·공격시간으로 기대 DPT를 계산하고 옵션/★ 경험 점수를 더한다. 근접/원거리 보완 보너스 1.3배로 한 자루씩 유지하되 큰 점수 차이는 허용한다. 교체 1턴을 고려해 30% 이득 또는 사거리·탄약 문제일 때 손을 바꾼다. 원거리 무기는 붙은 적도 직접 사격한다.\n- 부산물: 손1 부여, 손2 부여, 슈트 교체, 분해를 전부 점수 비교. 덮어쓰기는 새 부여−기존 부여가 양수일 때만. ★ 짝 무기 추가 1.25점. 폭주는 체력 ≥75% 및 몸 AC≥5일 때만 허용한다.\n- 슈트: 장갑·체력·AC·회피·공격·명중·시야·이동 이득에서 무게·저주·현재 보이는 적의 반대 원소 약점을 뺀다. 기존 칸과 차익을 비교한다.\n- 전투 전 적과 거리>1이고 체력<60%면 플라스크, 붙은 뒤에는 40% 미만에서 응급 사용. 주사제는 50% 미만 경화, 적 2명 이상 점화, 원거리 사용 집중, 도망·출구 이동 가속.\n- 적 옆 기름통은 거리≥2에서 사격. 근접 공격은 사거리1이므로 안전 거리에서 직접 칠 수 없다. 통로가 기름통으로 봉쇄된 경우 탐험된 칸만 사용한 별도 경로로 접근·제거한다.\n- 적 2명 이상이면 이웃 바닥≤2인 탐험된 칸으로 후퇴. 거리·횟수 제한 없이 탐험된 지도 전체의 도달 가능한 후보를 비교하고, 한 교전에서 도착한 상태와 이미 본 적 id를 기억하며, 잠깐의 시야 단절을 새 교전으로 오인하지 않는다. 근접 적은 기다리되 원거리 적 때문에 접근할 때는 재후퇴 왕복을 하지 않는다. 안전한 후보가 없으면 현재 자리에서 싸운다. 경보2부터 알려진 출구를 우선한다.\n- 레벨업은 홀수 성장에 무기 색, 짝수 성장에 외피. survival 무기는 외피에 집중한다. 주석으로 규칙을 남겼다.\n- 수정한 봇 오류: 대각선 벽 모서리 공격 실패 시 조기 종료, 기름통 봉쇄 경로에서 무한 대기, 좁은 칸에서 다시 전진, 좁은 칸 탐색 거리·후퇴 횟수의 임의 제한, 학습 ★ 점수가0일 때 짝 무기 가산 누락. 잠든 적을 깨우기 전에 시야 밖으로 후퇴해 재접근하던 왕복도 공격 가능한 칸 선택으로 수정했다. 이 항목들을 최종 정책 검토에서 바로잡고 8회차와 최종 전수 검증을 같은 수치로 다시 실행했다. 최초 미종료 dagger/impact sim-18, bow/cold sim-5는 진단 후 전체 81조건을 재실행했다. 미종료 실험을 점수 학습에 쓰지 않았다.\n\n## 2. 초기 무기 고정 (9종 ×100판)\n\n${weaponTable(initialWeapons)}\n## 3. 초기 조합 (81개 ×30판)\n\n각 셀은 승률 / 실측 DPT. 무기 줍기·재부여를 끄고 슈트 재료 사용과 재련은 허용한다.\n\n${matrixTable(initialMatrix)}\n### 초기 ★ 짝 (23개 ×30판)\n\n옵션 none에 ★만 넣어 일반 옵션 효과와 분리했다.\n\n${starTable(initialStars)}\n### 점수 갱신\n\n옵션별 9무기의 (부여 승률−같은 무기 none 승률) 평균을 사용. 점수=max(0, 평균 상승분×20), 즉 5%p=1점. ★는 짝 무기 none과의 차이를 같은 방식으로 환산했다. 원시 음수도 아래 표에 남긴다. 나머지 20옵션과 기본 무기 동작 trait은 초기 추정값을 유지한다. 최종 재검증 뒤에 점수를 다시 학습해 최종 정책을 바꾸지는 않았다.\n\n${table(['옵션','평균 상승','점수'],Object.entries(learned.deltas).map(([id,d])=>[id,(d*100).toFixed(2)+'%p',num(OPTION_SCORE[id as keyof typeof OPTION_SCORE])]))}\n${table(['★','승률 상승','점수'],Object.entries(learned.traitDeltas).map(([id,d])=>[id,(d*100).toFixed(2)+'%p',num(TRAIT_SCORE[id as keyof typeof TRAIT_SCORE])]))}\n## 4. 밸런스 시도 (${attempts.length}/8회)\n\n${notes.map((n,i)=>`${i+1}. ${n}`).join('\n')}\n\n${table(['시도','봇','판 수','승률','보스 전 사망','명중률','일반 적 공격 수 범위','실측 DPT','오류/미종료'],attempts.flatMap(({i,data})=>data.metrics.map(m=>[i,m.spec.bot,m.runs,pct(m.winRate),pct(m.preBossDeathRate),pct(m.playerHitRate),attackRange(m),num(m.measuredDpt),`${m.errors.length}/${m.unfinished.length}`])))}\n### 최종 목표 대비\n\n${finalMetricTable}\n${finalNotes}\n### 최종 일반 적 종류별 공격 수\n\n${table(['몬스터','simple','smart'],ENEMIES.filter(e=>!e.boss&&e.id!=='inquisitor').map(e=>[e.name,...final.metrics.map(m=>num(m.monsterCombat[e.id]?.averageAttacksToKill??0))]))}\n### C1 실제 한 방\n\n아래는 구역1·층0에서 Game.st(적).damage(팔 포함) × dmgMult이다. 실제 타격은 이 곱을 반올림한 다음 피해 파이프라인을 탄다. C1 기준은 몸 기본 AC×1.5=${SUIT_AC.body*1.5}. 구역1 일반 적 전부 통과해야 실행된다.\n\n${table(['몬스터','팔 포함 피해','배율','배율 적용 한 방','C1'],weapons.c1.map(r=>[r.name,r.damage,r.mult,num(r.oneHit),r.c1===null?'대상 외':r.c1?'통과':'실패']))}\n### 최종 무기 고정 (9종 ×100판 재검증)\n\n${weaponTable(weapons)}\n### 최종 조합 (81개 ×30판 재검증)\n\n각 셀은 승률 / 실측 DPT.\n\n${matrixTable(matrix)}\n- 평균의 1.5배를 넘는 지배적 조합: ${comboList(dominant)}\n- 같은 무기 none 미만인 조합(관측상 쓸모없음): ${comboList(worse)}\n\n### 최종 ★ 짝 (23개 ×30판 재검증)\n\n${starTable(stars)}\n### 최종 수치\n\n- SUIT: HP ${SUIT.hp}, 기본 피해 ${SUIT.damage}, 부위 내구도 ${JSON.stringify(SUIT.armor)}. 실제 회피는 SUIT_EVASION=${SUIT_EVASION}, AC=${JSON.stringify(SUIT_AC)}. SUIT.dodge는 현재 computeStats에서 사용하지 않는 레거시 필드다.\n- FLASK: ${JSON.stringify(FLASK)}\n- 옵션 수치: ${JSON.stringify(INFUSION_TUNING)} (★ frost/smash의 고유 제어 지속은 기존 2턴).\n- 몬스터 피해 배율: ${JSON.stringify(ENEMY_DAMAGE_MULT)}\n\n${table(['몬스터','HP','기본 피해','명중','회피','몸 AC'],ENEMIES.map(e=>[e.name,e.hp,e.baseDamage,e.accuracy,e.evasion,e.ac]))}\n${table(['무기','피해','명중','공격시간','사거리','탄창','재충전'],WEAPONS.map(w=>[w.name,w.damage,w.accuracy,w.attackCost,w.range,w.mag??'—',w.recharge??'—']))}\n${residualAnalysis}### 검증·한계\n\n- 최종 전수 검증 오류 ${[...final.metrics,...weapons.metrics,...matrix.metrics,...stars.metrics].reduce((n,m)=>n+m.errors.length,0)}건. 행동한도 미종료 ${[...final.metrics,...weapons.metrics,...matrix.metrics,...stars.metrics].reduce((n,m)=>n+m.unfinished.length,0)}판: ${[...final.metrics,...weapons.metrics,...matrix.metrics,...stars.metrics].filter(m=>m.unfinished.length).map(m=>m.spec.key+': '+m.unfinished.join(', ')).join('; ')||'없음'}. 승률 분모에서 제외하지 않았으며 사망률에는 사망으로 넣지 않았다. 원시 결과에는 각 시드별 모드·통계가 남는다.\n- npx tsc --noEmit 통과. smart 행동 회귀 29개 통과(실험실·쇼룸 생성 및 무기·★ 편집 포함). jobs=1/jobs=4의 같은 20시드 전체 결과 일치. Vite production build는 기존 dist 자산 복사 EPERM으로 기본 출력이 실패했으나, \`node node_modules/vite/bin/vite.js build --outDir /tmp/proj-a-r3-build --emptyOutDir\`로 통과했다. 기존 번들 크기 경고는 남는다.\n- 달성하지 못한 항목은 최종 목표 대비 표와 개별 조합 목록에 그대로 남겼다. 30판에서 none보다 낮다는 사실만으로 효과의 인과적 해로움을 단정하지 않는다. 경로·난수 소비·성장 경로가 달라지는 영향이 있다. 지정된 최대 시도 안에서 정책과 수치를 고정해 최종 전수 재검증을 수행했다.\n`;
writeFileSync('docs/codex/balance-r3-log.md',log);
const path='design.md';let design=readFileSync(path,'utf8');
const marker='### 최종 검증 결과';const start=design.indexOf(marker,design.indexOf('## 밸런스 3차'));
if(start>=0)design=design.slice(0,start);
design+=`${marker}\n\n${finalMetricTable}\n${finalNotes}\n${weaponTable(weapons)}\n- 미달: smart 승률 상한 초과, 조합 최고/평균 비율과 none 미만 8개. 제어 부여의 생존 이득과 원소 저항·상태 조건의 상호작용을 8회 안에 평준화하지 못했다. simple 원본은 sim-142 한 판이 행동한도에 도달했으며 승률 분모 200에 포함했다.\n- 조합 81개와 ★ 짝 23개를 각각 30판 검증했다. 전체 행렬·★ 표·시도 기록은 [밸런스 기록](docs/codex/balance-r3-log.md)에 있다.\n- 최종 슈트 HP ${SUIT.hp}, 기본 피해 ${SUIT.damage}, 회피 ${SUIT_EVASION}, 몸/팔/다리/감각 AC ${Object.values(SUIT_AC).join('/')}, 내구도 ${Object.values(SUIT.armor).join('/')}. 플라스크 시작 ${FLASK.start}, 최대 ${FLASK.max}, 회복 ${FLASK.heal*100}%, 수리 ${FLASK.repair}.\n- 최종 옵션: 냉기 둔화/빙결 ${INFUSION_TUNING.coldTurns}턴, 충격 기절 ${INFUSION_TUNING.impactTurns}턴, 화염 피해 ×${INFUSION_TUNING.fireMult}, 출혈 대상 ×${INFUSION_TUNING.bleedMult}, 정조준 상시 명중 +${INFUSION_TUNING.aimAccuracy}. ★ 고유 지속은 기존 2턴.\n- 최종 몬스터 피해 배율: 일반 ${ENEMY_DAMAGE_MULT.normalBase}, 정예·보스 ${ENEMY_DAMAGE_MULT.eliteBossBase}, 구역당 ${ENEMY_DAMAGE_MULT.perZone}, 층당 ${ENEMY_DAMAGE_MULT.perFloor}.\n\n${table(['몬스터','HP','기본 피해','명중','회피','몸 AC'],ENEMIES.map(e=>[e.name,e.hp,e.baseDamage,e.accuracy,e.evasion,e.ac]))}\n${table(['무기','피해','명중','공격시간','사거리','탄창','재충전'],WEAPONS.map(w=>[w.name,w.damage,w.accuracy,w.attackCost,w.range,w.mag??'—',w.recharge??'—']))}\n`;
writeFileSync(path,design.trimEnd()+'\n');
console.log('balance-r3-log.md와 design.md 갱신 완료');
