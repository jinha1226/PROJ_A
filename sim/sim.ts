// 고정 시드 시뮬레이터. 자식 프로세스 작업 큐로 분산하며 완료 순서와 무관하게 시드 순으로 집계한다.
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Game, SUIT } from '../src/core/game';
import { ENEMIES, ENEMY_DAMAGE_MULT } from '../src/data/enemies';
import { BYPRODUCT_BY_ID } from '../src/data/byproducts';
import { SUIT_AC, SUIT_EVASION } from '../src/core/stats';
import { WEAPONS, SIGNATURE, STAR_TRAITS } from '../src/data/weapons';
import { FLASK } from '../src/data/consumables';
import { INFUSION_TUNING } from '../src/data/options';
import { OPTION_SCORE, TRAIT_SCORE } from './optionScore';
import { OPTION_BY_ID } from '../src/data/options';
import { aggregate, type Spec, type Result, type Metrics } from './runner';
import type { OptionId, WeaponTrait } from '../src/core/types';

const args=process.argv.slice(2);
const arg=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const positive=(x:string|undefined,d:number)=>{const n=x===undefined?d:Number(x);if(!Number.isInteger(n)||n<1)throw Error('판 수와 jobs는 양의 정수여야 한다.');return n;};
const runs=positive(args[0]?.startsWith('--')?undefined:args[0],50);
const jobs=positive(arg('--jobs'),availableParallelism());
const bot=arg('--bot')??'simple';
if(bot!=='smart'&&bot!=='simple')throw Error('알 수 없는 봇');
const weapon=arg('--weapon'),offhand=arg('--offhand'),infuse=arg('--infuse'),star=arg('--star');
for(const id of [weapon,offhand])if(id&&!WEAPONS.some(w=>w.id===id))throw Error(`알 수 없는 무기: ${id}`);
if(infuse&&infuse!=='none'&&!OPTION_BY_ID[infuse as OptionId])throw Error(`알 수 없는 부여: ${infuse}`);
if(star&&!STAR_TRAITS.includes(star as WeaponTrait))throw Error(`알 수 없는 ★: ${star}`);
const suite=arg('--suite');
const specs:Spec[]=suite==='weapons'?WEAPONS.map(w=>({key:w.id,runs:100,bot:'smart',weapon:w.id})):
  suite==='matrix'?WEAPONS.flatMap(w=>(['none','fire','cold','lightning','impact','riposte','bleed','ambush','aim'] as const).map(infuse=>({key:`${w.id}/${infuse}`,runs:30,bot:'smart' as const,weapon:w.id,infuse}))):
  suite==='stars'?Object.entries(SIGNATURE).map(([star,pair])=>({key:`${pair.weapon}/${star}`,runs:30,bot:'smart',weapon:pair.weapon,infuse:'none',star:star as WeaponTrait})):
  suite==='balance'?(['simple','smart'] as const).map(bot=>({key:bot,runs:200,bot})):
  [{key:bot,runs,bot,weapon,offhand,infuse:infuse as Spec['infuse'],star:star as Spec['star'],noPickup:args.includes('--no-pickup')}];
if(suite&&!['weapons','matrix','stars','balance'].includes(suite))throw Error('알 수 없는 suite');

// 실제 생성과 같은 부산물 장착·층 배율로 한 방을 계산한다. 템플릿 baseDamage만 보는 검사는 금지한다.
function audit(){
  const g=new Game('C1-audit');
  return ENEMIES.map(t=>{
    const actor={...g.player,isPlayer:false,faction:'enemy' as const,baseDamage:t.baseDamage,baseHp:t.hp,colors:undefined,hands:[],baseAccuracy:t.accuracy,baseEvasion:t.evasion,baseAc:t.ac,boss:t.boss,elite:t.id==='inquisitor',injections:undefined,
      slots:{body:[],arm:[],leg:[],sense:[]} as ActorSlots,partArmor:{body:0,arm:0,leg:0,sense:0},partArmorBase:{body:0,arm:0,leg:0,sense:0}};
    for(const id of t.byproducts){const b=g.makeByproduct(BYPRODUCT_BY_ID[id]);actor.slots[b.def.slot].push(b);}
    const damage=g.st(actor).damage,oneHit=damage*g.dmgMult(actor);
    return {id:t.id,name:t.name,damage,mult:g.dmgMult(actor),oneHit,c1:t.zone.includes(1)?oneHit>=SUIT_AC.body*1.5:null};
  });
}
type ActorSlots=Game['player']['slots'];
const c1=audit();
console.log('몬스터별 배율 적용 한 방 (구역1·층0 기준):',c1);
if(c1.some(r=>r.c1===false))throw Error('C1 위반: 시뮬레이션 중단');
const tasks=specs.flatMap(spec=>Array.from({length:Math.ceil(spec.runs/10)},(_,i)=>({spec,start:i*10,count:Math.min(10,spec.runs-i*10),id:0})));
tasks.forEach((t,i)=>t.id=i);
const grouped=new Map(specs.map(s=>[s.key,[] as Result[]]));
const t0=Date.now();let next=0,done=0;
await new Promise<void>((resolve,reject)=>{
  const workers=Array.from({length:Math.min(jobs,tasks.length)},()=>fork(fileURLToPath(new URL('./worker.ts',import.meta.url)),[],{execArgv:['--import','tsx'],stdio:['ignore','inherit','inherit','ipc']}));
  const stop=()=>workers.forEach(w=>w.kill());
  for(const w of workers){
    const dispatch=()=>{const t=tasks[next++];if(t)w.send(t);};
    w.on('error',e=>{stop();reject(e);});
    w.on('exit',(code,signal)=>{if(done<tasks.length){done=tasks.length;stop();reject(Error(`워커 비정상 종료: ${code} / ${signal}`));}});
    w.on('message',(msg:{key:string;results:Result[]})=>{
      grouped.get(msg.key)!.push(...msg.results);done++;
      if(done%10===0||done===tasks.length)console.log(`진행 ${done}/${tasks.length} 묶음 (${((Date.now()-t0)/1000).toFixed(1)}초)`);
      if(done===tasks.length){stop();resolve();}else dispatch();
    });dispatch();
  }
});
const metrics:Metrics[]=specs.map(s=>aggregate(s,grouped.get(s.key)!.sort((a,b)=>Number(a.summary.seed.slice(4))-Number(b.summary.seed.slice(4)))));
for(const m of metrics)console.log(JSON.stringify({...m,runsDetail:undefined}));
mkdirSync('sim/out',{recursive:true});
const path=arg('--out')??`sim/out/${suite??bot}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify({suite,jobs,elapsedMs:Date.now()-t0,c1,parameters:{suit:SUIT,suitAc:SUIT_AC,suitEvasion:SUIT_EVASION,flask:FLASK,enemyDamageMult:ENEMY_DAMAGE_MULT,enemies:ENEMIES,weapons:WEAPONS,infusionTuning:INFUSION_TUNING,optionScores:OPTION_SCORE,traitScores:TRAIT_SCORE},metrics},null,2));
console.log(`결과 저장: ${path}`);
if(metrics.some(m=>m.errors.length||m.unfinished.length))process.exitCode=1;
