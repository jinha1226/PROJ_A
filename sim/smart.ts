import { Game } from '../src/core/game';
import type { Actor, ByproductInst, GroundItem, InjectionId, WeaponInst } from '../src/core/types';
import { allByproducts, heldWeapon, magOf, partAc } from '../src/core/stats';
import { DIRS8, hasLos } from '../src/core/dungeon';
import { infuseOptions, OPPOSITE, starOf } from '../src/data/infuse';
import { SIGNATURE } from '../src/data/weapons';
import { BOT_VALUE as V, OPTION_SCORE, TRAIT_SCORE } from './optionScore';

export interface BotConfig { noPickup?: boolean; lockInfusion?: boolean }
const distance = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const memory = new WeakMap<Game, { floor: string; retreat: {x:number;y:number} | null; holding: boolean; enemies: Set<number> }>();

function infusionValue(g: Game, w: WeaponInst): number {
  const inf = w.infusion;
  if (!inf) return 0;
  const safe = g.player.hp >= g.st(g.player).maxHp * V.frenzyHp && partAc(g.player, 'body') >= V.frenzyAc;
  if (inf.options.includes('frenzy') && !safe) return -Infinity;
  const star = inf.trait ? TRAIT_SCORE[inf.trait] + (SIGNATURE[inf.trait]?.weapon === w.def.id ? V.signature : 0) : 0;
  return inf.options.reduce((n,o)=>n+OPTION_SCORE[o],0) + star;
}

/** 실제 명중 공식·정예·회로·옵션/★ 조건부 피해를 시간으로 나눈다. 조회 중 손 상태는 복원한다. */
export function expectedDpt(g: Game, w: WeaponInst, target?: Actor): number {
  const p=g.player, hand=p.activeHand, old=p.hands[hand];
  const combo=p.combo,hits=w.hits,ammo=w.ammo;
  p.hands[hand]=w;
  try {
    const s=g.st(p), t=target ?? g.visibleEnemies()[0];
    const hit=t ? g.hitChance(p,t)/100 : V.defaultHit;
    if(t){
      p.combo=combo?.target===t.id&&combo.weapon===w.uid&&p.prevAct==='attack'
        ?{target:t.id,weapon:w.uid,n:combo.n+1}:{target:t.id,weapon:w.uid,n:1};
      w.hits=(hits??0)+1;
      if(w.def.mag!==undefined&&w.ammo>0)w.ammo--;
    }
    const mods=t ? g.weaponMods(p,t,w) : {mult:1,critMult:1};
    return hit*s.damage*mods.mult*mods.critMult/(s.attackCost/100);
  } finally {p.hands[hand]=old;p.combo=combo;w.hits=hits;w.ammo=ammo;}
}

function suitValue(g: Game, r: ByproductInst): number {
  const st=r.def.stats;
  const elements=g.visibleEnemies().flatMap(e=>allByproducts(e).flatMap(b=>b.def.elements));
  let score=(st.integrity??0)*V.armor+(st.hp??0)*V.hp+(st.ac??0)*V.ac+(st.dodge??0)*V.dodge+
    (st.damage??0)*V.damage+(st.accuracy??0)*V.accuracy+(st.sight??0)*V.sight+(st.moveBonus??0)*V.move;
  score-=st.burden*V.weight*(r.def.slot==='leg'?1:2);
  for(const e of r.def.elements) score+=elements.filter(x=>x===e).length*V.resistance-elements.filter(x=>x===OPPOSITE[e]).length*V.weakness;
  if(r.def.curse) score-=V.curse;
  return score;
}

/** 손1·손2(덮어쓰기 차익)·슈트 교체 차익·분해를 같은 점수로 비교한다. */
export function smartByproduct(g: Game,r: ByproductInst,c: BotConfig): boolean {
  const p=g.player;
  const choices: {score:number; act:()=>boolean}[]=[{score:V.dismantle*({common:2,holy:4,forbidden:6}[r.def.grade]),act:()=>g.dismantle(r)}];
  if(!c.lockInfusion) p.hands.forEach((w,i)=>{
    if(!w)return;
    const next={...w,infusion:{from:r.def.name,options:infuseOptions(r.def),trait:starOf(r.def)}};
    const gain=infusionValue(g,next)-infusionValue(g,w);
    if(gain>0) choices.push({score:gain,act:()=>g.infuseWeapon(r,i)});
  });
  const old=p.slots[r.def.slot][0];
  const gain=suitValue(g,r)-(old?suitValue(g,old):0);
  if(gain>0)choices.push({score:gain,act:()=>g.equipSuit(r)});
  return choices.sort((a,b)=>b.score-a.score)[0].act();
}

function weaponValue(g:Game,w:WeaponInst,target?:Actor):number {
  return expectedDpt(g,w,target)+infusionValue(g,w);
}

export function smartTake(g: Game,r: GroundItem,c: BotConfig): boolean {
  if(r.kind==='byproduct')return smartByproduct(g,r,c);
  if(r.kind==='consumable')return g.pickConsumable(r);
  if(c.noPickup)return false;
  const hands=g.player.hands;
  let best=-1, gain=0;
  hands.forEach((w,i)=>{
    const other=hands[1-i];
    const diversity=(x:WeaponInst)=>other && (other.def.range>1)!==(x.def.range>1)?V.diversity:1;
    const value=weaponValue(g,r)*diversity(r)-(w?weaponValue(g,w)*diversity(w):0);
    if(value>gain){gain=value;best=i;}
  });
  return best>=0 && g.takeWeapon(r,best);
}
function inject(g:Game,id:InjectionId):boolean {
  if(g.player.injections![id])return false;
  const i=g.player.belt!.findIndex(x=>x?.def.id===id);
  return i>=0 && g.useInjection(i);
}

function narrow(g:Game,x:number,y:number):boolean {
  return DIRS8.filter(([dx,dy])=>g.level.isFloor(x+dx,y+dy)).length<=2;
}

/** 기름통이 통로를 막으면 일반 길찾기는 도달 불가를 돌려준다. 탐험된 칸만 다시 찾아 장애물을 치운다. */
function unblockRoute(g:Game,target?:{x:number;y:number}):boolean {
  const p=g.player,lv=g.level,start=lv.idx(p.x,p.y),queue=[start];
  const prev=new Int32Array(lv.tiles.length).fill(-1);prev[start]=start;
  let frontier=-1;
  for(let head=0;head<queue.length;head++){
    const idx=queue[head],x=idx%lv.w,y=Math.floor(idx/lv.w);
    if(idx!==start&&DIRS8.some(([dx,dy])=>lv.inBounds(x+dx,y+dy)&&!lv.explored[lv.idx(x+dx,y+dy)])&&frontier<0)frontier=idx;
    for(const [dx,dy]of DIRS8){
      const nx=x+dx,ny=y+dy,ni=lv.idx(nx,ny);
      if(!lv.isFloor(nx,ny)||!lv.explored[ni]||prev[ni]>=0)continue;
      if(dx&&dy&&(!lv.isFloor(x+dx,y)||!lv.isFloor(x,y+dy)))continue;
      prev[ni]=idx;queue.push(ni);
    }
  }
  let end=target&&lv.inBounds(target.x,target.y)?lv.idx(target.x,target.y):-1;
  if(end<0||prev[end]<0||end===start)end=frontier;
  if(end<0)return false;
  const route:number[]=[];
  for(let i=end;i!==start;i=prev[i])route.push(i);
  route.reverse();
  const barrel=route.find(idx=>lv.barrels.has(idx));
  if(barrel!==undefined){
    const b={x:barrel%lv.w,y:Math.floor(barrel/lv.w)};
    if(distance(p,b)>=2&&g.shoot(b.x,b.y))return true;
  }
  const next=route[0];
  return next!==undefined&&g.move(next%lv.w-p.x,Math.floor(next/lv.w)-p.y);
}

function retreat(g:Game,enemies:Actor[]):boolean {
  let m=memory.get(g);
  if(!m || m.floor!==g.depthLabel){m={floor:g.depthLabel,retreat:null,holding:false,enemies:new Set()};memory.set(g,m);}
  // 시야 밖으로 잠깐 사라져도 같은 적이면 교전이 이어진다. 새 적들만 보일 때 새 후퇴를 계획한다.
  if(m.enemies.size&&enemies.every(e=>!m.enemies.has(e.id))){m.retreat=null;m.holding=false;m.enemies.clear();}
  for(const e of enemies)m.enemies.add(e.id);
  if(enemies.length<2)return false;
  const p=g.player,lv=g.level;
  if(m.holding)return false;
  if(narrow(g,p.x,p.y)){m.holding=true;return false;}
  if(!m.retreat){
    const candidates=[];
    const pursuing=enemies.some(e=>e.awake);
    const range=Math.max(1,...p.hands.map(w=>w?.def.range??1));
    for(let y=0;y<lv.h;y++)for(let x=0;x<lv.w;x++){
      if(!lv.isFloor(x,y)||!lv.explored[lv.idx(x,y)]||!narrow(g,x,y)||g.actorAt(x,y)||lv.barrels.has(lv.idx(x,y)))continue;
      // 잠든 적은 추격하지 않는다. 전부 잠들었다면 그 칸에서 먼저 공격할 수 있어야 한다.
      if(!pursuing&&!enemies.some(e=>distance({x,y},e)<=range&&hasLos(lv,x,y,e.x,e.y)))continue;
      const path=g.pathTo(x,y);
      if(!path.length||path.some(t=>enemies.some(e=>distance(t,e)<=1)))continue;
      candidates.push({x,y,steps:path.length,safety:Math.min(...enemies.map(e=>distance({x,y},e)))});
    }
    m.retreat=candidates.sort((a,b)=>a.steps-b.steps||b.safety-a.safety)[0]??null;
  }
  if(!m.retreat)return false;
  const dir=g.stepToward(m.retreat.x,m.retreat.y);
  if(dir==='done'){m.retreat=null;return false;}
  if(inject(g,'haste'))return true;
  if(g.move(...dir)){
    if(narrow(g,p.x,p.y))m.holding=true;
    return true;
  }
  m.retreat=null;return false;
}

/** simple에 위임하지 않는 독립 전투·탐험 정책 */
export function smartStep(g:Game,c:BotConfig={}):boolean {
  const p=g.player;
  if(g.mode==='dead'||g.mode==='won')return false;
  if(g.mode==='levelup'){
    // 홀수 성장에서는 주 무기 색, 짝수 성장에서는 외피. 생존 무기는 외피에 집중한다.
    const total=Object.values(p.colors!).reduce((n,x)=>n+x,0);
    const counts={power:0,tactics:0,survival:0};
    for(const w of p.hands)for(const color of w?.def.colors??[])counts[color]++;
    const color=(Object.keys(counts) as (keyof typeof counts)[]).sort((a,b)=>counts[b]-counts[a]||p.colors![a]-p.colors![b])[0];
    return g.chooseColor(total%2===1?'survival':color);
  }
  if(g.mode==='rest'){
    if(g.restService==='shop'){g.buyFlask();for(let i=g.shop.length-1;i>=0;i--)if(g.shop[i].price<=g.ash)g.buy(i);}
    else g.reforge(p.activeHand);
    for(const r of [...g.restItems])smartTake(g,r,c);
    g.leaveRest();return true;
  }
  const s=g.st(p),enemies=g.visibleEnemies(),ex=g.level.exit;
  const escaping=g.alert>=2&&!g.isBossFloor&&!!g.level.explored[g.level.idx(ex.x,ex.y)];
  const near=enemies.slice().sort((a,b)=>distance(p,a)-distance(p,b)||a.hp-b.hp)[0];
  if(enemies.length){
    if(p.hp<s.maxHp*(distance(p,near)>1?V.preFlask:V.emergencyFlask)&&g.flask>0)return g.useFlask();
    if(p.hp<s.maxHp*V.hardenHp && inject(g,'harden'))return true;
    if(enemies.length>=2&&inject(g,'ignite'))return true;
    if((heldWeapon(p)?.def.range??1)>1&&inject(g,'focus'))return true;
  }
  if(escaping){
    if(inject(g,'haste'))return true;
    if(p.x===ex.x&&p.y===ex.y&&g.descend())return true;
    const dir=g.stepToward(ex.x,ex.y);
    if(dir!=='done'&&!g.actorAt(p.x+dir[0],p.y+dir[1])&&g.move(...dir))return true;
  }
  if(enemies.length){
    // 안전한 거리에서 적 옆 기름통을 먼저 터뜨린다. 근접 타격은 거리 1이므로 이 안전 조건에서 제외된다.
    const w=heldWeapon(p);
    if(w&&w.def.range>1&&(w.def.mag===undefined||w.ammo>0))for(const idx of g.level.barrels){
      const b={x:idx%g.level.w,y:Math.floor(idx/g.level.w)};
      if(distance(p,b)>=2&&enemies.some(e=>distance(e,b)<=1)&&g.shoot(b.x,b.y))return true;
    }
    if(retreat(g,enemies))return true;
    const d=distance(p,near),other=p.hands[1-p.activeHand];
    const usable=(x:WeaponInst)=>x.def.range===1?d<=1:(d<=x.def.range&&hasLos(g.level,p.x,p.y,near.x,near.y));
    // 교체 1턴의 비용을 감안해 30% 이상 이득일 때 교체. 탄약이 비면 예비 손 우선.
    if(other&&usable(other)&&(other.def.mag===undefined||other.ammo>0)&&
       (!w||!usable(w)||(w.def.mag!==undefined&&w.ammo===0)||weaponValue(g,other,near)>weaponValue(g,w,near)*V.swapMargin))return g.swapWeapon();
    if(w&&w.def.range>1){
      if(w.def.mag!==undefined&&w.ammo===0){if(!w.def.recharge)return g.reload();return g.wait();}
      if(usable(w)&&g.shoot(near.x,near.y))return true;
    }
    if(enemies.length>=2&&narrow(g,p.x,p.y)&&d>1&&enemies.every(e=>e.ai!=='ranged')&&g.stepToward(near.x,near.y)!=='done')return g.wait();
    if(d<=1&&g.move(Math.sign(near.x-p.x),Math.sign(near.y-p.y)))return true;
    const dir=g.stepToward(near.x,near.y);
    return dir==='done'?(unblockRoute(g,near)||g.wait()):g.move(...dir)||g.wait();
  }
  const w=heldWeapon(p);
  if(w?.def.mag!==undefined&&!w.def.recharge&&w.ammo<magOf(w))return g.reload();
  for(const r of [...g.groundHere()])if(smartTake(g,r,c))return true;
  const dir=g.autoExploreDir();
  if(dir==='enemy')return g.wait();
  if(dir!=='done')return g.move(...dir);
  if(p.x===ex.x&&p.y===ex.y)return g.descend()||g.wait();
  if(inject(g,'haste'))return true;
  const step=g.stepToward(ex.x,ex.y);
  return step==='done'?(unblockRoute(g,ex)||g.wait()):g.move(...step)||g.wait();
}
