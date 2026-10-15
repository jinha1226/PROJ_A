// 81조합의 같은 무기 none 대비 평균 승률 차이로 옵션 표를 갱신한다.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Metrics } from './runner';
const read=(path:string)=>(JSON.parse(readFileSync(path,'utf8')) as {metrics:Metrics[]}).metrics;
const matrix=read(process.argv[2]??'sim/out/r3-step3-matrix.json');
const stars=read(process.argv[3]??'sim/out/r3-step3-stars.json');
if([...matrix,...stars].some(m=>m.errors.length||m.unfinished.length))throw Error('오류·미종료 실험은 학습할 수 없다.');
const baseline=(weapon:string)=>matrix.find(m=>m.spec.weapon===weapon&&m.spec.infuse==='none')!.winRate;
const deltas:Record<string,number>={};
for(const opt of ['fire','cold','lightning','impact','riposte','bleed','ambush','aim']){
  const rows=matrix.filter(m=>m.spec.infuse===opt);
  deltas[opt]=rows.reduce((n,m)=>n+m.winRate-baseline(m.spec.weapon!),0)/rows.length;
}
const traitDeltas=Object.fromEntries(stars.map(m=>[m.spec.star!,m.winRate-baseline(m.spec.weapon!)]));
// 5%p 상승을 1점으로 환산한다. 음수는 0점(이익 없음), 30판 표본의 오차는 기록에 남긴다.
const score=(delta:number)=>Math.max(0,Number((delta*20).toFixed(3)));
let source=readFileSync('sim/optionScore.ts','utf8');
for(const [id,delta]of Object.entries(deltas))source=source.replace(new RegExp(`\\b${id}: -?[\\d.]+`),`${id}: ${score(delta)}`);
const split=source.indexOf('export const TRAIT_SCORE');
let traits=source.slice(split);
for(const [id,delta]of Object.entries(traitDeltas))traits=traits.replace(new RegExp(`\\b${id}: -?[\\d.]+`),`${id}: ${score(delta)}`);
source=source.slice(0,split)+traits;
source=source.replace('// 초기값은 기대 생존·화력의 대략값. 81조합 측정 후 평균 승률 상승분으로 갱신한다.','// 밸런스 3차 81조합·★ 실험: 점수 = max(0, 평균 승률 상승분 × 20). 나머지 옵션은 초기 추정값.');
writeFileSync('sim/optionScore.ts',source);
writeFileSync('sim/out/r3-learned.json',JSON.stringify({deltas,traitDeltas,scores:Object.fromEntries(Object.entries(deltas).map(([id,d])=>[id,score(d)])),traitScores:Object.fromEntries(Object.entries(traitDeltas).map(([id,d])=>[id,score(d)]))},null,2));
console.log({deltas,traitDeltas});
