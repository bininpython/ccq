import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api,storageMode,status,day} from '../src/storage.ts';
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
Object.defineProperty(globalThis.navigator,'locks',{value:{request:async(k,fn)=>fn()}});
globalThis.fetch=async()=>new Response('Not found',{status:404});
test('calendar thresholds and timezone',()=>{assert.equal(day('2026-10-11T01:00:00Z'),'2026-10-10');for(const [n,s] of [[0,'green'],[5,'green'],[6,'yellow'],[10,'yellow'],[11,'red'],[null,'unknown']])assert.equal(status(n),s)});
test('static hosting: direct view, swap, checklist, kanban and persistent history',async()=>{
 let s=await api('state');assert.equal(storageMode(),'local');assert.equal(s.rolls.length,5);
 const occurred=new Date(Date.now()-60000).toISOString();
 await api('replacements',{roll_id:0,operator:'Abner',version:0,occurred,serial:'RF-001',diameter:850,reason:'Preventiva'});
 s=await api('state');assert.equal(s.rolls[0].status,'green');assert.equal(s.events[0].operator,'Abner');assert.equal(s.rolls[0].version,1);
 await assert.rejects(()=>api('replacements',{roll_id:0,operator:'Outro',version:0,occurred,serial:'R2',reason:'Troca'}));
 const checks=Object.fromEntries(['Superfície do rolo','Ruído anormal','Vibração','Alinhamento da tira','Mancais e refrigeração'].map(k=>[k,k==='Vibração'?'issue':'ok']));
 await api('inspections',{roll_id:0,operator:'Maria',occurred,checks,notes:'Vibração anormal'});
 s=await api('state');assert.equal(s.tasks.length,1);assert.equal(s.inspections.length,1);
 await api('tasks/status',{id:s.tasks[0].id,operator:'João',expected:'pending',status:'progress'});
 s=await api('state');assert.equal(s.audit[0].operator,'João');assert.equal(s.tasks[0].status,'progress');
 await assert.rejects(()=>api('tasks',{roll_id:0,title:'Sem nome'}));
 assert.equal(JSON.parse(memory.get('ccq.local.v1')).events.length,1);
});
test('replacement without roll identification',async()=>{
 const s=await api('state');const occurred=new Date(Date.now()-30000).toISOString();
 await api('replacements',{roll_id:1,operator:'Abner',version:s.rolls[1].version,occurred,diameter:640,reason:'Troca preventiva'});
 const after=await api('state');assert.equal(after.events[0].serial,'');assert.equal(after.rolls[1].serial,null);assert.equal(after.rolls[1].diameter,640);
});
