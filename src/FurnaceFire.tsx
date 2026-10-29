import {useEffect,useRef} from 'react';

/** Decorative combustion illustration, independent of equipment telemetry.
 * Each burner draws smooth vector flame tongues (outer, body and core layers) whose height,
 * width and tip sway follow layered sine noise, so the motion is fluid and never pixelated. */
const burners=[.06,.19,.31,.44,.56,.69,.81,.94];

// Smooth pseudo-noise in [-1,1] from a few incommensurate sines.
const noise=(t:number,seed:number)=>Math.sin(t*1.7+seed)*.5+Math.sin(t*3.1+seed*2.3)*.3+Math.sin(t*5.3+seed*.7)*.2;

type Layer={w:number;h:number;stops:[number,string][];blur:number};
const layers:Layer[]=[
 {w:1,h:1,blur:3,stops:[[0,'rgba(255,120,30,.95)'],[.35,'rgba(244,82,24,.75)'],[.75,'rgba(214,48,20,.3)'],[1,'rgba(190,30,15,0)']]},
 {w:.68,h:.78,blur:1.5,stops:[[0,'rgba(255,196,80,1)'],[.45,'rgba(255,150,40,.85)'],[1,'rgba(255,110,30,0)']]},
 {w:.36,h:.46,blur:1,stops:[[0,'rgba(255,252,236,1)'],[.5,'rgba(255,228,150,.9)'],[1,'rgba(255,190,90,0)']]},
];

export function FurnaceFire({animated}:{animated:boolean}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;const ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,frame=0,last=0,visible=true,disposed=false,time=3;
  function tongue(cx:number,base:number,w:number,h:number,sway:number,stops:[number,string][]){
   const tip=base-h;
   const g=ctx!.createLinearGradient(0,base,0,tip);
   for(const [o,c] of stops)g.addColorStop(o,c);
   ctx!.fillStyle=g;
   ctx!.beginPath();
   ctx!.moveTo(cx-w/2,base);
   ctx!.bezierCurveTo(cx-w*.62,base-h*.32,cx-w*.18+sway*.35,base-h*.68,cx+sway,tip);
   ctx!.bezierCurveTo(cx+w*.18+sway*.35,base-h*.68,cx+w*.62,base-h*.32,cx+w/2,base);
   ctx!.quadraticCurveTo(cx,base+w*.18,cx-w/2,base);
   ctx!.fill();
  }
  function draw(){
   ctx!.clearRect(0,0,width,height);
   const base=height-2,unit=Math.min(width/burners.length,height);
   // Warm glow on the hearth under each burner.
   for(const b of burners){
    const x=b*width,g=ctx!.createRadialGradient(x,base,0,x,base,unit*.6);
    g.addColorStop(0,'rgba(255,150,60,.35)');g.addColorStop(1,'rgba(255,120,40,0)');
    ctx!.fillStyle=g;ctx!.fillRect(x-unit*.6,base-unit*.6,unit*1.2,unit*.6+2);
   }
   burners.forEach((b,i)=>{
    const x=b*width,seed=i*1.93;
    // A cluster of tongues per burner: tall center, shorter flanks.
    const tongues=[{dx:-.17,s:.58,seed:seed+11},{dx:.17,s:.55,seed:seed+23},{dx:-.08,s:.8,seed:seed+31},{dx:.09,s:.76,seed:seed+41},{dx:0,s:1,seed}];
    for(const t of tongues){
     const n=noise(time,t.seed),n2=noise(time*1.3,t.seed+5);
     const h=height*.94*t.s*(.82+.18*n),w=unit*.3*(.55+.45*t.s)*(.92+.08*n2),sway=unit*.08*n2;
     for(const l of layers){ctx!.filter=`blur(${l.blur}px)`;tongue(x+t.dx*unit,base,w*l.w,h*l.h,sway*l.h,l.stops)}
    }
   });
   ctx!.filter='none';
  }
  function tick(ts:number){
   frame=0;if(disposed||!animated||reduced.matches||!visible||document.hidden)return;
   if(ts-last>=1000/40){time+=Math.min((ts-last)/1000,.05);last=ts;draw()}
   frame=requestAnimationFrame(tick);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=performance.now();draw();if(animated&&!reduced.matches&&visible&&!document.hidden)frame=requestAnimationFrame(tick)}
  function resize(){
   const box=canvas!.getBoundingClientRect();if(!box.width||!box.height)return;
   width=box.width;height=box.height;
   const dpr=Math.min(window.devicePixelRatio||1,2);
   canvas!.width=Math.round(width*dpr);canvas!.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);
   draw();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()});intersection.observe(canvas);
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  resize();sync();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync)};
 },[animated]);
 return <canvas ref={canvasRef} className="fire-canvas" aria-hidden="true"/>;
}
