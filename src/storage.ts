import type {State} from './main';
const key='ccq.local.v1';
let mode:'local'|'server'|'supabase'|null=null;
// Banco on-line (Supabase): URL e chave pública vêm do build (.env.production). Sem elas, o painel usa
// o servidor Python (/api) ou o armazenamento local do navegador.
const env=(import.meta as unknown as {env?:Record<string,string|undefined>}).env||{};
const SB_URL=env.VITE_SUPABASE_URL?.replace(/\/$/,''),SB_KEY=env.VITE_SUPABASE_KEY;
let selecting:Promise<void>|null=null;
const checks=['Superfície do rolo','Ruído anormal','Vibração','Alinhamento da tira','Mancais e refrigeração'];
// Estoques de rolos cerâmicos (retífica e RB1), cada um com uma bandeja de 4 posições.
export const STOCK_PLACES=['retifica','rb1'] as const;
export type StockPlace=typeof STOCK_PLACES[number];
export const STOCK_SLOTS=4;
export const STOCK_CONDITIONS=['Retificado · pronto para uso','Aguardando retífica','Em inspeção'];
const emptySlot=(place:StockPlace,slot:number)=>({place,slot,code:null,perimeter:null,diameter:null,condition:null,entered:null,operator:null,notes:null,version:0});
export const storageMode=()=>mode;
export function day(s:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s))}
export function status(days:number|null){return days===null?'unknown':days<=5?'green':days<=10?'yellow':'red'}
function campaign(rolls:State['rolls'],now:string){for(const r of rolls){r.days=r.installed?Math.max(0,Math.round((Date.parse(day(now))-Date.parse(day(r.installed)))/86400000)):null;r.status=status(r.days)}}
async function sb(path:string,body?:unknown){
 const r=await fetch(SB_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:SB_KEY!,'Content-Type':'application/json',Accept:'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await r.text();let d:unknown=null;try{d=text?JSON.parse(text):null}catch{}
 if(!r.ok)throw new Error((d as {message?:string}|null)?.message||'Não foi possível falar com o banco de dados. Tente atualizar.');
 // Recusas registradas no banco (ex.: senha da retífica) voltam como {ok:false,error}.
 if(d&&typeof d==='object'&&(d as {ok?:boolean}).ok===false)throw new Error((d as {error?:string}).error||'Registro recusado.');
 return d;
}
async function sbState():Promise<State>{
 const [rolls,events,stock,moves]=await Promise.all([sb('/rest/v1/rolls?select=*&order=id'),sb('/rest/v1/events?select=*&order=occurred.desc'),sb('/rest/v1/stock_slots?select=*&order=place,slot'),sb('/rest/v1/stock_log?select=*&order=occurred.desc,recorded.desc')]) as [State['rolls'],State['events'],State['stock'],State['stock_moves']];
 const now=new Date().toISOString();campaign(rolls,now);
 return {rolls,events,stock,stock_moves:moves,inspections:[],tasks:[],audit:[],server_time:now};
}
async function sbChange(path:string,body:Record<string,unknown>){
 if(path==='replacements')return sb('/rest/v1/rpc/register_replacement',{p:body});
 if(path==='stock/in'||path==='stock/out')return sb('/rest/v1/rpc/stock_move',{p:{...body,action:path==='stock/in'?'entrada':'saida'}});
 throw new Error('Função não disponível no banco on-line.');
}
// Registros gravados antes no modo local deste navegador, ainda não enviados ao banco on-line.
const importedKey='ccq.local.imported';
export function localPending(){
 try{
  if(localStorage.getItem(importedKey))return 0;
  const raw=localStorage.getItem(key);if(!raw)return 0;
  const d=JSON.parse(raw);return (d.events?.length||0)+(d.stock_moves?.length||0);
 }catch{return 0}
}
export async function importLocal(){
 const d=JSON.parse(localStorage.getItem(key)||'{}');
 const r=await sb('/rest/v1/rpc/import_local',{p:{events:d.events||[],rolls:d.rolls||[],stock:d.stock||[],stock_moves:d.stock_moves||[]}}) as {events:number;moves:number};
 localStorage.setItem(importedKey,new Date().toISOString());
 return r;
}
export function dismissLocal(){try{localStorage.setItem(importedKey,'dispensado')}catch{}}
function read():State{
 const raw=localStorage.getItem(key);
 const state:State=raw?JSON.parse(raw):{rolls:Array.from({length:5},(_,id)=>({id,name:`Rolo ${id}`,location:id?`Forno · posição ${id}`:'Externo · entrada',serial:null,diameter:null,installed:null,version:0,days:null,status:'unknown'})),events:[],tasks:[],inspections:[],audit:[],server_time:new Date().toISOString()};
 // Dados antigos: sem estoque ganham as bandejas vazias; a primeira versão tinha só a retífica.
 if(!Array.isArray(state.stock))state.stock=[];
 if(!Array.isArray(state.stock_moves))state.stock_moves=[];
 for(const x of state.stock)x.place??='retifica';
 for(const m of state.stock_moves)m.place??='retifica';
 for(const place of STOCK_PLACES)for(let slot=1;slot<=STOCK_SLOTS;slot++)if(!state.stock.some(x=>x.place===place&&x.slot===slot))state.stock.push(emptySlot(place,slot));
 state.stock.sort((a,b)=>a.place.localeCompare(b.place)||a.slot-b.slot);
 if(!Array.isArray(state.rolls)||!Array.isArray(state.events)||!Array.isArray(state.tasks)||!Array.isArray(state.inspections)||!Array.isArray(state.audit))throw new Error('Dados locais inválidos. Preserve o armazenamento e procure suporte.');
 const now=new Date().toISOString();
 campaign(state.rolls,now);
 state.server_time=now;return state;
}
function text(b:Record<string,unknown>,k:string,max=2000){const v=b[k];if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Preencha corretamente: ${k}.`);return v.trim()}
function shiftOf(dt:Date){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(dt));return hour>=23||hour<7?'TN':hour<15?'TM':'TT'}
function measure(b:Record<string,unknown>,k:string,limit:number,label:string,optional=false){
 const v=b[k];if((v===null||v===undefined)&&optional)return null;
 if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>=limit)throw new Error(`${label} inválido.`);return v;
}
function change(path:string,b:Record<string,unknown>){
 const s=read(),operator=text(b,'operator',100),now=new Date().toISOString(),id=crypto.randomUUID();
 if(path==='stock/in'||path==='stock/out'){
  if(!STOCK_PLACES.includes(b.place as StockPlace))throw new Error('Estoque inválido.');
  const place=b.place as StockPlace,slot=s.stock.find(x=>x.place===place&&x.slot===b.slot);if(!slot)throw new Error('Posição da bandeja inválida.');
  if(slot.version!==b.version)throw new Error('A bandeja foi atualizada por outro registro. Atualize a tela.');
  const occurred=text(b,'occurred',50),dt=new Date(occurred);if(!Number.isFinite(dt.getTime())||dt.getTime()>Date.now())throw new Error('Data inválida ou futura.');
  const notes=String(b.notes||'').trim().slice(0,2000),base={id,place,slot:slot.slot,operator,shift:shiftOf(dt),occurred,recorded:now,notes};
  if(path==='stock/in'){
   if(slot.entered)throw new Error('Esta posição da bandeja já está ocupada.');
   const code=String(b.code||'').trim().slice(0,60)||null,perimeter=measure(b,'perimeter',20000,'Perímetro'),diameter=measure(b,'diameter',10000,'Diâmetro',true);
   if(!STOCK_CONDITIONS.includes(String(b.condition)))throw new Error('Selecione a condição do rolo.');
   const condition=String(b.condition);
   Object.assign(slot,{code,perimeter,diameter,condition,entered:occurred,operator,notes,version:slot.version+1});
   s.stock_moves.unshift({...base,action:'entrada',code,perimeter,diameter,condition,destination:null});
  }else{
   if(!slot.entered)throw new Error('Esta posição da bandeja está vazia.');
   if(dt<new Date(slot.entered))throw new Error('A saída deve ser posterior à entrada do rolo.');
   let destination=text(b,'destination',200);
   // Transferência retífica → RB1: o rolo entra na posição livre escolhida, com os mesmos dados.
   if(place==='retifica'&&destination==='Transferido para o estoque RB1'){
    const t=s.stock.find(x=>x.place==='rb1'&&x.slot===b.transfer_slot);if(!t)throw new Error('Escolha a posição livre no estoque RB1.');
    if(t.version!==b.transfer_version)throw new Error('O estoque RB1 foi atualizado por outro registro. Atualize a tela.');
    if(t.entered)throw new Error('A posição escolhida no estoque RB1 já está ocupada.');
    const moved='Transferido da retífica · posição '+slot.slot;
    Object.assign(t,{code:slot.code,perimeter:slot.perimeter,diameter:slot.diameter,condition:slot.condition,entered:occurred,operator,notes:moved,version:t.version+1});
    s.stock_moves.unshift({...base,id:crypto.randomUUID(),place:'rb1',slot:t.slot,action:'entrada',code:slot.code,perimeter:slot.perimeter,diameter:slot.diameter,condition:slot.condition,destination:null,notes:moved});
    destination+=' · posição '+t.slot;
   }
   s.stock_moves.unshift({...base,action:'saida',code:slot.code,perimeter:slot.perimeter,diameter:slot.diameter,condition:slot.condition,destination});
   Object.assign(slot,{...emptySlot(place,slot.slot),version:slot.version+1});
  }
 }else if(path==='tasks/status'){
  const t=s.tasks.find(t=>t.id===b.id);if(!t||t.status!==b.expected)throw new Error('Atividade alterada. Atualize a tela.');
  if(!['pending','progress','done'].includes(String(b.status)))throw new Error('Etapa inválida.');
  s.audit.unshift({id:Date.now(),task_id:t.id,operator,old_status:t.status,new_status:String(b.status),occurred:now});t.status=String(b.status);t.updated=now;t.operator=operator;
 }else{
  const r=s.rolls.find(r=>r.id===b.roll_id);if(!r)throw new Error('Posição inválida.');
  if(path==='tasks')s.tasks.push({id,roll_id:r.id,title:text(b,'title'),status:'pending',created:now,updated:now,operator});
  else{
   const occurred=text(b,'occurred',50),dt=new Date(occurred);if(!Number.isFinite(dt.getTime())||dt.getTime()>Date.now())throw new Error('Data inválida ou futura.');
   const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(dt));const shift=hour>=23||hour<7?'TN':hour<15?'TM':'TT';const notes=String(b.notes||'').slice(0,2000);
   if(path==='replacements'){
    if(r.version!==b.version)throw new Error('Rolo atualizado por outro registro. Atualize a tela.');
    if(r.installed&&dt<=new Date(r.installed))throw new Error('A troca deve ser posterior à última instalação.');
    const reason=text(b,'reason',200),removed_dest=String(b.removed_dest||'').trim().slice(0,200)||null;
    let serial:string,diameter:number|null,perimeter:number|null,source:string;
    const st=b.stock as {place?:string;slot?:number;version?:number}|null|undefined;
    if(st&&typeof st==='object'){
     // Rolo novo sai da bandeja de estoque (somente pronto para uso), na mesma operação.
     const x=s.stock.find(y=>y.place===st.place&&y.slot===st.slot);if(!x)throw new Error('Posição do estoque inválida.');
     if(x.version!==st.version)throw new Error('O estoque foi atualizado por outro registro. Atualize a tela.');
     if(!x.entered)throw new Error('Não há rolo nesta posição do estoque.');
     if(x.condition!==STOCK_CONDITIONS[0])throw new Error('Este rolo do estoque não está pronto para uso.');
     if(dt<new Date(x.entered))throw new Error('A troca deve ser posterior à entrada do rolo no estoque.');
     serial=x.code||'';diameter=x.diameter;perimeter=x.perimeter;source=(x.place==='rb1'?'Estoque RB1':'Estoque da retífica')+' · posição '+x.slot;
     s.stock_moves.unshift({id:crypto.randomUUID(),place:x.place,slot:x.slot,operator,shift,occurred,recorded:now,notes:'Saída automática pela troca do rolo',action:'saida',code:x.code,perimeter:x.perimeter,diameter:x.diameter,condition:x.condition,destination:`Instalado no forno · ${r.name} (${r.location})`});
     Object.assign(x,{...emptySlot(x.place,x.slot),version:x.version+1});
    }else{
     serial=String(b.serial||'').trim().slice(0,100);diameter=measure(b,'diameter',10000,'Diâmetro',true);perimeter=measure(b,'perimeter',20000,'Perímetro',true);source='Fora do estoque';
    }
    s.events.unshift({id,roll_id:r.id,operator,shift,occurred,reason,serial,old_serial:r.serial,diameter,perimeter,source,removed_dest,notes});Object.assign(r,{serial:serial||null,diameter,perimeter,installed:occurred,version:r.version+1});
   }else if(path==='inspections'){
    const answers=b.checks as Record<string,string>;
    if(!answers||Object.keys(answers).length!==checks.length||checks.some(k=>!['ok','issue','na'].includes(answers[k])))throw new Error('Responda todos os itens do checklist.');
    const issues=checks.filter(k=>answers[k]==='issue');if(issues.length&&!notes.trim())throw new Error('Descreva a anomalia identificada.');
    s.inspections.unshift({id,roll_id:r.id,operator,shift,occurred,checks:JSON.stringify(answers),notes});
    if(issues.length)s.tasks.push({id:crypto.randomUUID(),roll_id:r.id,title:'Inspeção: '+issues.join(', ')+' — '+notes,status:'pending',created:now,updated:now,operator});
   }else throw new Error('Operação inválida.');
  }
 }
 try{localStorage.setItem(key,JSON.stringify(s))}catch{throw new Error('Não foi possível salvar neste navegador. Verifique o espaço e as permissões de armazenamento.');}
 return {ok:true};
}
async function selectMode(){
 if(mode)return;
 if(SB_URL&&SB_KEY){mode='supabase';return}
 if(!selecting)selecting=(async()=>{
  const r=await fetch('/api/state',{signal:AbortSignal.timeout(8000)});
  if(r.status===404||r.status===405||((r.ok)&&!r.headers.get('content-type')?.includes('application/json'))){mode='local';return}
  if(!r.ok)throw new Error('Servidor indisponível. Os dados não foram alterados. Tente atualizar.');
  const d=await r.json();if(!Array.isArray(d.rolls))throw new Error('Resposta inválida do servidor.');mode='server';
 })().finally(()=>{selecting=null});
 await selecting;
}
export async function api(path:string,body?:unknown):Promise<any>{
 try{await selectMode()}catch(e){if(e instanceof Error && (e.name==='TimeoutError'||e instanceof TypeError))throw new Error('Sem conexão com o servidor. Tente atualizar.');throw e}
 if(mode==='supabase')return path==='state'?sbState():sbChange(path,body as Record<string,unknown>);
 if(mode==='local'){
  if(path==='state')return read();
  if(!navigator.locks)throw new Error('Use um navegador atualizado para salvar com segurança.');
  return navigator.locks.request('ccq-local-write',()=>change(path,body as Record<string,unknown>));
 }
 const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json','X-CCQ-Request':'1'},body:JSON.stringify(body)}:undefined);
 if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('A API não está disponível. Verifique o servidor; nenhum registro foi salvo.');
 const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha de comunicação');return d;
}
