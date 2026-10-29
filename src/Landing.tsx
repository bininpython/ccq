import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,BarChart3,ClipboardList,Clock3,FileSpreadsheet,Gamepad2,LayoutDashboard,Play,ShieldCheck,X} from 'lucide-react';
import {FurnaceDiagram} from './FurnaceDiagram';
import {Logo} from './Logo';

// Illustrative rolls for the hero preview only; the real data lives in the panel.
const demo=[{id:0,name:'Rolo 0',days:4,diameter:789,status:'green'},{id:1,name:'Rolo 1',days:8,diameter:650,status:'yellow'},{id:2,name:'Rolo 2',days:13,diameter:812,status:'red'},{id:3,name:'Rolo 3',days:2,diameter:805,status:'green'},{id:4,name:'Rolo 4',days:null,diameter:null,status:'unknown'}];
const features=[
 [LayoutDashboard,'Mapa do forno','As posições 0 a 4 com a cor da campanha de cada rolo: em dia, atenção ou prioridade.'],
 [Clock3,'Turno automático','TN, TM e TT identificados pelo horário do registro. Sem login e sem senha.'],
 [BarChart3,'Estatísticas','Trocas por mês, motivo, turno e posição, e o intervalo médio entre trocas.'],
 [FileSpreadsheet,'Relatórios','PDF e Excel no padrão visual do sistema, exatamente com os filtros aplicados.'],
] as const;
const steps=[['Registre a troca','Operador, data, motivo e diâmetro. O perímetro e o turno são calculados.'],['Acompanhe a campanha','Dias de uso por posição, com limites de 6 e 11 dias para atenção e prioridade.'],['Exporte e analise','Histórico filtrável e relatórios prontos para a reunião de turno.']];

export function Landing({onEnter}:{onEnter:()=>void}){
 const [playing,setPlaying]=useState(false);
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{
  const f=(e:MessageEvent)=>{if(e.origin!==location.origin)return;if(e.data?.type==='rb1:close')setPlaying(false);if(e.data?.type==='rb1:enter'){setPlaying(false);onEnter()}};
  window.addEventListener('message',f);return()=>window.removeEventListener('message',f);
 },[onEnter]);
 useEffect(()=>{
  if(!playing)return;
  const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setPlaying(false)};
  document.body.style.overflow='hidden';window.addEventListener('keydown',k);
  setTimeout(()=>frame.current?.focus(),100);
  return()=>{document.body.style.overflow='';window.removeEventListener('keydown',k)};
 },[playing]);
 return <div className="landing">
  <div className="l-nav" role="navigation" aria-label="Principal">
   <a className="l-brand" href="#" aria-label="RB1 Roll"><span className="logo"><Logo/></span><span><b>RB1 ROLL</b><small>Condição dos rolos · Aperam</small></span></a>
   <div className="l-nav-actions"><button className="l-link" onClick={()=>document.getElementById('jogo')?.scrollIntoView({behavior:'smooth'})}>A missão do forno</button><button className="primary" onClick={onEnter}>Acessar painel<ArrowRight size={16}/></button></div>
  </div>

  <header className="l-hero">
   <div className="l-hero-copy">
    <span className="eyebrow"><i/>APERAM · LINHA RB1 · FORNO DE RECOZIMENTO</span>
    <h1>Cada rolo do forno,<br/>sob controle<i>.</i></h1>
    <p>O RB1 Roll registra as trocas dos rolos do forno de recozimento, mostra há quantos dias cada posição está em uso e transforma o histórico em indicadores e relatórios para o turno.</p>
    <div className="l-ctas"><button className="primary l-big" onClick={onEnter}>Acessar painel<ArrowRight size={18}/></button><button className="secondary l-big" onClick={()=>setPlaying(true)}><Gamepad2 size={18}/>Jogar a missão do forno</button></div>
    <ul className="l-pills"><li><ShieldCheck size={14}/>Sem login</li><li><Clock3 size={14}/>Turno automático</li><li><FileSpreadsheet size={14}/>PDF e Excel</li></ul>
   </div>
   <div className="l-preview" aria-label="Pré-visualização do mapa do forno">
    <div className="l-preview-head"><span><b>Mapa do forno</b><small>Pré-visualização com dados ilustrativos</small></span><span className="l-live"><i/>ao vivo no painel</span></div>
    <FurnaceDiagram rolls={demo} animated onSelect={()=>onEnter()}/>
   </div>
  </header>

  <section className="l-section">
   <div className="l-section-head"><span className="eyebrow"><i/>O QUE O SISTEMA FAZ</span><h2>Tudo o que o turno precisa saber sobre os rolos.</h2></div>
   <div className="l-features">{features.map(([Icon,title,text],i)=><article key={title}><span className="l-num">0{i+1}</span><Icon size={20}/><h3>{title}</h3><p>{text}</p></article>)}</div>
  </section>

  <section className="l-section">
   <div className="l-section-head"><span className="eyebrow"><i/>COMO FUNCIONA</span><h2>Três passos, nenhum cadastro.</h2></div>
   <ol className="l-steps">{steps.map(([t,d],i)=><li key={t}><span>{i+1}</span><div><h3>{t}</h3><p>{d}</p></div></li>)}</ol>
  </section>

  <section className="l-game" id="jogo">
   <div className="l-game-copy">
    <span className="l-pixel-tag">RB1 ROLL APRESENTA</span>
    <h2 className="l-pixel">A MISSÃO<br/>DO FORNO<i>.</i></h2>
    <p>Um jogo de plataforma em pixel art para apresentar o sistema. Escolha Rolando ou Rafaela, com o uniforme Aperam, e cumpra a ronda do turno com segurança:</p>
    <ul className="l-game-list">
     <li><ShieldCheck size={16}/>Vista o EPI completo: sem EPI, sem acesso ao forno</li>
     <li><ClipboardList size={16}/>Inspecione os 5 rolos e anote tudo na prancheta</li>
     <li><ArrowUpRight size={16}/>Troque os rolos operando a ponte rolante por controle remoto</li>
     <li><BarChart3 size={16}/>Nunca fique sob carga suspensa: segurança vem primeiro</li>
    </ul>
    <div className="l-ctas"><button className="accent l-big" onClick={()=>setPlaying(true)}><Play size={18}/>Iniciar jogo</button><a className="l-link light" href="/game/" target="_blank" rel="noopener">Abrir em nova aba<ArrowUpRight size={15}/></a></div>
    <small className="l-keys">Teclado: ← → andar · ↑ pular · E agir · C prancheta · P pausa. Ponte: ← → mover · ↑ ↓ gancho · E engatar · Q sair. No celular, use os botões na tela.</small>
   </div>
   <button className="l-game-poster" onClick={()=>setPlaying(true)} aria-label="Iniciar jogo"><img src="/game/preview.png" alt="Cena do jogo: operação da ponte rolante por controle remoto em frente ao forno de recozimento" loading="lazy"/><span className="l-play"><Play size={26}/></span></button>
  </section>

  <footer className="l-footer"><span>RB1 Roll · Condição dos rolos</span><button className="text-link" onClick={onEnter}>Acessar painel →</button></footer>

  {playing&&<div className="l-modal" role="dialog" aria-modal="true" aria-label="Jogo A Missão do Forno">
   <div className="l-modal-bar"><span><b>A Missão do Forno</b><small>Feche no ✕ para voltar à apresentação</small></span><button className="l-modal-close" onClick={()=>setPlaying(false)} aria-label="Fechar jogo"><X size={18}/></button></div>
   <iframe ref={frame} src="/game/" title="A Missão do Forno" allow="fullscreen; autoplay"/>
  </div>}
 </div>;
}
