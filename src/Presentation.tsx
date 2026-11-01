import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ArrowRight,BarChart3,Check,ChevronLeft,ChevronRight,Clock3,FileSpreadsheet,Gamepad2,Gauge,History,LayoutDashboard,Maximize2,Minimize2,Printer,ShieldCheck,Target,Wrench,X} from 'lucide-react';
import {flushSync} from 'react-dom';
import {FurnaceDiagram} from './FurnaceDiagram';
import {Logo} from './Logo';
import './presentation.css';

// Apresentação do projeto em slides 16:9. Cada slide é desenhado em 1600×900 e escalado para caber na tela.
const SW=1600,SH=900;
export const GROUP='Grupo CCQ Atitude';
export const TEAM=[
 ['Abner Lucas Almeida Passos','Operador'],['Davi Ferreira Lima','Operador'],['Edgar Almeida Lima','Eletricista'],['Rafael Henrique de Oliveira Linhares','Operador'],
 ['Rodrigo Oliveira Moreira','Eletricista'],['Savio Gouveia Oliveira','Supervisor'],['Tales Jacob de Souza','Operador'],['William Junio de Oliveira Simões','Operador'],
] as const;
const plural={Operador:'Operadores',Supervisor:'Supervisores',Eletricista:'Eletricistas'} as const;
const roleClass={Operador:'op',Supervisor:'sup',Eletricista:'elec'} as const;
const initials=(name:string)=>{const p=name.split(' ');return p[0][0]+p[p.length-1][0]};
const demo=[{id:0,name:'Rolo 0',days:4,diameter:789,status:'green'},{id:1,name:'Rolo 1',days:8,diameter:650,status:'yellow'},{id:2,name:'Rolo 2',days:13,diameter:812,status:'red'},{id:3,name:'Rolo 3',days:2,diameter:805,status:'green'},{id:4,name:'Rolo 4',days:7,diameter:798,status:'yellow'}];
const rollArt=[['EXTERNO','#16a34a'],['POS. 1','#ca8a04'],['POS. 2','#dc2626'],['POS. 3','#16a34a'],['POS. 4','#ca8a04']] as const;

type Actions={onEnter:()=>void;onPlay:()=>void};
type SlideDef={title:string;tone:'dark'|'light';body:(a:Actions&{on?:boolean})=>ReactNode};

// Atraso de entrada escalonado para os elementos de cada slide.
const d=(n:number)=>({'--d':n} as React.CSSProperties);

function Chrome({n,label,dark}:{n:number;label:string;dark?:boolean}){
 return <>
  <div className="s-head"><span className="s-brand"><span className={'s-logo'+(dark?' on-dark':'')}><Logo/></span><b>RB1 ROLL</b><i>/</i><span>{GROUP.toUpperCase()}</span></span><span>SEMINÁRIO CCQ · 2026</span></div>
  <div className="s-foot"><span>{label}</span><span className="s-num">{String(n).padStart(2,'0')}<i>/</i>{String(slides.length).padStart(2,'0')}</span></div>
 </>;
}
const Tag=({n,children}:{n:string;children:ReactNode})=><span className="s-tag rv" style={d(0)}><b>{n}</b>{children}</span>;

// Folha de controle preenchida à mão: cada linha é "escrita" enquanto a mão com a caneta acompanha o traço.
const NOTE:[string,ReactNode][]=[['Data','12/03'],['Hora','02:40'],['Rolo','pos. 2'],['Diâm.','812 mm'],['Perím.',<><s>2.510</s> 2.551 mm</>],['Turno','TN'],['Obs.','desgaste? trocar']];
function PaperNote({on}:{on:boolean}){
 const paper=useRef<HTMLDivElement>(null),hand=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const p=paper.current,h=hand.current;if(!p||!h)return;
  const inks=[...p.querySelectorAll<HTMLElement>('.pn-ink')];
  const rest='translate(380px,470px)';
  const clear=()=>{inks.forEach(l=>l.getAnimations().forEach(a=>a.cancel()));h.getAnimations().forEach(a=>a.cancel())};
  if(!on||matchMedia('(prefers-reduced-motion: reduce)').matches){clear();inks.forEach(l=>l.style.clipPath=on?'none':'');h.style.transform=rest;return}
  let stop=false;
  const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const at=(l:HTMLElement,end:boolean)=>`translate(${l.offsetLeft+(end?l.offsetWidth:0)}px,${l.offsetTop+l.offsetHeight*.78}px)`;
  (async()=>{
   while(!stop){
    clear();inks.forEach(l=>l.style.clipPath='inset(-30% 100% -30% 0)');h.style.transform=rest;
    await wait(500);
    for(const l of inks){
     if(stop)return;
     await h.animate([{transform:getComputedStyle(h).transform},{transform:at(l,false)}],{duration:260,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished;
     const dur=Math.max(380,l.offsetWidth*4.6);
     l.animate([{clipPath:'inset(-30% 100% -30% 0)'},{clipPath:'inset(-30% 0 -30% 0)'}],{duration:dur,fill:'forwards'});
     await h.animate([{transform:at(l,false)},{transform:at(l,true)}],{duration:dur,fill:'forwards'}).finished;
     await wait(140);
    }
    if(stop)return;
    await h.animate([{transform:getComputedStyle(h).transform},{transform:rest}],{duration:600,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished;
    await wait(3200);
   }
  })().catch(()=>{});
  return()=>{stop=true;clear()};
 },[on]);
 return <div className="pn" aria-label="Folha de controle preenchida à mão: data, hora, rolo, diâmetro, perímetro e turno">
  <div className="pn-board"><span className="pn-clip" aria-hidden="true"/>
   <div className="pn-paper" ref={paper}>
    <span className="pn-form">CONTROLE DE TROCA · ROLOS DO FORNO</span>
    <span className="pn-stain" aria-hidden="true"/>
    {NOTE.map(([k,v])=><div className="pn-line" key={k}><span className="pn-ink">{k}: <b>{v}</b></span></div>)}
    <div className="pn-hand" ref={hand} aria-hidden="true"><svg viewBox="-10 -190 330 330" width="330" height="330">
     <ellipse cx="120" cy="40" rx="120" ry="42" fill="#0a0a0a" opacity=".12" transform="rotate(-28 120 40)"/>
     <g className="pn-wiggle">
      <path d="M108 30 L166 -32 L332 120 L274 182 Z" fill="#3f3f46"/>
      <path d="M146 -9 L306 146" stroke="#f1511b" strokeWidth="12"/><path d="M156 -20 L316 135" stroke="#e4e4e7" strokeWidth="4" opacity=".7"/>
      <path d="M108 30 L166 -32" stroke="#27272a" strokeWidth="18" strokeLinecap="round"/>
      <ellipse cx="104" cy="-30" rx="60" ry="46" fill="#d9a07a" transform="rotate(-38 104 -30)"/>
      <ellipse cx="66" cy="2" rx="24" ry="15" fill="#c88a63" transform="rotate(-20 66 2)"/>
      <path d="M70 -6 Q44 -14 36 -38" stroke="#e3ad88" strokeWidth="17" strokeLinecap="round" fill="none"/>
      <line x1="14" y1="-17" x2="150" y2="-178" stroke="#18181b" strokeWidth="11" strokeLinecap="round"/>
      <line x1="122" y1="-145" x2="136" y2="-161" stroke="#f1511b" strokeWidth="12"/>
      <path d="M0 0 L8 -21 L20 -11 Z" fill="#a1a1aa"/><circle cx="1" cy="-1" r="2.4" fill="#1e3a8a"/>
      <path d="M86 -84 Q56 -70 30 -34" stroke="#d9a07a" strokeWidth="19" strokeLinecap="round" fill="none"/>
      <ellipse cx="32" cy="-37" rx="6" ry="4.5" fill="#f2c7a8" transform="rotate(-50 32 -37)"/>
      <path d="M96 -58 Q108 -66 122 -60" stroke="#c88a63" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".55"/>
     </g>
    </svg></div>
   </div>
  </div>
 </div>;
}

export const slides:SlideDef[]=[
 {title:'Capa',tone:'dark',body:()=><>
  <div className="cv-glow" aria-hidden="true"/>
  <div className="s-head"><span className="s-brand"><span className="s-logo on-dark big"><Logo/></span><span className="cv-org"><b>APERAM SOUTH AMERICA</b><small>Linha de Recozimento e Decapagem de Aço Inoxidável I</small></span></span><span className="cv-pill">SEMINÁRIO CCQ · 2026</span></div>
  <div className="cv-main">
   <span className="s-eyebrow rv" style={d(1)}><i/>{GROUP.toUpperCase()}</span>
   <h1 className="cv-title rv" style={d(2)}>RB1 Roll<i>.</i></h1>
   <p className="cv-sub rv" style={d(3)}>Monitoramento e controle dos rolos do forno de recozimento: quantos dias cada rolo está em uso e quando agir.</p>
  </div>
  <svg className="cv-art rv" style={d(4)} viewBox="0 0 1408 120" aria-hidden="true">
   <line x1="0" y1="40" x2="1392" y2="40" stroke="#3f3f46" strokeWidth="3"/><path d="M1380 33l12 7-12 7" fill="none" stroke="#f1511b" strokeWidth="3"/>
   {rollArt.map(([lbl,c],i)=><g key={lbl} transform={`translate(${120+i*290},0)`}><text x="0" y="16" className="cv-art-lbl">{lbl}</text><circle cx="0" cy="74" r="31" fill={c+'22'} stroke={c} strokeWidth="6"/><text x="0" y="83" className="cv-art-num" fill={c}>{i}</text></g>)}
  </svg>
  <div className="s-foot cv-foot"><span>Timóteo · Novembro de 2026</span><span>Kanban visual por cores · tempo desde a troca de cada rolo</span></div>
 </>},

 {title:'Antes: no papel',tone:'light',body:({on})=><>
  <Chrome n={2} label="Antes"/>
  <div className="s-body pp-wrap">
   <div className="pp-copy">
    <Tag n="01">ANTES</Tag>
    <h2 className="s-h rv" style={d(1)}>Antigamente,<br/>tudo no <em>papel</em><i>.</i></h2>
    <p className="s-lead rv" style={d(2)}>A troca do rolo era anotada à mão, na prancheta: data, perímetro, turno. E ficava ali.</p>
    <ul className="pp-pains">
     {([['Anotação manual','Letra ilegível, conta de perímetro feita na mão, campo esquecido.'],
        ['Informação que se perdia','Folhas extraviadas, sem histórico por posição e sem estoque de reservas.'],
        ['Ninguém sabia a campanha','Há quantos dias cada rolo estava no forno? Só procurando no papel.'],
        ['A troca virava emergência','Paradas urgentes, quebra de rolos, abertura de arruelas e travamento.']] as const).map(([t,p],i)=>
      <li key={t} className="rv" style={d(3+i*.6)}><span className="pp-x" aria-hidden="true">×</span><div><b>{t}</b><small>{p}</small></div></li>)}
    </ul>
   </div>
   <div className="rv" style={d(2)}><PaperNote on={!!on}/></div>
  </div>
 </>},

 {title:'Hoje: com dados',tone:'light',body:()=><>
  <Chrome n={3} label="Hoje"/>
  <div className="s-body nw-wrap">
   <div className="nw-copy">
    <Tag n="02">HOJE</Tag>
    <h2 className="s-h rv" style={d(1)}>Hoje, um programa<br/><em className="v">inteligente</em>, com dados<i>.</i></h2>
    <div className="nw-table">
     <div className="nw-row nw-th rv" style={d(2)}><span>Papel</span><span/><span>RB1 Roll</span></div>
     {([['Anotado à mão','Registro digital em segundos'],
        ['Perímetro calculado na mão','π × Ø calculado automaticamente'],
        ['Turno escrito pelo operador','Turno identificado pelo horário'],
        ['Folhas perdidas','Histórico completo, PDF e Excel'],
        ['Campanha desconhecida','Dias de uso por cor, em tempo real']] as const).map(([a,b],i)=>
      <div key={a} className="nw-row rv" style={d(3+i*.5)}><span className="nw-old">{a}</span><ArrowRight size={18}/><span className="nw-new"><Check size={16}/>{b}</span></div>)}
    </div>
   </div>
   <div className="nw-card rv" style={d(3)}>
    <div className="nw-card-head"><span className="nw-eyebrow">REGISTRO DE TROCA</span><span className="nw-saved"><Check size={14}/>Salvo</span></div>
    <b className="nw-card-title">Rolo 2 · Forno, posição 2</b>
    <dl>
     <div><dt>Data e hora</dt><dd>12/03/2026 · 02:40</dd></div>
     <div><dt>Turno</dt><dd>TN · Turno da Noite<span className="nw-auto">automático</span></dd></div>
     <div><dt>Diâmetro</dt><dd>812 mm</dd></div>
     <div><dt>Perímetro (π × Ø)</dt><dd>2.551 mm<span className="nw-auto">calculado</span></dd></div>
     <div><dt>Operador</dt><dd>Davi Ferreira Lima</dd></div>
    </dl>
    <div className="nw-camp green"><span><i/>Em dia</span><b>0 dias</b><div className="nw-track"><i/></div></div>
   </div>
  </div>
 </>},

 {title:'Objetivo',tone:'dark',body:()=><>
  <Chrome n={4} label="Objetivo" dark/>
  <div className="s-body">
   <Tag n="03">OBJETIVO</Tag>
   <p className="ob-statement rv" style={d(1)}>Saber, a qualquer momento, <span>há quantos dias cada rolo está no forno</span> e agir <em>antes da falha</em>.</p>
   <div className="ob-pillars">
    {([[Gauge,'Confiabilidade','Reduzir paradas não programadas e prevenir falhas e desvios de qualidade.'],
       [Target,'Previsibilidade','Planejar inspeção, troca e reposição de reservas com antecedência.'],
       [History,'Rastreabilidade','Histórico de cada troca por posição, turno e operador.']] as const).map(([Icon,t,p],i)=>
     <div key={t} className="ob-pillar rv" style={d(2+i)}><Icon size={28}/><b>{t}</b><p>{p}</p></div>)}
   </div>
  </div>
 </>},

 {title:'Como funciona',tone:'light',body:()=><>
  <Chrome n={5} label="Como funciona"/>
  <div className="s-body">
   <Tag n="04">COMO FUNCIONA</Tag>
   <h2 className="s-h rv" style={d(1)}>Registrou a troca, o forno mostra o resto<i>.</i></h2>
   <ol className="hw-steps">
    {([['Registrar a troca','Operador, data, motivo e diâmetro. Turno e perímetro são calculados.'],
       ['Contar a campanha','Dias de uso de cada posição, atualizados automaticamente.'],
       ['Sinalizar por cor','Kanban visual: verde, amarelo ou vermelho no mapa do forno.'],
       ['Decidir e agir','Inspeção, troca ou reposição de reserva, com KPIs e critérios técnicos.']] as const).map(([t,p],i)=>
     <li key={t} className="rv" style={d(2+i)}><span>{String(i+1).padStart(2,'0')}</span><h3>{t}</h3><p>{p}</p></li>)}
   </ol>
   <div className="hw-scale rv" style={d(6)}>
    {([['green','Em dia','0 a 5 dias',6],['yellow','Atenção','6 a 10 dias',5],['red','Prioridade','11 dias ou mais',4]] as const).map(([k,t,r,w])=>
     <div key={k} className={'hw-seg '+k} style={{flex:w}}><div className="hw-bar"/><b>{t}</b><small>{r}</small></div>)}
   </div>
  </div>
 </>},

 {title:'O sistema',tone:'light',body:()=><>
  <Chrome n={6} label="O sistema"/>
  <div className="s-body sy-wrap">
   <div className="sy-copy">
    <Tag n="05">O SISTEMA</Tag>
    <h2 className="s-h rv" style={d(1)}>Um painel.<br/>O forno inteiro<i>.</i></h2>
    <ul className="sy-list">
     {([[LayoutDashboard,'Mapa do forno','Posições 0 a 4 com a cor da campanha'],
        [Clock3,'Turno automático','TN 23h–07h · TM 07h–15h · TT 15h–23h'],
        [BarChart3,'Histórico e estatísticas','Trocas por motivo, turno e posição'],
        [FileSpreadsheet,'Relatórios PDF e Excel','Exatamente com os filtros aplicados'],
        [ShieldCheck,'Sem login','Abriu, registrou, pronto']] as const).map(([Icon,t,p],i)=>
      <li key={t} className="rv" style={d(2+i)}><span><Icon size={22}/></span><div><b>{t}</b><small>{p}</small></div></li>)}
    </ul>
   </div>
   <div className="sy-shot rv" style={d(3)}>
    <div className="sy-shot-head"><span><b>Mapa do forno</b><small>Dados ilustrativos</small></span><span className="sy-live"><i/>ao vivo no painel</span></div>
    <FurnaceDiagram rolls={demo} animated onSelect={()=>{}}/>
   </div>
  </div>
 </>},

 {title:'Resultado',tone:'dark',body:()=><>
  <div className="cv-glow" aria-hidden="true"/>
  <Chrome n={7} label="Resultado" dark/>
  <div className="s-body rs-wrap">
   <Tag n="06">RESULTADO</Tag>
   <div className="rs-main">
    <div className="rs-num rv" style={d(1)}>≈60<span>%</span></div>
    <p className="rs-txt rv" style={d(2)}><b>menos paradas emergenciais e urgentes</b> relacionadas à troca de rolos de forno.</p>
   </div>
   <div className="rs-facts">
    {([['jan/26','em funcionamento','desde janeiro de 2026'],['5','posições monitoradas','rolos 0 a 4, on-line'],['3','turnos com registro','turno identificado pelo horário']] as const).map(([v,t,s],i)=>
     <div key={t} className="rv" style={d(3+i)}><strong>{v}</strong><b>{t}</b><small>{s}</small></div>)}
   </div>
  </div>
 </>},

 {title:'Equipe',tone:'light',body:()=><>
  <Chrome n={8} label="Equipe"/>
  <div className="s-body">
   <Tag n="07">EQUIPE</Tag>
   <div className="tm-head">
    <h2 className="s-h rv" style={d(1)}>{GROUP}<i>.</i></h2>
    <p className="rv" style={d(2)}>Oito pessoas, um propósito: o rolo certo, na hora certa, com segurança.</p>
   </div>
   <ul className="tm-grid">
    {TEAM.map(([name,role],i)=><li key={name} className={'rv '+roleClass[role]} style={d(3+i*.5)}><span className="tm-av">{initials(name)}</span><div><b>{name}</b><small><i/>{role}</small></div></li>)}
   </ul>
   <div className="tm-roles rv" style={d(8)}>{(['Operador','Supervisor','Eletricista'] as const).map(r=>{const n=TEAM.filter(t=>t[1]===r).length;return <span key={r} className={roleClass[r]}><i/><b>{n}</b>{n>1?plural[r]:r}</span>})}<em>Aperam South America · Linha RB1</em></div>
  </div>
 </>},

 {title:'Encerramento',tone:'dark',body:({onEnter,onPlay})=><>
  <div className="cv-glow" aria-hidden="true"/>
  <Chrome n={9} label="Encerramento" dark/>
  <div className="s-body ed-wrap">
   <span className="s-eyebrow rv" style={d(0)}><i/>{GROUP.toUpperCase()}</span>
   <p className="ed-title rv" style={d(1)}>Cada rolo sob controle.<br/><span>Cada troca com segurança<i>.</i></span></p>
   <p className="ed-sub rv" style={d(2)}>Obrigado.</p>
   <div className="ed-ctas rv" style={d(3)}><button className="ed-btn accent" onClick={onEnter}>Acessar painel<ArrowRight size={22}/></button><button className="ed-btn ghost-dark" onClick={onPlay}><Gamepad2 size={22}/>Jogar a missão do forno</button></div>
   <ul className="ed-safety rv" style={d(4)}><li><Wrench size={18}/>Troca planejada</li><li><ShieldCheck size={18}/>EPI completo</li><li><Gauge size={18}/>Nunca sob carga suspensa</li></ul>
  </div>
 </>},
];

// Escala um palco 1600×900 para caber no contêiner, centralizado.
function Stage({children,className=''}:{children:ReactNode;className?:string}){
 const box=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState(0);
 useLayoutEffect(()=>{
  const el=box.current;if(!el)return;
  const fit=()=>setScale(Math.min(el.clientWidth/SW,el.clientHeight/SH));
  fit();const ro=new ResizeObserver(fit);ro.observe(el);return()=>ro.disconnect();
 },[]);
 return <div ref={box} className={'deck-fit '+className}><div className="deck-stage" style={{width:SW,height:SH,transform:`translate(-50%,-50%) scale(${scale})`,visibility:scale?'visible':'hidden'}}>{children}</div></div>;
}

function Slide({def,on,actions,index,still}:{def:SlideDef;on:boolean;actions:Actions;index:number;still?:boolean}){
 return <section className={'slide '+def.tone+(on?' on':'')} aria-hidden={!on} aria-label={`Slide ${index+1}: ${def.title}`} inert={!on||undefined}>{def.body({...actions,on:on&&!still})}</section>;
}

// Miniatura da capa usada na página inicial.
export function DeckPreview(){
 return <Stage className="deck-preview"><Slide def={slides[0]} on still index={0} actions={{onEnter:()=>{},onPlay:()=>{}}}/></Stage>;
}

export function Presentation({onClose,onEnter,onPlay}:{onClose:()=>void}&Actions){
 const [i,setI]=useState(0);
 const [fs,setFs]=useState(false);
 const [idle,setIdle]=useState(false);
 const [printing,setPrinting]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const touch=useRef<number|null>(null);
 const go=useCallback((n:number)=>setI(Math.max(0,Math.min(slides.length-1,n))),[]);
 const toggleFs=useCallback(()=>{if(document.fullscreenElement)void document.exitFullscreen();else void root.current?.requestFullscreen?.().catch(()=>{})},[]);
 useEffect(()=>{
  const k=(e:KeyboardEvent)=>{
   if(e.altKey||e.ctrlKey||e.metaKey)return;
   if(['ArrowRight','PageDown',' ','Enter'].includes(e.key)&&!(e.key==='Enter'&&(e.target as HTMLElement).closest('button'))){e.preventDefault();setI(v=>Math.min(slides.length-1,v+1))}
   else if(['ArrowLeft','PageUp','Backspace'].includes(e.key)){e.preventDefault();setI(v=>Math.max(0,v-1))}
   else if(e.key==='Home')go(0);else if(e.key==='End')go(slides.length-1);
   else if(e.key==='f'||e.key==='F')toggleFs();
   else if(e.key==='Escape'&&!document.fullscreenElement)onClose();
  };
  const f=()=>setFs(!!document.fullscreenElement);
  // A cópia para impressão (todos os slides) só existe enquanto o diálogo de impressão está aberto.
  const before=()=>flushSync(()=>setPrinting(true)),after=()=>setPrinting(false);
  window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);
  document.body.style.overflow='hidden';root.current?.focus();
  window.addEventListener('keydown',k);document.addEventListener('fullscreenchange',f);
  return()=>{document.body.style.overflow='';window.removeEventListener('keydown',k);document.removeEventListener('fullscreenchange',f);window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{})};
 },[go,onClose,toggleFs]);
 // Em tela cheia, os controles somem após alguns segundos sem movimento do mouse.
 useEffect(()=>{
  if(!fs){setIdle(false);return}
  let t=0;const wake=()=>{setIdle(false);clearTimeout(t);t=window.setTimeout(()=>setIdle(true),2400)};
  wake();window.addEventListener('pointermove',wake);return()=>{clearTimeout(t);window.removeEventListener('pointermove',wake)};
 },[fs]);
 const actions={onEnter,onPlay};
 return <div ref={root} tabIndex={-1} className={'deck'+(fs?' fs':'')+(idle?' idle':'')} role="dialog" aria-modal="true" aria-label={`Apresentação do RB1 Roll · ${GROUP}`}>
  <div className="deck-top">
   <span className="deck-title"><span className="s-logo on-dark"><Logo/></span><b>RB1 Roll</b><small>{GROUP} · {slides[i].title}</small></span>
   <div className="deck-tools">
    <button onClick={()=>window.print()} title="Imprimir ou salvar em PDF"><Printer size={17}/><span>PDF</span></button>
    <button onClick={toggleFs} title="Tela cheia (F)" aria-pressed={fs}>{fs?<Minimize2 size={17}/>:<Maximize2 size={17}/>}<span>{fs?'Sair da tela cheia':'Tela cheia'}</span></button>
    <button onClick={onClose} aria-label="Fechar apresentação" title="Fechar (Esc)"><X size={18}/></button>
   </div>
  </div>
  <div className="deck-main" onPointerDown={e=>{if(e.pointerType!=='mouse')touch.current=e.clientX}} onPointerUp={e=>{if(touch.current===null)return;const dx=e.clientX-touch.current;touch.current=null;if(Math.abs(dx)>50)go(i+(dx<0?1:-1))}}>
   <Stage>{slides.map((s,n)=><Slide key={s.title} def={s} index={n} on={n===i} actions={actions}/>)}</Stage>
  </div>
  <div className="deck-bottom">
   <button className="deck-nav" onClick={()=>go(i-1)} disabled={i===0} aria-label="Slide anterior"><ChevronLeft size={20}/></button>
   <ol className="deck-dots">{slides.map((s,n)=><li key={s.title}><button aria-label={`Ir para o slide ${n+1}: ${s.title}`} aria-current={n===i?'step':undefined} className={n===i?'on':n<i?'past':''} onClick={()=>go(n)}><span>{s.title}</span></button></li>)}</ol>
   <span className="deck-count">{String(i+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</span>
   <button className="deck-nav" onClick={()=>go(i+1)} disabled={i===slides.length-1} aria-label="Próximo slide"><ChevronRight size={20}/></button>
  </div>
  {printing&&<div className="deck-print" aria-hidden="true">{slides.map((s,n)=><div key={s.title} className="deck-print-page"><div className="deck-stage"><Slide def={s} index={n} on still actions={actions}/></div></div>)}</div>}
 </div>;
}
