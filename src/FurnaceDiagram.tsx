import type {KeyboardEvent} from 'react';
import {FurnaceFire} from './FurnaceFire';

type DiagramRoll={id:number;name:string;serial:string|null;days:number|null;diameter:number|null;status:string};

// Schematic side view. Everything shares one viewBox, so the strip always rests on top of the rolls,
// and the flames live in a separate heating band below them so they never cover a roll.
const W=1200,H=372,FLOOR=348,R=28,CY=176,STRIP_W=3,STRIP_Y=CY-R-STRIP_W;
const FURNACE={x:300,y:40,w:870,h:FLOOR-40};
const HEAT={x:318,y:250,w:834,h:82};
const BURNERS=[.06,.19,.31,.44,.56,.69,.81,.94];
const rollX=(id:number)=>id===0?200:FURNACE.x+FURNACE.w*(id-.5)/4;
const pct=(v:number,total:number)=>`${v/total*100}%`;

export function FurnaceDiagram({rolls,animated,onSelect}:{rolls:DiagramRoll[];animated:boolean;onSelect:(id:number)=>void}){
 const key=(id:number)=>(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id)}};
 return <div className="furnace-scroll"><div className={'furnace-diagram'+(animated?'':' motion-paused')}>
  <div className="furnace-stage" style={{aspectRatio:`${W}/${H}`}}>
   <svg viewBox={`0 0 ${W} ${H}`} className="furnace-svg fd-back" aria-hidden="true">
    <line x1="20" x2={W-20} y1={FLOOR} y2={FLOOR} className="fd-floor"/>
    <rect x={FURNACE.x} y={FURNACE.y} width={FURNACE.w} height={FURNACE.h} rx="14" className="fd-furnace"/>
    <text x={FURNACE.x+22} y={FURNACE.y+30} className="fd-label">FORNO DE RECOZIMENTO</text>
    <text x={FURNACE.x+FURNACE.w-22} y={FURNACE.y+30} textAnchor="end" className="fd-label muted">RB1</text>
    <rect x={HEAT.x} y={HEAT.y} width={HEAT.w} height={HEAT.h} rx="8" className="fd-heat"/>
    <text x={HEAT.x+2} y={HEAT.y-10} className="fd-label muted">ZONA DE AQUECIMENTO</text>
   </svg>
   <div className="furnace-hot" style={{left:pct(HEAT.x,W),top:pct(HEAT.y,H),width:pct(HEAT.w,W),height:pct(HEAT.h,H)}}><FurnaceFire animated={animated}/></div>
   <svg viewBox={`0 0 ${W} ${H}`} className="furnace-svg" role="group" aria-label="Diagrama do forno de recozimento com o rolo externo e as posições 1 a 4">
    {BURNERS.map(b=><rect key={b} x={HEAT.x+HEAT.w*b-8} y={HEAT.y+HEAT.h-1} width="16" height="4" rx="1.5" className="fd-burner"/>)}

    {/* Strip openings in the furnace walls */}
    {[FURNACE.x,FURNACE.x+FURNACE.w].map(x=><rect key={x} x={x-3} y={STRIP_Y-6} width="6" height={STRIP_W+12} className="fd-slot"/>)}

    {rolls.map(r=>{const x=rollX(r.id);return <g key={r.id} className={'roll-node '+r.status} role="button" tabIndex={0} aria-label={`${r.name}: ${r.days===null?'sem data de troca':r.days+' dias em uso'}. Abrir detalhes`} onClick={()=>onSelect(r.id)} onKeyDown={key(r.id)}>
     <text x={x} y={STRIP_Y-18} textAnchor="middle" className="fd-pos">{r.id===0?'EXTERNO':'POS. '+r.id}</text>
     <circle cx={x} cy={CY} r={R+9} className="fd-hit"/>
     <circle cx={x} cy={CY} r={R+6} className="fd-halo"/>
     <circle cx={x} cy={CY} r={R} className="fd-roll"/>
     <circle cx={x} cy={CY} r={R-8} className="fd-inner"/>
     <g className="fd-spin" style={{transformOrigin:`${x}px ${CY}px`}}><line x1={x} x2={x} y1={CY-R+3} y2={CY-R+8} className="fd-tick"/></g>
     <text x={x} y={CY+5} textAnchor="middle" className="fd-num">{r.id}</text>
    </g>})}

    {/* Strip runs tangent to the top of every roll */}
    <line x1="20" x2={W-20} y1={STRIP_Y+STRIP_W/2} y2={STRIP_Y+STRIP_W/2} className="fd-strip"/>
    <line x1="20" x2={W-20} y1={STRIP_Y+STRIP_W/2} y2={STRIP_Y+STRIP_W/2} className="fd-strip-flow"/>
    <g className="fd-direction"><text x="20" y={STRIP_Y-24}>SENTIDO DA TIRA</text><path d={`M20 ${STRIP_Y-11}h96m-5 -4l5 4l-5 4`}/><path d={`M${W-40} ${STRIP_Y-8}l8 ${STRIP_W/2+8}l-8 ${STRIP_W/2+8}`}/></g>
   </svg>
  </div>
  <div className="furnace-captions">
   {rolls.map(r=><button key={r.id} className={'roll-caption '+r.status} style={{left:pct(rollX(r.id),W)}} onClick={()=>onSelect(r.id)} tabIndex={-1}>
    <strong>{r.name}</strong>
    <b><i/>{r.days===null?'Sem registro':r.days+(r.days===1?' dia':' dias')+' em uso'}</b>
    <em>{r.serial||'Sem ID'}<span>·</span>{r.diameter?'Ø '+r.diameter+' mm':'Ø —'}</em>
   </button>)}
  </div>
 </div></div>;
}
