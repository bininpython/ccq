import type {KeyboardEvent} from 'react';
import {FurnaceFire} from './FurnaceFire';

type DiagramRoll={id:number;name:string;days:number|null;diameter:number|null;status:string};

// Fixed drawing coordinates: every element shares one viewBox, so the strip always rests on top of the rolls.
const W=1200,H=470,FLOOR=430,R=36,CY=258,STRIP_H=7,STRIP_Y=CY-R-STRIP_H;
const SHELL={x:292,y:40,w:876,h:FLOOR-40};
const LINING={x:308,y:74,w:844,h:FLOOR-74-16};
const HOT={x:322,y:88,w:816,h:312};
const BURNERS=[.07,.2,.33,.46,.59,.72,.85,.96];
const HOLE=` M${HOT.x} ${HOT.y}v${HOT.h}h${HOT.w}v-${HOT.h}z`;
const RING=`M${LINING.x} ${LINING.y}h${LINING.w}v${LINING.h}h-${LINING.w}z${HOLE}`;
const rollX=(id:number)=>id===0?196:HOT.x+HOT.w*(id-.5)/4;
const pct=(v:number,total:number)=>`${v/total*100}%`;

export function FurnaceDiagram({rolls,animated,onSelect}:{rolls:DiagramRoll[];animated:boolean;onSelect:(id:number)=>void}){
 const key=(id:number)=>(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id)}};
 return <div className="furnace-scroll"><div className={'furnace-diagram'+(animated?'':' motion-paused')}>
  <div className="furnace-stage" style={{aspectRatio:`${W}/${H}`}}>
   <div className="furnace-hot" style={{left:pct(HOT.x,W),top:pct(HOT.y,H),width:pct(HOT.w,W),height:pct(HOT.h,H)}}><FurnaceFire animated={animated}/></div>
   <svg viewBox={`0 0 ${W} ${H}`} className="furnace-svg" role="group" aria-label="Diagrama do forno de recozimento com o rolo externo e as posições 1 a 4">
    <defs>
     <linearGradient id="fd-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="fd-s-top"/><stop offset="1" className="fd-s-bot"/></linearGradient>
     <linearGradient id="fd-steel-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" className="fd-s-bot"/><stop offset=".5" className="fd-s-top"/><stop offset="1" className="fd-s-bot"/></linearGradient>
     <pattern id="fd-brick" width="36" height="18" patternUnits="userSpaceOnUse"><rect width="36" height="18" className="fd-lining"/><path d="M0 .5H36M0 9.5H36M.5 0V9M18.5 9V18" className="fd-joint"/></pattern>
     <radialGradient id="fd-roll" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#ffffff"/><stop offset=".7" stopColor="#e4dfe6"/><stop offset="1" stopColor="#bfb7c2"/></radialGradient>
     <linearGradient id="fd-strip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".5" stopColor="#c9c3cb"/><stop offset="1" stopColor="#9a929d"/></linearGradient>
     <pattern id="fd-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V10" className="fd-hatch-line" strokeWidth="2"/></pattern>
     <filter id="fd-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#2a1a2a" floodOpacity=".18"/></filter>
    </defs>

    {/* Floor */}
    <rect x="0" y={FLOOR} width={W} height={H-FLOOR} fill="url(#fd-hatch)" className="fd-floor"/>
    <line x1="0" x2={W} y1={FLOOR} y2={FLOOR} className="fd-floor-line"/>

    {/* Exhaust stacks */}
    {[430,1030].map(x=><g key={x}><rect x={x-14} y="8" width="28" height="34" rx="2" fill="url(#fd-steel-side)"/><rect x={x-18} y="4" width="36" height="7" rx="2" className="fd-cap"/></g>)}

    {/* Steel casing, refractory lining and hot chamber window */}
    <path fillRule="evenodd" d={`M${SHELL.x+10} ${SHELL.y}h${SHELL.w-20}a10 10 0 0 1 10 10v${SHELL.h-10}h-${SHELL.w}v-${SHELL.h-10}a10 10 0 0 1 10 -10z${HOLE}`} fill="url(#fd-steel)" filter="url(#fd-shadow)"/>
    {/* Lining is a ring around the hot chamber, which stays transparent to show the flames */}
    <path fillRule="evenodd" d={RING} fill="url(#fd-brick)"/>
    <rect x={HOT.x} y={HOT.y} width={HOT.w} height={HOT.h} fill="none" className="fd-hot-edge"/>
    {Array.from({length:22},(_,i)=><circle key={i} cx={SHELL.x+20+i*(SHELL.w-40)/21} cy={SHELL.y+9} r="2" className="fd-rivet"/>)}
    <text x={SHELL.x+SHELL.w/2} y={SHELL.y+26} className="fd-title" textAnchor="middle">FORNO DE RECOZIMENTO · RB1</text>

    {/* Burners along the hearth */}
    {BURNERS.map(b=>{const x=HOT.x+HOT.w*b;return <g key={b}><path d={`M${x-11} ${HOT.y+HOT.h+14}h22l-5 -12h-12z`} className="fd-burner"/><rect x={x-4} y={HOT.y+HOT.h-3} width="8" height="4" rx="1" className="fd-burner-tip"/></g>})}

    {/* Strip entry and exit slots through the walls */}
    <rect x={SHELL.x-2} y={STRIP_Y-6} width={HOT.x-SHELL.x+4} height={STRIP_H+12} className="fd-slot"/>
    <rect x={HOT.x+HOT.w-2} y={STRIP_Y-6} width={SHELL.x+SHELL.w-HOT.x-HOT.w+4} height={STRIP_H+12} className="fd-slot"/>

    {/* Rolls */}
    {rolls.map(r=>{const x=rollX(r.id);return <g key={r.id} className={'roll-node '+r.status} role="button" tabIndex={0} aria-label={`${r.name}: ${r.days===null?'sem data de troca':r.days+' dias em uso'}. Abrir detalhes`} onClick={()=>onSelect(r.id)} onKeyDown={key(r.id)}>
     {r.id===0&&<g className="fd-stand"><path d={`M${x-30} ${FLOOR}l10 -${FLOOR-CY-22}h40l10 ${FLOOR-CY-22}z`} fill="url(#fd-steel-side)"/><rect x={x-26} y={CY-10} width="52" height="34" rx="4" className="fd-chock"/></g>}
     <rect x={x-52} y={CY-R-62} width="104" height="22" rx="11" className="fd-pill"/>
     <text x={x} y={CY-R-47} textAnchor="middle" className="fd-pill-text">{r.id===0?'EXTERNO':'POSIÇÃO '+r.id}</text>
     <circle cx={x} cy={CY} r={R+12} className="fd-focus"/>
     <circle cx={x} cy={CY} r={R+7} className="fd-halo"/>
     <circle cx={x} cy={CY} r={R} fill="url(#fd-roll)"/>
     <circle cx={x} cy={CY} r={R-3} className="fd-ring"/>
     <g className="fd-spin" style={{transformOrigin:`${x}px ${CY}px`}}>
      {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <line key={i} x1={x+Math.cos(a)*18} y1={CY+Math.sin(a)*18} x2={x+Math.cos(a)*(R-5)} y2={CY+Math.sin(a)*(R-5)} className="fd-groove"/>})}
      <circle cx={x} cy={CY-R+12} r="2.6" className="fd-marker"/>
     </g>
     <circle cx={x} cy={CY} r="17" className="fd-hub"/>
     <text x={x} y={CY+6} textAnchor="middle" className="fd-hub-text">{r.id}</text>
    </g>})}

    {/* Strip runs over the top of every roll */}
    <rect x="0" y={STRIP_Y} width={W} height={STRIP_H} fill="url(#fd-strip)"/>
    <line x1="0" x2={W} y1={STRIP_Y+STRIP_H/2} y2={STRIP_Y+STRIP_H/2} className="fd-strip-flow"/>
    <rect x="0" y={STRIP_Y+STRIP_H} width={W} height="1.5" fill="#000" opacity=".12"/>
    <g className="fd-direction"><text x="14" y={STRIP_Y-32}>SENTIDO</text><text x="14" y={STRIP_Y-19}>DA TIRA</text><path d={`M14 ${STRIP_Y-9}h110m-8 -5l8 5l-8 5`}/></g>
   </svg>
  </div>
  <div className="furnace-captions">
   {rolls.map(r=><button key={r.id} className={'roll-caption '+r.status} style={{left:pct(rollX(r.id),W)}} onClick={()=>onSelect(r.id)} tabIndex={-1}>
    <strong>{r.name}</strong>
    <b><i/>{r.days===null?'Sem data de troca':r.days+(r.days===1?' dia':' dias')+' em uso'}</b>
    <em>{r.diameter?'Ø '+r.diameter+' mm':'Diâmetro não informado'}</em>
   </button>)}
  </div>
 </div></div>;
}
