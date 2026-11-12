import type {FormEvent,KeyboardEvent,ReactNode} from 'react';
import {ArrowDownToLine,ArrowUpFromLine,Check,PackagePlus,Ruler} from 'lucide-react';
import {STOCK_CONDITIONS,type StockPlace} from './storage';
import type {State,StockSlot} from './main';

// Estoques de rolos cerâmicos (retífica e RB1): bandeja vista de cima com 4 posições para rolos de forno (≈ 4 m).
export const PLACES:Record<StockPlace,{name:string;eyebrow:string;destinations:string[]}>={
 retifica:{name:'Estoque da retífica',eyebrow:'ESTOQUE DA RETÍFICA',destinations:['Transferido para o estoque RB1','Enviado para retífica externa','Sucata / descarte','Outro']},
 rb1:{name:'Estoque da RB1',eyebrow:'ESTOQUE RB1',destinations:['Devolvido para a retífica','Sucata / descarte','Outro']},
};
export const COND:Record<string,{short:string;tone:string}>={
 'Retificado · pronto para uso':{short:'Pronto para uso',tone:'green'},
 'Aguardando retífica':{short:'Aguardando retífica',tone:'yellow'},
 'Em inspeção':{short:'Em inspeção',tone:'violet'},
};
const LANE_Y=(i:number)=>84+i*82;
const SADDLES=[250,500,750];

type Fmt={num:(v:number)=>string;fmt:(s:string|null)=>string;days:(s:string)=>number};

export function StockTray({stock,onSelect,num}:{stock:StockSlot[];onSelect:(slot:number)=>void;num:(v:number)=>string}){
 const key=(slot:number)=>(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(slot)}};
 return <div className="tray-scroll"><svg className="tray-svg" viewBox="0 0 1000 440" role="group" aria-label="Bandeja de estoque com 4 posições">
  <defs>
   <linearGradient id="ceramic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9d6cf"/><stop offset=".22" stopColor="#fbfaf7"/><stop offset=".45" stopColor="#ffffff"/><stop offset=".78" stopColor="#ecebe6"/><stop offset="1" stopColor="#c9c5bc"/></linearGradient>
   <linearGradient id="journal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6b7280"/><stop offset=".35" stopColor="#d1d5db"/><stop offset=".6" stopColor="#9ca3af"/><stop offset="1" stopColor="#4b5563"/></linearGradient>
   <linearGradient id="saddle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#52525b"/><stop offset=".5" stopColor="#8b8b93"/><stop offset="1" stopColor="#3f3f46"/></linearGradient>
  </defs>
  {/* Cota do comprimento do rolo */}
  <g className="tray-dim"><line x1="150" y1="30" x2="850" y2="30"/><path d="M150 24v12M850 24v12M160 25l-10 5 10 5M840 25l10 5-10 5"/><rect x="392" y="18" width="216" height="24" rx="12"/><text x="500" y="35">≈ 4.000 mm · rolo cerâmico</text></g>
  <rect className="tray-frame" x="56" y="54" width="888" height="362" rx="16"/>
  <rect className="tray-bed" x="72" y="70" width="856" height="330" rx="10"/>
  {[0,1,2,3].map(i=>{
   const s=stock.find(x=>x.slot===i+1),y=LANE_Y(i),full=!!s?.entered,c=s?.condition?COND[s.condition]:null;
   return <g key={i} className={'tray-lane'+(full?' full':'')} role="button" tabIndex={0} aria-label={full?`Posição ${i+1}: ${s?.code||'rolo sem identificação'}, perímetro ${num(s!.perimeter!)} mm, ${s?.condition}`:`Posição ${i+1} vazia: lançar rolo`} onClick={()=>onSelect(i+1)} onKeyDown={key(i+1)}>
    <rect className="lane-hit" x="80" y={y-6} width="840" height="74" rx="8"/>
    {SADDLES.map(x=><g key={x}><rect x={x-9} y={y+2} width="18" height="58" rx="3" fill="url(#saddle)"/><path className="saddle-v" d={`M${x-9} ${y+16}l9 6 9-6M${x-9} ${y+46}l9-6 9 6`}/></g>)}
    <circle className="slot-badge" cx="106" cy={y+31} r="15"/><text className="slot-num" x="106" y={y+36}>{i+1}</text>
    {full?<>
     <ellipse className="roll-shadow" cx="500" cy={y+60} rx="360" ry="5"/>
     <rect x="126" y={y+19} width="28" height="24" rx="3" fill="url(#journal)"/><rect x="846" y={y+19} width="28" height="24" rx="3" fill="url(#journal)"/>
     <rect x="150" y={y+12} width="6" height="38" rx="2" fill="#9ca3af"/><rect x="844" y={y+12} width="6" height="38" rx="2" fill="#9ca3af"/>
     <rect className="roll-body" x="155" y={y+9} width="690" height="44" rx="10" fill="url(#ceramic)"/>
     <line x1="170" y1={y+19} x2="830" y2={y+19} stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9"/>
     <text className="roll-code" x="182" y={y+37}>{s?.code||'Sem identificação'}</text>
     <text className="roll-perim" x="560" y={y+37}>P {num(s!.perimeter!)} mm{s?.diameter?` · Ø ${num(s.diameter)}`:''}</text>
     {c&&<g className={'cond-chip '+c.tone}><rect x="660" y={y+20} width="170" height="22" rx="11"/><circle cx="676" cy={y+31} r="4"/><text x="686" y={y+35.5}>{c.short}</text></g>}
    </>:<>
     <rect className="slot-empty" x="155" y={y+9} width="690" height="44" rx="10"/>
     <rect className="slot-empty-pill" x="300" y={y+17} width="400" height="28" rx="14"/>
     <text className="slot-empty-text" x="500" y={y+36}>Posição {i+1} vazia · clique para lançar um rolo</text>
    </>}
   </g>})}
 </svg></div>;
}

export function StockPage({place,state,onSelect,onLaunch,f}:{place:StockPlace;state:State|null;onSelect:(slot:number)=>void;onLaunch:()=>void;f:Fmt}){
 const stock=(state?.stock||[]).filter(x=>x.place===place),moves=(state?.stock_moves||[]).filter(x=>x.place===place);
 const full=stock.filter(s=>s.entered),ready=full.filter(s=>s.condition===STOCK_CONDITIONS[0]).length;
 const perims=full.map(s=>s.perimeter||0).filter(Boolean);
 const avg=perims.length?perims.reduce((a,b)=>a+b,0)/perims.length:null;
 return <>
  <section className="kpis"><div className="kpi violet"><span>Na bandeja</span><strong>{String(full.length).padStart(2,'0')}<em>/{String(stock.length||4).padStart(2,'0')}</em></strong><small>{4-full.length} {4-full.length===1?'posição livre':'posições livres'}</small></div>
   <div className="kpi green"><span>Prontos para uso</span><strong>{String(ready).padStart(2,'0')}</strong><small>Retificados e liberados</small></div>
   <div className="kpi yellow"><span>Aguardando</span><strong>{String(full.length-ready).padStart(2,'0')}</strong><small>Retífica ou inspeção</small></div>
   <div className="kpi"><span>Perímetro médio</span><strong className="kpi-text">{avg?f.num(Math.round(avg))+' mm':'—'}</strong><small>Rolos na bandeja</small></div></section>
  <section className="panel"><div className="panel-head"><div><h2>Bandeja de estoque · {place==='rb1'?'RB1':'retífica'}</h2><p>Clique em uma posição para lançar um rolo ou ver os detalhes.</p></div><div className="map-legend">{Object.values(COND).map(c=><span key={c.short} className={c.tone}><i/>{c.short}</span>)}</div></div>
   <StockTray stock={stock} onSelect={onSelect} num={f.num}/>
   <div className="panel-foot"><span><Ruler size={13}/>Rolo cerâmico branco de forno · ≈ 4 m</span><span>4 posições na bandeja</span><button className="ghost" onClick={onLaunch} disabled={full.length>=4}><PackagePlus size={14}/>Lançar rolo</button></div></section>
  <div className="section-title"><div><h2>Movimentações do estoque</h2><p>Entradas e saídas da bandeja, com perímetro, condição e destino.</p></div><span className="count-pill">{moves.length} {moves.length===1?'registro':'registros'}</span></div>
  <section className="panel"><div className="table-wrap"><table><thead><tr>{['Data e turno','Movimento','Rolo','Perímetro · Ø','Condição / destino','Operador'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{moves.map(m=><tr key={m.id}>
   <td>{f.fmt(m.occurred)}<small>Turno {m.shift}</small></td>
   <td><span className={'move-chip '+m.action}>{m.action==='entrada'?<ArrowDownToLine size={13}/>:<ArrowUpFromLine size={13}/>}{m.action==='entrada'?'Entrada':'Saída'}</span><small>Bandeja · posição {m.slot}</small></td>
   <td><strong className="mono">{m.code||'Sem identificação'}</strong></td>
   <td className="mono">{m.perimeter?f.num(m.perimeter)+' mm':'—'}<small>{m.diameter?'Ø '+f.num(m.diameter)+' mm':''}</small></td>
   <td>{m.action==='entrada'?m.condition:m.destination}<small>{m.notes}</small></td>
   <td>{m.operator}</td></tr>)}</tbody></table>
   {!moves.length&&<div className="empty"><PackagePlus size={20}/><strong>Nenhuma movimentação ainda</strong><span>Lance o primeiro rolo {place==='rb1'?'do estoque da RB1':'da retífica'} na bandeja.</span></div>}</div></section>
 </>;
}

type ModalCtx={pinRequired:boolean;place:StockPlace;kind:string;slot:number;state:State|null;operator:string;setOperator:(v:string)=>void;date:string;setDate:(v:string)=>void;max:string;shiftLabel:(d:string)=>string;busy:boolean;error:string;submit:(path:string,payload:unknown)=>void;open:(kind:string,slot:number)=>void;close:()=>void;rolls:{id:number;name:string;location:string}[];f:Fmt};

export function StockModal(c:ModalCtx){
 const stock=(c.state?.stock||[]).filter(x=>x.place===c.place),slot=stock.find(s=>s.slot===c.slot),empty=stock.filter(s=>!s.entered),P=PLACES[c.place];
 const occurred=()=>new Date(c.date+'-03:00').toISOString();
 const head=(eyebrow:string,title:string)=><><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></>;
 const when=<div className="form-row"><label>Data e hora<input type="datetime-local" required value={c.date} max={c.max} onChange={e=>c.setDate(e.target.value)}/></label><label>Turno<input readOnly value={c.shiftLabel(c.date)}/></label></div>;
 const who=<label>Nome do operador<input name="operator" required maxLength={100} value={c.operator} onChange={e=>c.setOperator(e.target.value)} placeholder="Seu nome completo" autoComplete="name"/></label>;
 const footer=(label:ReactNode)=><>{c.error&&<div role="alert" className="error">{c.error}</div>}<div className="modal-actions"><button type="button" className="secondary" disabled={c.busy} onClick={c.close}>Cancelar</button><button className="primary" disabled={c.busy}><Check size={17}/>{c.busy?'Salvando…':label}</button></div></>;
 if(c.kind==='stock-slot'&&slot?.entered){
  const cond=slot.condition?COND[slot.condition]:null;
  return <>{head(P.eyebrow+' · BANDEJA','Posição '+slot.slot)}{cond&&<span className={'badge '+cond.tone}>{cond.short}</span>}
   <dl className="detail-list"><dt>Identificação</dt><dd>{slot.code||'Sem identificação'}</dd><dt>Perímetro</dt><dd>{c.f.num(slot.perimeter!)} mm</dd><dt>Diâmetro</dt><dd>{slot.diameter?c.f.num(slot.diameter)+' mm':'Não informado'}</dd><dt>Entrada</dt><dd>{c.f.fmt(slot.entered)}</dd><dt>Tempo no estoque</dt><dd>{c.f.days(slot.entered)} {c.f.days(slot.entered)===1?'dia':'dias'}</dd><dt>Lançado por</dt><dd>{slot.operator}</dd></dl>
   {slot.notes&&<p className="stock-notes">{slot.notes}</p>}
   <div className="modal-actions"><button className="secondary" onClick={c.close}>Fechar</button><button className="primary" onClick={()=>c.open('stock-out',slot.slot)}><ArrowUpFromLine size={17}/>Retirar da bandeja</button></div></>;
 }
 if(c.kind==='stock-out'&&slot?.entered){
  const send=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));c.submit('stock/out',{place:c.place,operator:c.operator,slot:slot.slot,version:slot.version,destination:f.destination,occurred:occurred(),notes:f.notes})};
  return <form onSubmit={send}>{head(P.eyebrow+' · SAÍDA','Retirar rolo da bandeja')}
   <p className="stock-summary">Posição {slot.slot} · {slot.code||'sem identificação'} · perímetro {c.f.num(slot.perimeter!)} mm</p>
   {who}<label>Destino do rolo<select name="destination" required defaultValue=""><option value="" disabled>Selecione o destino</option>{c.rolls.map(r=><option key={r.id}>{`Instalado no forno · ${r.name} (${r.location})`}</option>)}{P.destinations.map(d=><option key={d}>{d}</option>)}</select></label>
   {when}<label>Observações · opcional<textarea name="notes" maxLength={2000} placeholder="Ex.: instalado na troca do turno, condição da superfície…"/></label>{footer('Registrar saída')}</form>;
 }
 const initial=slot&&!slot.entered?slot.slot:empty[0]?.slot;
 const send=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const target=stock.find(s=>s.slot===Number(f.slot));c.submit('stock/in',{place:c.place,...(f.pin?{pin:String(f.pin)}:{}),operator:c.operator,slot:Number(f.slot),version:target?.version,code:f.code,perimeter:Number(f.perimeter),diameter:f.diameter?Number(f.diameter):null,condition:f.condition,occurred:occurred(),notes:f.notes})};
 if(!empty.length)return <>{head(P.eyebrow,'Bandeja cheia')}<p>As 4 posições estão ocupadas. Retire um rolo antes de lançar outro.</p><div className="modal-actions"><button className="primary" onClick={c.close}>Entendi</button></div></>;
 return <form onSubmit={send}>{head(P.eyebrow+' · ENTRADA','Lançar rolo no estoque')}
  {who}<div className="form-row"><label>Posição na bandeja<select name="slot" defaultValue={initial}>{empty.map(s=><option key={s.slot} value={s.slot}>Posição {s.slot}</option>)}</select></label><label>Identificação · opcional<input name="code" maxLength={60} placeholder="Ex.: RC-012"/></label></div>
  <div className="form-row"><label>Perímetro (mm)<input name="perimeter" type="number" required min="1" max="19999" step="0.1" placeholder="Conforme o rolo"/></label><label>Diâmetro (mm) · opcional<input name="diameter" type="number" min="1" max="9999" step="0.1" placeholder="Ex.: 120"/></label></div>
  <label>Condição<select name="condition" required defaultValue={STOCK_CONDITIONS[0]}>{STOCK_CONDITIONS.map(s=><option key={s}>{s}</option>)}</select></label>
  {when}<label>Observações · opcional<textarea name="notes" maxLength={2000} placeholder="Ex.: retificado, superfície sem trincas…"/></label>
  {c.pinRequired&&c.place==='retifica'&&<label className="pin-field">Senha da retífica<input name="pin" type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="••••" title="Senha de 4 dígitos"/><small>Somente a retífica pode lançar rolos neste estoque.</small></label>}
  {footer('Lançar no estoque')}</form>;
}
