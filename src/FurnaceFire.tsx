import {useEffect, useRef} from 'react';

/** Decorative thermal illustration, independent of equipment telemetry. */
export function FurnaceFire({animated}:{animated:boolean}) {
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const phase=useRef(0);
 useEffect(()=>{
  const canvas=canvasRef.current;
  const context=canvas?.getContext('2d');
  if(!canvas||!context)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,frame=0,last=0,visible=true,disposed=false;
  const wave=(x:number,t:number)=>Math.sin(x*1.73+t)*.52+Math.sin(x*3.91-t*1.37)*.3+Math.sin(x*7.17+t*.71)*.18;
  function draw(){
   const ctx=context!;const t=phase.current;
   ctx.clearRect(0,0,width,height);
   const ambient=ctx.createLinearGradient(0,0,0,height);
   ambient.addColorStop(0,'rgba(67,22,17,0)');ambient.addColorStop(.45,'rgba(151,43,15,.10)');ambient.addColorStop(1,'rgba(255,90,13,.5)');
   ctx.fillStyle=ambient;ctx.fillRect(0,0,width,height);
   // Overlapping, independently deforming plumes: ember, orange body, golden core.
   const count=Math.max(14,Math.ceil(width/38));const spacing=width/(count-1);
   for(let layer=0;layer<3;layer++){
    for(let i=-1;i<=count;i++){
     const seed=i*2.399+layer*.9;
     const x=i*spacing+wave(seed,t*.55)*spacing*.17;
     const length=height*(.34+.24*(.5+.5*Math.sin(seed*2.1))+.12*wave(seed,t*1.05))*(1-layer*.22);
     const breadth=spacing*(.66-layer*.13);
     const tip=x+wave(seed+1,t*1.3)*spacing*.8;
     const bend=wave(seed+3,t*.95)*spacing*.7;
     const y=height-length;
     const gradient=ctx.createLinearGradient(0,height,0,y);
     if(layer===0){gradient.addColorStop(0,'rgba(246,62,8,.7)');gradient.addColorStop(.55,'rgba(238,61,8,.45)');gradient.addColorStop(1,'rgba(231,45,9,0)')}
     else if(layer===1){gradient.addColorStop(0,'rgba(255,195,70,.86)');gradient.addColorStop(.42,'rgba(255,125,19,.66)');gradient.addColorStop(1,'rgba(255,78,9,0)')}
     else{gradient.addColorStop(0,'rgba(255,242,179,.9)');gradient.addColorStop(.38,'rgba(255,198,68,.7)');gradient.addColorStop(1,'rgba(255,151,21,0)')}
     ctx.beginPath();ctx.moveTo(x-breadth,height+8);
     ctx.bezierCurveTo(x-breadth*1.05,height-length*.36,tip-bend-breadth*.24,y+length*.24,tip,y);
     ctx.bezierCurveTo(tip+bend*.6,y+length*.32,x+breadth*.85,height-length*.22,x+breadth,height+8);
     ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    }
   }
   const bed=ctx.createLinearGradient(0,height-22,0,height);
   bed.addColorStop(0,'rgba(255,117,25,0)');bed.addColorStop(.8,'rgba(255,169,45,.48)');bed.addColorStop(1,'rgba(255,222,121,.72)');
   ctx.fillStyle=bed;ctx.fillRect(0,height-22,width,22);
  }
  function tick(timestamp:number){
   frame=0;if(disposed||!animated||reduced.matches||!visible||document.hidden)return;
   if(timestamp-last>=1000/30){phase.current+=Math.min((timestamp-last)/1000,.05);last=timestamp;draw()}
   frame=requestAnimationFrame(tick);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=performance.now();draw();if(animated&&!reduced.matches&&visible&&!document.hidden)frame=requestAnimationFrame(tick)}
  function resize(){const box=canvas!.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(window.devicePixelRatio||1,1.5);canvas!.width=Math.round(width*dpr);canvas!.height=Math.round(height*dpr);context!.setTransform(dpr,0,0,dpr,0,0);draw()}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()});intersection.observe(canvas);
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  resize();sync();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync)};
 },[animated]);
 return <div className="furnace-combustion" aria-hidden="true"><div className="furnace-radiance"/><canvas ref={canvasRef} className="fire-canvas"/></div>;
}
