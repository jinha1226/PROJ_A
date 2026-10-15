// 헤드리스 자동 대전 시뮬레이터: 렌더링 없이 로직만 돌려 런 길이·승률·색 성장을 대량 측정한다.
// 사용: npm run sim -- [런 수=50]
import { mkdirSync, writeFileSync } from 'node:fs';
import { Game } from '../src/core/game';
import { botStep } from './bot';

const runs = Number(process.argv[2] ?? 50);
const results: ReturnType<Game['summary']>[] = [];
let errors = 0;
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  const g = new Game(`sim-${i}`);
  try {
    for (let step = 0; step < 20000; step++) {
      if (!botStep(g)) break;
      g.drainEvents();
    }
  } catch (e) {
    errors++;
    console.error(`seed sim-${i}:`, e);
  }
  results.push(g.summary());
}
const won = results.filter((r) => r.mode === 'won').length;
const avg = (f: (r: (typeof results)[number]) => number) => (results.reduce((s, r) => s + f(r), 0) / results.length).toFixed(1);
const depthCount = new Map<string, number>();
for (const r of results) depthCount.set(r.mode === 'won' ? '승리' : r.depth, (depthCount.get(r.mode === 'won' ? '승리' : r.depth) ?? 0) + 1);
const allFloorTurns = results.flatMap((r) => r.floorTurns);
console.log(`\n=== ${runs}런 시뮬레이션 (${Date.now() - t0}ms) ===`);
console.log(`승리: ${won}/${runs} (${((won / runs) * 100).toFixed(0)}%)  오류: ${errors}`);
console.log(`평균 턴: ${avg((r) => r.turns)}  평균 처치: ${avg((r) => r.kills)}  평균 레벨: ${avg((r) => r.level)}`);
console.log(`복합 반응: ${avg((r) => r.combos)}  색(화력/기술/생존): ${avg((r) => r.colors.power)} / ${avg((r) => r.colors.tactics)} / ${avg((r) => r.colors.survival)}`);
console.log(`층당 평균 턴: ${(allFloorTurns.reduce((a, b) => a + b, 0) / Math.max(1, allFloorTurns.length)).toFixed(0)}`);
console.log('도달 지점:', Object.fromEntries(depthCount));

const total = (k: 'playerHitAttempts' | 'playerHits' | 'enemyHitAttempts' | 'enemyHits' | 'armorReduced' | 'armorIncoming') => results.reduce((n, r) => n + r[k], 0);
const metrics = {
  runs, errors, wins: won, winRate: won / runs,
  preBossDeathRate: results.filter((r) => r.mode !== 'won' && r.zone === 0 && r.floor < 3).length / runs,
  averageDepth: results.reduce((n, r) => n + r.zone * 4 + r.floor, 0) / runs,
  averageTurns: results.reduce((n, r) => n + r.turns, 0) / runs,
  playerHitRate: total('playerHits') / Math.max(1, total('playerHitAttempts')),
  enemyHitRate: total('enemyHits') / Math.max(1, total('enemyHitAttempts')),
  armorReductionRatio: total('armorReduced') / Math.max(1, total('armorIncoming')),
  partBreaks: Object.fromEntries((['body', 'arm', 'leg', 'sense'] as const).map((k) => [k, results.reduce((n, r) => n + r.partBreaks[k], 0)])),
  depthDistribution: Object.fromEntries(depthCount),
  flasksUsed: results.reduce((n, r) => n + r.flasksUsed, 0),
  monsterCombat: Object.fromEntries([...new Set(results.flatMap((r) => Object.keys(r.monsterCombat)))].map((id) => {
    const rows = results.map((r) => r.monsterCombat[id]).filter((x) => !!x);
    const sum = (k: 'playerAttackAttempts' | 'attacksAgainstPlayer' | 'damageToPlayer' | 'kills') => rows.reduce((n, x) => n + x[k], 0);
    return [id, { averageAttacksToKill: sum('playerAttackAttempts') / Math.max(1, sum('kills')), averageDamageToPlayer: sum('damageToPlayer') / Math.max(1, rows.length), playerKills: sum('kills') }];
  })),
  weaponCombat: Object.fromEntries([...new Set(results.flatMap((r) => Object.keys(r.weaponCombat)))].map((id) => {
    const rows = results.map((r) => r.weaponCombat[id]).filter((x) => !!x);
    const attacks = rows.reduce((n, x) => n + x.attacks, 0);
    const damage = rows.reduce((n, x) => n + x.damage, 0);
    return [id, { useShare: attacks / Math.max(1, results.reduce((n, r) => n + Object.values(r.weaponCombat).reduce((m, v) => m + v.attacks, 0), 0)), averageDps: damage * 100 / Math.max(1, rows.reduce((n, x) => n + x.actionCost, 0)), averageDamagePerAttack: damage / Math.max(1, attacks), kills: rows.reduce((n, x) => n + x.kills, 0), wins: results.filter((r) => r.mode === 'won' && !!r.weaponCombat[id]).length }];
  })),
  runsDetail: results,
};
console.log(`실측 명중률: 플레이어 ${(metrics.playerHitRate * 100).toFixed(1)}% · 몬스터 ${(metrics.enemyHitRate * 100).toFixed(1)}%`);
console.log('몬스터별:', metrics.monsterCombat);
console.log('무기별:', metrics.weaponCombat);
console.log(`플라스크 사용: ${metrics.flasksUsed}회 · 장갑 감소 비율: ${(metrics.armorReductionRatio * 100).toFixed(1)}% · 구역 1 보스 전 사망: ${(metrics.preBossDeathRate * 100).toFixed(1)}%`);
mkdirSync('sim/out', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(`sim/out/${stamp}.json`, JSON.stringify(metrics, null, 2));
