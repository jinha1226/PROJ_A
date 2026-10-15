// 헤드리스 자동 대전 시뮬레이터: 렌더링 없이 로직만 돌려 각인 연쇄·런 길이·승률을 대량 측정한다.
// 사용: npm run sim -- [런 수=50] [기원] [몸체]
import { Game } from '../src/core/game';
import { ORIGINS, BODIES } from '../src/data/start';
import { botStep } from './bot';

const runs = Number(process.argv[2] ?? 50);
const originArg = process.argv[3];
const bodyArg = process.argv[4];
const results: ReturnType<Game['summary']>[] = [];
let errors = 0;
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  const origin = originArg ?? ORIGINS[i % ORIGINS.length].id;
  const body = bodyArg ?? BODIES[(i / ORIGINS.length | 0) % BODIES.length].id;
  const g = new Game(`sim-${i}`, origin, body);
  try {
    for (let step = 0; step < 20000; step++) {
      if (!botStep(g)) break;
      g.drainEvents();
    }
  } catch (e) {
    errors++;
    console.error(`seed sim-${i}:`, e);
  }
  results.push({ ...g.summary(), origin, body } as never);
}
const won = results.filter((r) => r.mode === 'won').length;
const avg = (f: (r: (typeof results)[number]) => number) => (results.reduce((s, r) => s + f(r), 0) / results.length).toFixed(1);
const depthCount = new Map<string, number>();
for (const r of results) depthCount.set(r.mode === 'won' ? '승리' : r.depth, (depthCount.get(r.mode === 'won' ? '승리' : r.depth) ?? 0) + 1);
const allFloorTurns = results.flatMap((r) => r.floorTurns);
console.log(`\n=== ${runs}런 시뮬레이션 (${Date.now() - t0}ms) ===`);
console.log(`승리: ${won}/${runs} (${((won / runs) * 100).toFixed(0)}%)  오류: ${errors}`);
console.log(`평균 턴: ${avg((r) => r.turns)}  평균 처치: ${avg((r) => r.kills)}  평균 레벨: ${avg((r) => r.level)}`);
console.log(`평균 각인 발동: ${avg((r) => r.triggers)}  복합 반응: ${avg((r) => r.combos)}  최대 연쇄 깊이: ${Math.max(...results.map((r) => r.maxDepth))}`);
console.log(`층당 평균 턴: ${(allFloorTurns.reduce((a, b) => a + b, 0) / Math.max(1, allFloorTurns.length)).toFixed(0)}`);
console.log('도달 지점:', Object.fromEntries(depthCount));
