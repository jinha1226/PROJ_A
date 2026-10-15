import { runSeed, type Spec } from './runner';
process.on('message',(task:{spec:Spec;start:number;count:number;id:number})=>{
  const results=Array.from({length:task.count},(_,i)=>runSeed(task.spec,task.start+i));
  process.send!({id:task.id,key:task.spec.key,results});
});
