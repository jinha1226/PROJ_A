import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game';
import { Level } from '../src/core/dungeon';
import { runSeed } from './runner';
import { expectedDpt, smartByproduct, smartStep, smartTake } from './smart';
import type { Actor, InjectionId } from '../src/core/types';

// 실제 Game API로 행동 결과를 확인한다. 전투는 피해·명중 난수에 의존하지 않는 상태 변화로 검증한다.
function arena(weapon='pistol') {
  const g=new Game('smart-policy-test',{lab:true});
  g.level=new Level(12,12);
  for(let y=1;y<11;y++)for(let x=1;x<11;x++)g.level.tiles[g.level.idx(x,y)]=1;
  g.level.explored.fill(1);g.level.visible.fill(1);
  g.level.features=[{kind:'exit',x:1,y:1}];
  g.player.x=5;g.player.y=5;g.player.hands=[g.makeWeapon(weapon),null];g.player.activeHand=0;
  g.ground.clear();g.actors=[g.player];g.drainEvents();
  return g;
}
function enemy(g:Game,x:number,y:number):Actor {
  const e:Actor={...g.player,id:100+g.actors.length,name:'시험 적',isPlayer:false,faction:'enemy',x,y,
    hp:100,baseHp:100,baseDamage:1,baseAccuracy:0,baseEvasion:0,baseAc:0,hands:[],colors:undefined,
    slots:{body:[],arm:[],leg:[],sense:[]},partArmor:{body:0,arm:0,leg:0,sense:0},partArmorBase:{body:0,arm:0,leg:0,sense:0},statuses:{},ai:'melee',time:g.player.time+10000};
  g.actors.push(e);return e;
}
test('기대 턴당 피해는 실제 명중과 정예 피해를 반영하고 손을 복원한다',()=>{
  const g=arena('longsword'),e=enemy(g,6,5),w=g.makeWeapon('dagger'),old=g.player.hands[0];
  const a=expectedDpt(g,w,e);w.elite=true;assert.ok(expectedDpt(g,w,e)>a);assert.equal(g.player.hands[0],old);
  e.baseEvasion=20;assert.ok(expectedDpt(g,w,e)<a);
});
test('원거리는 붙은 적도 사격한다: 개머리판으로 위임하지 않는다',()=>{
  const g=arena('bow');enemy(g,6,5);smartStep(g);
  assert.ok(g.drainEvents().some(e=>e.type==='shoot'));
});
test('전투 전 60% 미만이면 접근 전에 플라스크',()=>{
  const g=arena();enemy(g,8,5);g.player.hp=Math.floor(g.st(g.player).maxHp*0.59);
  const before=g.flask;smartStep(g);assert.equal(g.flask,before-1);assert.equal(g.player.x,5);
});
for(const id of ['harden','ignite','focus','haste'] as InjectionId[])test(`${id} 상황별 주사제`,()=>{
  const g=arena();enemy(g,8,5);g.player.belt![0]=g.makeInjection(id);
  if(id==='harden'){g.player.hp=Math.floor(g.st(g.player).maxHp*0.45);g.flask=0;}
  if(id==='ignite')enemy(g,8,6);
  if(id==='haste')g.alert=2;
  smartStep(g);assert.ok(g.player.injections![id]);assert.equal(g.player.belt![0],null);
});
test('적 옆 기름통은 2칸 이상 떨어져 사격한다',()=>{
  const g=arena();enemy(g,9,5);const idx=g.level.idx(8,5);g.level.barrels.add(idx);
  smartStep(g);assert.equal(g.level.barrels.has(idx),false);
});
test('폭주는 체력과 AC 조건 미달이면 무기에 넣지 않는다',()=>{
  const g=arena();const r=g.makeByproduct('godsplinter');g.dropItem(5,5,r);smartByproduct(g,r,{});
  assert.ok(!g.player.hands.some(w=>w?.infusion?.options.includes('frenzy')));
});
test('기존의 강한 ★ 부여를 약한 일반 재료로 덮어쓰지 않는다',()=>{
  const g=arena('longsword');g.player.hands[0]!.infusion={from:'시험',options:['cold'],trait:'grudge'};
  const r=g.makeByproduct('claw');g.dropItem(5,5,r);smartByproduct(g,r,{});
  assert.equal(g.player.hands[0]!.infusion!.trait,'grudge');
});
test('고정 부여 모드에서도 슈트 재료는 사용한다',()=>{
  const g=arena();const r=g.makeByproduct('sutured_bulwark');g.dropItem(5,5,r);smartByproduct(g,r,{lockInfusion:true});
  assert.equal(g.player.slots.body[0]?.uid,r.uid);assert.equal(g.player.hands[0]!.infusion,undefined);
});
test('무기 고정은 더 강한 무기 줍기를 막는다',()=>{
  const g=arena('shield'),w=g.makeWeapon('greataxe');g.dropItem(5,5,w);assert.equal(smartTake(g,w,{noPickup:true}),false);
  assert.equal(g.player.hands[0]!.def.id,'shield');
});
test('대각선 모서리에서 실패해도 봇은 판을 중단하지 않는다',()=>{
  const g=arena('longsword');enemy(g,6,6);g.level.tiles[g.level.idx(6,5)]=0;
  assert.equal(smartStep(g),true);
});
test('레벨업은 무기 색과 외피 회로를 섞는다',()=>{
  const g=arena('pistol');g.mode='levelup';g.pendingLevelUps=1;smartStep(g);assert.equal(g.player.colors!.tactics,1);
  g.mode='levelup';g.pendingLevelUps=1;smartStep(g);assert.equal(g.player.colors!.survival,1);
});
test('기름통으로 막힌 통로에서도 탐험을 계속한다',()=>{
  const g=arena('bow'),lv=g.level;lv.tiles.fill(0);g.player.x=2;g.player.y=5;
  for(let x=1;x<=9;x++)lv.tiles[lv.idx(x,5)]=1;
  lv.features=[{kind:'exit',x:9,y:5}];lv.barrels.add(lv.idx(5,5));
  smartStep(g);assert.equal(lv.barrels.has(lv.idx(5,5)),false);
});
test('실험실과 쇼룸을 생성하고 무기·★ 편집을 계속 쓸 수 있다',()=>{
  for(const opts of [{lab:true},{showroom:true}]){
    const g=new Game('시설 검증',opts);g.labSetWeapon(0,'longsword');g.labSetStar(0,'combo3');
    assert.equal(g.player.hands[0]!.def.id,'longsword');assert.equal(g.player.hands[0]!.infusion!.trait,'combo3');
  }
});
test('★ 재료는 두 손 중 짝 무기에 우선 부여한다',()=>{
  const g=arena('dagger');g.player.hands[1]=g.makeWeapon('pistol');
  const r=g.makeByproduct('saint_cleaver');g.dropItem(5,5,r);smartByproduct(g,r,{});
  assert.equal(g.player.hands[1]!.infusion?.trait,'steady');assert.equal(g.player.hands[0]!.infusion,undefined);
});
test('점수가 높은 재료는 기존 부여를 덮어쓴다',()=>{
  const g=arena();g.player.hands[0]!.infusion={from:'시험',options:['fire']};
  const r=g.makeByproduct('frost_hook');g.dropItem(5,5,r);smartByproduct(g,r,{});
  assert.deepEqual(g.player.hands[0]!.infusion!.options,['cold']);
});
test('보이는 적의 반대 원소가 많으면 슈트 약점 비용을 반영한다',()=>{
  const g=arena();
  for(let y=4;y<=6;y++){const e=enemy(g,8,y);e.slots.arm=[g.makeByproduct('furnace_arm')];}
  const r=g.makeByproduct('frost_shell');g.dropItem(5,5,r);smartByproduct(g,r,{lockInfusion:true});
  assert.equal(g.player.slots.body[0],null);assert.ok(g.ash>0);
});
test('적 둘을 만나면 인접 바닥 두 칸인 통로로 물러난다',()=>{
  const g=arena('longsword'),lv=g.level;
  for(let x=1;x<=3;x++)for(let y=1;y<=10;y++)lv.tiles[lv.idx(x,y)]=0;
  for(let x=1;x<=3;x++)lv.tiles[lv.idx(x,5)]=1;
  enemy(g,8,4);enemy(g,8,6);
  smartStep(g);assert.ok(g.player.x<5);
});
test('기대 피해는 철퇴 네 번째 타격과 마지막 탄을 미리 계산하고 상태를 복원한다',()=>{
  const g=arena('mace'),e=enemy(g,6,5),w=g.player.hands[0]!;
  w.infusion={from:'시험',options:[],trait:'fourth'};w.hits=2;
  const plain=expectedDpt(g,w,e);w.hits=3;const critical=expectedDpt(g,w,e);
  assert.ok(critical>plain);assert.equal(w.hits,3);
  const gun=g.makeWeapon('pistol');gun.infusion={from:'시험',options:[],trait:'lastShot'};gun.ammo=2;
  const a=expectedDpt(g,gun,e);gun.ammo=1;assert.ok(expectedDpt(g,gun,e)>a);assert.equal(gun.ammo,1);
});
test('체력과 AC가 충분하면 폭주의 보상을 선택할 수 있다',()=>{
  const g=arena('mace');g.player.slots.body[0]=g.makeByproduct('sutured_bulwark');g.fillArmor(g.player);
  g.player.hp=g.st(g.player).maxHp;const r=g.makeByproduct('godsplinter');g.dropItem(5,5,r);
  smartByproduct(g,r,{});assert.ok(g.player.hands[0]!.infusion?.options.includes('frenzy'));
});
test('좁은 칸에 도착하면 근접 적 둘을 기다리며 자리를 유지한다',()=>{
  const g=arena('longsword'),lv=g.level;lv.tiles.fill(0);
  for(let x=1;x<=9;x++)lv.tiles[lv.idx(x,5)]=1;
  enemy(g,8,5);enemy(g,9,5);smartStep(g);assert.equal(g.player.x,5);assert.equal(g.player.y,5);
});
test('학습된 ★ 점수가 0이어도 짝 무기 가산을 적용한다',()=>{
  const g=arena('dagger');g.player.hands[1]=g.makeWeapon('greataxe');
  const r=g.makeByproduct('storm_tendons');g.dropItem(5,5,r);smartByproduct(g,r,{});
  assert.equal(g.player.hands[1]!.infusion?.trait,'cleave');
});
test('일곱 칸 바깥의 좁은 칸도 후퇴 후보로 찾는다',()=>{
  const g=arena('longsword'),lv=g.level;
  for(let y=1;y<=3;y++)for(let x=1;x<=10;x++)lv.tiles[lv.idx(x,y)]=0;
  lv.tiles[lv.idx(1,3)]=1;lv.tiles[lv.idx(1,2)]=1;lv.tiles[lv.idx(1,1)]=1;
  g.player.x=9;g.player.y=9;enemy(g,10,8);enemy(g,10,9);
  const before=[g.player.x,g.player.y];smartStep(g);assert.notDeepEqual([g.player.x,g.player.y],before);
});

test('보스 입구에서 잠든 적을 보고 후퇴와 재접근을 반복하지 않는다',()=>{
  const r=runSeed({key:'후퇴 회귀',runs:200,bot:'smart'},3);
  assert.ok(r.summary.mode==='won'||r.summary.mode==='dead');assert.ok(r.steps<20000);
});
test('좁은 칸에서 원거리 적에게 접근할 때 재후퇴 왕복을 하지 않는다',()=>{
  const r=runSeed({key:'원거리 교전 회귀',runs:200,bot:'smart'},167);
  assert.ok(r.summary.mode==='won'||r.summary.mode==='dead');
});
test('권총 고정 교전의 후퇴와 재접근도 행동한도 전에 종료된다',()=>{
  const r=runSeed({key:'권총 후퇴 회귀',runs:100,bot:'smart',weapon:'pistol'},85);
  assert.ok(r.summary.mode==='won'||r.summary.mode==='dead');
});
test('같은 적이 시야에서 잠시 사라져도 교전을 기억해 활 고정 왕복을 막는다',()=>{
  const r=runSeed({key:'시야 교전 회귀',runs:100,bot:'smart',weapon:'bow'},46);
  assert.ok(r.summary.mode==='won'||r.summary.mode==='dead');
});
