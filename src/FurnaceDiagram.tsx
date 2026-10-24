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
     <linearGradient id="fd-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7d7480"/><stop offset=".08" stopColor="#5b525e"/><stop offset=".9" stopColor="#3f3843"/><stop offset="1" stopColor="#2c262f"/></linearGradient>
     <linearGradient id="fd-steel-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2c262f"/><stop offset=".5" stopColor="#4c444f"/><stop offset="1" stopColor="#2c262f"/></linearGradient>
     <pattern id="fd-brick" width="32" height="16" patternUnits="userSpaceOnUse"><rect width="32" height="16" fill="#8a4f3c"/><path d="M0 .5H32M0 8.5H32M.5 0V8M16.5 8V16" stroke="#5e3127" strokeWidth="1.2"/><rect x="2" y="2" width="12" height="5" fill="#9b5d46" opacity=".55"/><rect x="18" y="10" width="12" height="5" fill="#9b5d46" opacity=".55"/></pattern>
     <radialGradient id="fd-roll" cx=".38" cy=".32" r=".75"><stop offset="0" stopColor="#f4f1f3"/><stop offset=".45" stopColor="#b7b0b8"/><stop offset=".85" stopColor="#6f6772"/><stop offset="1" stopColor="#4a434d"/></radialGradient>
     <radialGradient id="fd-roll-hot" cx=".38" cy=".32" r=".75"><stop offset="0" stopColor="#fff1dc"/><stop offset=".45" stopColor="#d8a98c"/><stop offset=".85" stopColor="#8a5a4e"/><stop offset="1" stopColor="#4f3533"/></radialGradient>
     <linearGradient id="fd-strip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".45" stopColor="#c9c3cb"/><stop offset=".55" stopColor="#8d8590"/><stop offset="1" stopColor="#d9d3db"/></linearGradient>
     <radialGradient id="fd-vignette" cx=".5" cy=".75" r=".8"><stop offset=".55" stopColor="#120a0e" stopOpacity="0"/><stop offset="1" stopColor="#120a0e" stopOpacity=".75"/></radialGradient>
     <linearGradient id="fd-ceiling" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb070" stopOpacity=".28"/><stop offset="1" stopColor="#ffb070" stopOpacity="0"/></linearGradient>
     <pattern id="fd-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V10" className="fd-hatch-line" strokeWidth="2"/></pattern>
     <filter id="fd-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     <filter id="fd-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity=".45"/></filter>
    </defs>

    {/* Floor */}
    <rect x="0" y={FLOOR} width={W} height={H-FLOOR} fill="url(#fd-hatch)" className="fd-floor"/>
    <line x1="0" x2={W} y1={FLOOR} y2={FLOOR} className="fd-floor-line"/>

    {/* Exhaust stacks */}
    {[430,1030].map(x=><g key={x}><rect x={x-14} y="8" width="28" height="34" rx="2" fill="url(#fd-steel-side)"/><rect x={x-18} y="4" width="36" height="7" rx="2" fill="#6c636f"/></g>)}

    {/* Steel casing, refractory lining and hot chamber window */}
    <path fillRule="evenodd" d={`M${SHELL.x+10} ${SHELL.y}h${SHELL.w-20}a10 10 0 0 1 10 10v${SHELL.h-10}h-${SHELL.w}v-${SHELL.h-10}a10 10 0 0 1 10 -10z${HOLE}`} fill="url(#fd-steel)" filter="url(#fd-shadow)"/>
    {/* Lining is a ring around the hot chamber, which stays transparent to show the flames */}
    <path fillRule="evenodd" d={RING} fill="url(#fd-brick)"/>
    <path fillRule="evenodd" d={RING} fill="#000" opacity=".12"/>
    <rect x={HOT.x} y={HOT.y} width={HOT.w} height={HOT.h} fill="url(#fd-vignette)"/>
    <rect x={HOT.x} y={HOT.y} width={HOT.w} height="70" fill="url(#fd-ceiling)"/>
    <rect x={HOT.x} y={HOT.y} width={HOT.w} height={HOT.h} fill="none" stroke="#2a1716" strokeWidth="2"/>
    {Array.from({length:22},(_,i)=><circle key={i} cx={SHELL.x+20+i*(SHELL.w-40)/21} cy={SHELL.y+9} r="2" fill="#9a929d" opacity=".7"/>)}
    <text x={SHELL.x+SHELL.w/2} y={SHELL.y+26} className="fd-title" textAnchor="middle">FORNO DE RECOZIMENTO · RB1</text>

    {/* Burners along the hearth */}
    {BURNERS.map(b=>{const x=HOT.x+HOT.w*b;return <g key={b}><path d={`M${x-11} ${HOT.y+HOT.h+14}h22l-5 -12h-12z`} fill="#3a3238" stroke="#1d171c"/><rect x={x-4} y={HOT.y+HOT.h-3} width="8" height="4" rx="1" className="fd-burner-tip"/></g>})}

    {/* Strip entry and exit slots through the walls */}
    <rect x={SHELL.x-2} y={STRIP_Y-6} width={HOT.x-SHELL.x+4} height={STRIP_H+12} fill="#160d12"/>
    <rect x={HOT.x+HOT.w-2} y={STRIP_Y-6} width={SHELL.x+SHELL.w-HOT.x-HOT.w+4} height={STRIP_H+12} fill="#160d12"/>

    {/* Rolls */}
    {rolls.map(r=>{const x=rollX(r.id),hot=r.id>0;return <g key={r.id} className={'roll-node '+r.status} role="button" tabIndex={0} aria-label={`${r.name}: ${r.days===null?'sem data de troca':r.days+' dias em uso'}. Abrir detalhes`} onClick={()=>onSelect(r.id)} onKeyDown={key(r.id)}>
     {!hot&&<g className="fd-stand"><path d={`M${x-30} ${FLOOR}l10 -${FLOOR-CY-22}h40l10 ${FLOOR-CY-22}z`} fill="url(#fd-steel-side)"/><rect x={x-26} y={CY-10} width="52" height="34" rx="4" fill="#4a424d" stroke="#2c262f"/></g>}
     <rect x={x-52} y={CY-R-62} width="104" height="22" rx="11" className="fd-pill"/>
     <text x={x} y={CY-R-47} textAnchor="middle" className="fd-pill-text">{r.id===0?'EXTERNO':'POSIÇÃO '+r.id}</text>
     <circle cx={x} cy={CY} r={R+12} className="fd-focus"/>
     <circle cx={x} cy={CY} r={R+4} className="fd-ring" filter="url(#fd-glow)"/>
     <circle cx={x} cy={CY} r={R} fill={hot?'url(#fd-roll-hot)':'url(#fd-roll)'} stroke="#2c252e" strokeWidth="1.5"/>
     <g className="fd-spin" style={{transformOrigin:`${x}px ${CY}px`}}>
      {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <line key={i} x1={x+Math.cos(a)*18} y1={CY+Math.sin(a)*18} x2={x+Math.cos(a)*(R-5)} y2={CY+Math.sin(a)*(R-5)} stroke="#3b343e" strokeOpacity=".35" strokeWidth="1.4"/>})}
      <circle cx={x} cy={CY-R+7} r="3" className="fd-marker"/>
     </g>
     <circle cx={x} cy={CY} r="16" className="fd-hub"/>
     <text x={x} y={CY+6} textAnchor="middle" className="fd-hub-text">{r.id}</text>
    </g>})}

    {/* Strip runs over the top of every roll */}
    <rect x="0" y={STRIP_Y} width={W} height={STRIP_H} fill="url(#fd-strip)"/>
    <line x1="0" x2={W} y1={STRIP_Y+STRIP_H/2} y2={STRIP_Y+STRIP_H/2} className="fd-strip-flow"/>
    <rect x="0" y={STRIP_Y+STRIP_H} width={W} height="2" fill="#000" opacity=".25"/>
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
