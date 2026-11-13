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
test('estoque da retífica: bandeja com 4 posições, entrada e saída',async()=>{
 let s=await api('state');assert.equal(s.stock.length,8);assert.ok(s.stock.every(x=>x.entered===null));const ret=st=>st.stock.filter(x=>x.place==='retifica');
 const occurred=new Date(Date.now()-60000).toISOString();
 await api('stock/in',{place:'retifica',slot:2,version:0,operator:'Rafael',occurred,code:'RC-07',perimeter:377,diameter:120,condition:'Retificado · pronto para uso'});
 s=await api('state');assert.equal(ret(s)[1].perimeter,377);assert.equal(ret(s)[1].version,1);
 await assert.rejects(()=>api('stock/in',{place:'retifica',slot:2,version:1,operator:'Outro',occurred,perimeter:300,condition:'Em inspeção'}));
 await assert.rejects(()=>api('stock/in',{place:'retifica',slot:3,version:0,operator:'Outro',occurred,perimeter:'300',condition:'Em inspeção'}));
 await api('stock/out',{place:'retifica',slot:2,version:1,operator:'Davi',occurred:new Date().toISOString(),destination:'Instalado no forno · posição 1'});
 s=await api('state');assert.equal(ret(s)[1].entered,null);assert.deepEqual(s.stock_moves.map(m=>m.action),['saida','entrada']);assert.equal(s.stock_moves[0].code,'RC-07');
});
test('estoque RB1 independente e migração da primeira versão',async()=>{
 const occurred=new Date(Date.now()-60000).toISOString();
 await api('stock/in',{place:'rb1',slot:1,version:0,operator:'Davi',occurred,code:'RB-01',perimeter:380,condition:'Retificado · pronto para uso'});
 await assert.rejects(()=>api('stock/in',{place:'almoxarifado',slot:1,version:0,operator:'Davi',occurred,perimeter:380,condition:'Em inspeção'}));
 let s=await api('state');assert.equal(s.stock.find(x=>x.place==='rb1'&&x.slot===1).code,'RB-01');assert.equal(s.stock.find(x=>x.place==='retifica'&&x.slot===1).entered,null);
 // dados gravados pela primeira versão (sem "place") viram estoque da retífica
 const raw=JSON.parse(memory.get('ccq.local.v1'));raw.stock=[{slot:3,code:'OLD',perimeter:370,diameter:null,condition:'Em inspeção',entered:occurred,operator:'Ana',notes:'',version:1}];raw.stock_moves=[{id:'m1',slot:3,action:'entrada',code:'OLD',perimeter:370,operator:'Ana',shift:'TM',occurred,recorded:occurred}];memory.set('ccq.local.v1',JSON.stringify(raw));
 s=await api('state');assert.equal(s.stock.length,8);assert.equal(s.stock.find(x=>x.place==='retifica'&&x.slot===3).code,'OLD');assert.equal(s.stock_moves[0].place,'retifica');
});
test('fluxo completo: retífica → RB1 → forno',async()=>{
 let s=await api('state');const ret=s.stock.find(x=>x.place==='retifica'&&x.slot===4),rb1=s.stock.find(x=>x.place==='rb1'&&x.slot===3);
 const t0=Date.now()-300000,iso=m=>new Date(t0+m*60000).toISOString();
 await api('stock/in',{place:'retifica',slot:4,version:ret.version,operator:'Retífica',occurred:iso(0),code:'RC-77',perimeter:379.5,diameter:121,condition:'Retificado · pronto para uso'});
 await api('stock/out',{place:'retifica',slot:4,version:ret.version+1,operator:'Retífica',occurred:iso(1),destination:'Transferido para o estoque RB1',transfer_slot:3,transfer_version:rb1.version});
 s=await api('state');assert.equal(s.stock.find(x=>x.place==='rb1'&&x.slot===3).code,'RC-77');assert.equal(s.stock.find(x=>x.place==='retifica'&&x.slot===4).entered,null);
 const roll=s.rolls.find(r=>r.id===4);
 await api('replacements',{roll_id:4,operator:'Davi',version:roll.version,occurred:iso(2),reason:'Troca preventiva',removed_dest:'Enviado para a retífica',stock:{place:'rb1',slot:3,version:rb1.version+1}});
 s=await api('state');const r4=s.rolls.find(r=>r.id===4);
 assert.equal(r4.serial,'RC-77');assert.equal(r4.perimeter,379.5);assert.equal(s.stock.find(x=>x.place==='rb1'&&x.slot===3).entered,null);
 assert.equal(s.events[0].source,'Estoque RB1 · posição 3');assert.equal(s.events[0].removed_dest,'Enviado para a retífica');
 assert.match(s.stock_moves[0].destination,/^Instalado no forno · Rolo 4/);
 await assert.rejects(()=>api('replacements',{roll_id:4,operator:'Davi',version:r4.version,occurred:new Date().toISOString(),reason:'x',stock:{place:'rb1',slot:3,version:rb1.version+2}}));
});
