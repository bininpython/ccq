import type {State} from './main';
const key='ccq.local.v1';
let mode:'local'|'server'|null=null;
let selecting:Promise<void>|null=null;
const checks=['Superfície do rolo','Ruído anormal','Vibração','Alinhamento da tira','Mancais e refrigeração'];
export const storageMode=()=>mode;
export function day(s:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s))}
export function status(days:number|null){return days===null?'unknown':days<=5?'green':days<=10?'yellow':'red'}
function read():State{
 const raw=localStorage.getItem(key);
 const state:State=raw?JSON.parse(raw):{rolls:Array.from({length:5},(_,id)=>({id,name:`Rolo ${id}`,location:id?`Forno · posição ${id}`:'Externo · entrada',serial:null,diameter:null,installed:null,version:0,days:null,status:'unknown'})),events:[],tasks:[],inspections:[],audit:[],server_time:new Date().toISOString()};
 if(!Array.isArray(state.rolls)||!Array.isArray(state.events)||!Array.isArray(state.tasks)||!Array.isArray(state.inspections)||!Array.isArray(state.audit))throw new Error('Dados locais inválidos. Preserve o armazenamento e procure suporte.');
 const now=new Date().toISOString();
 for(const r of state.rolls){r.days=r.installed?Math.max(0,Math.round((Date.parse(day(now))-Date.parse(day(r.installed)))/86400000)):null;r.status=status(r.days)}
 state.server_time=now;return state;
}
function text(b:Record<string,unknown>,k:string,max=2000){const v=b[k];if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Preencha corretamente: ${k}.`);return v.trim()}
function change(path:string,b:Record<string,unknown>){
 const s=read(),operator=text(b,'operator',100),now=new Date().toISOString(),id=crypto.randomUUID();
 if(path==='tasks/status'){
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
    const serial=text(b,'serial',100),reason=text(b,'reason',200),diameter=b.diameter===null?null:Number(b.diameter);
    if(diameter!==null&&(!Number.isFinite(diameter)||diameter<=0||diameter>=10000))throw new Error('Diâmetro inválido.');
    s.events.unshift({id,roll_id:r.id,operator,shift,occurred,reason,serial,old_serial:r.serial,diameter,notes});Object.assign(r,{serial,diameter,installed:occurred,version:r.version+1});
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
 if(mode==='local'){
  if(path==='state')return read();
  if(!navigator.locks)throw new Error('Use um navegador atualizado para salvar com segurança.');
  return navigator.locks.request('ccq-local-write',()=>change(path,body as Record<string,unknown>));
 }
 const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json','X-CCQ-Request':'1'},body:JSON.stringify(body)}:undefined);
 if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('A API não está disponível. Verifique o servidor; nenhum registro foi salvo.');
 const d=await r.json();if(!r.ok)throw new Error(d.error||'Falha de comunicação');return d;
}
