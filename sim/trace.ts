import { Game } from '../src/core/game';
// 한 런의 마지막 로그를 출력 (디버그용)
const seed = process.argv[2] ?? 'sim-0';
const g = new Game(seed);
const logs: string[] = [];
const botArg=process.argv.indexOf('--bot');
const bot=botArg>=0?process.argv[botArg+1]:'simple';
if(bot!=='simple'&&bot!=='smart')throw Error('알 수 없는 봇');
const mod = await import('./bot');
for (let i = 0; i < 20000 && mod.botStep(g,bot); i++) for (const e of g.drainEvents()) if (e.type === 'log') logs.push(`[t${g.floorTurns} hp${g.player.hp}] ${e.text}`);
console.log(logs.slice(-40).join('\n'));
console.log(g.summary());
