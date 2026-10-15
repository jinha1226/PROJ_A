import { Game } from '../src/core/game';
import { botStep, expectedDpt } from './bot';
import type { OptionId, WeaponTrait } from '../src/core/types';
import { BOT_VALUE } from './optionScore';

export interface Spec { key: string; runs: number; bot: 'smart'|'simple'; weapon?: string; offhand?: string; infuse?: OptionId|'none'; star?: WeaponTrait; noPickup?: boolean }
export interface Result { summary: ReturnType<Game['summary']>; expectedSum: number; expectedSamples: number; steps: number; error?: string }
export function runSeed(spec:Spec,index:number):Result {
  const g=new Game(`sim-${index}`);
  if(spec.weapon)g.player.hands=[g.makeWeapon(spec.weapon),spec.offhand?g.makeWeapon(spec.offhand):null];
  if(spec.infuse!==undefined||spec.star){
    g.player.hands[0]!.infusion={from:'시뮬레이션 고정 부여',options:spec.infuse&&spec.infuse!=='none'?[spec.infuse]:[],trait:spec.star};
  }
  const out:Result={summary:g.summary(),expectedSum:0,expectedSamples:0,steps:0};
  try {
    for(;out.steps<BOT_VALUE.maxSteps;out.steps++){
      const w=g.player.hands[g.player.activeHand];
      const expected=new Map(g.visibleEnemies().map(target=>[target.id,w?expectedDpt(g,w,target):0]));
      const before=g.stats.playerHitAttempts;
      if(!botStep(g,spec.bot,{noPickup:!!spec.weapon||spec.noPickup||spec.infuse!==undefined||!!spec.star,lockInfusion:spec.infuse!==undefined||!!spec.star}))break;
      const events=g.drainEvents();
      if(g.stats.playerHitAttempts>before){
        const attack=events.find(e=>(e.type==='attack'||e.type==='shoot')&&e.actor===g.player.id&&e.target!==undefined);
        out.expectedSum+=expected.get(attack?.target??-1)??0;out.expectedSamples++;
      }
    }
  }catch(e){out.error=String(e);}
  out.summary=g.summary();return out;
}
export function aggregate(spec:Spec,results:Result[]){
  const rows=results.map(x=>x.summary),runs=rows.length;
  const total=(k:'playerHits'|'playerHitAttempts'|'enemyHits'|'enemyHitAttempts'|'turns'|'flasksUsed'|'armorReduced'|'armorIncoming')=>rows.reduce((n,r)=>n+r[k],0);
  const wins=rows.filter(r=>r.mode==='won').length;
  const monsterIds=[...new Set(rows.flatMap(r=>Object.keys(r.monsterCombat)))];
  const monsterCombat=Object.fromEntries(monsterIds.map(id=>{
    const entries=rows.map(r=>r.monsterCombat[id]).filter(Boolean);
    const sum=(k:'playerAttackAttempts'|'kills'|'damageToPlayer')=>entries.reduce((n,r)=>n+r[k],0);
    return [id,{attacks:sum('playerAttackAttempts'),kills:sum('kills'),averageAttacksToKill:sum('playerAttackAttempts')/Math.max(1,sum('kills')),damageToPlayer:sum('damageToPlayer')}];
  }));
  const wc=rows.flatMap(r=>Object.values(r.weaponCombat));
  const damage=wc.reduce((n,r)=>n+r.damage,0),cost=wc.reduce((n,r)=>n+r.actionCost,0);
  const expectedSamples=results.reduce((n,r)=>n+r.expectedSamples,0);
  return {spec,runs,wins,winRate:wins/runs,errors:results.filter(r=>r.error).map(r=>({seed:r.summary.seed,error:r.error})),
    unfinished:rows.filter(r=>r.mode!=='won'&&r.mode!=='dead').map(r=>r.seed),
    preBossDeathRate:rows.filter(r=>r.mode==='dead'&&r.zone===0&&r.floor<3).length/runs,
    averageDepth:rows.reduce((n,r)=>n+r.zone*4+r.floor+(r.mode==='won'?1:0),0)/runs,
    averageTurns:total('turns')/runs,playerHitRate:total('playerHits')/Math.max(1,total('playerHitAttempts')),
    enemyHitRate:total('enemyHits')/Math.max(1,total('enemyHitAttempts')),
    expectedDpt:results.reduce((n,r)=>n+r.expectedSum,0)/Math.max(1,expectedSamples),measuredDpt:damage*100/Math.max(1,cost),
    armorReductionRatio:total('armorReduced')/Math.max(1,total('armorIncoming')),flasksUsed:total('flasksUsed'),
    monsterCombat,depthDistribution:rows.reduce((o,r)=>{const k=r.mode==='won'?'승리':r.depth;o[k]=(o[k]??0)+1;return o;},{} as Record<string,number>),
    runsDetail:results};
}
export type Metrics=ReturnType<typeof aggregate>;
