import {useEffect,useRef} from 'react';

/** Decorative combustion illustration, independent of equipment telemetry.
 * Particle flames rise from a row of burners and are drawn with additive blending. */
type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;seed:number;ember:boolean};
const burners=[.07,.2,.33,.46,.59,.72,.85,.96];

function sprite(stops:[number,string][]){
 const c=document.createElement('canvas');c.width=c.height=64;
 const g=c.getContext('2d')!;const r=g.createRadialGradient(32,32,0,32,32,32);
 for(const [o,col] of stops)r.addColorStop(o,col);
 g.fillStyle=r;g.fillRect(0,0,64,64);return c;
}

export function FurnaceFire({animated}:{animated:boolean}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;const ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const sprites=[
   sprite([[0,'rgba(255,255,236,1)'],[.35,'rgba(255,236,160,.75)'],[1,'rgba(255,200,80,0)']]),
   sprite([[0,'rgba(255,214,102,.95)'],[.4,'rgba(255,150,40,.55)'],[1,'rgba(255,110,20,0)']]),
   sprite([[0,'rgba(255,128,30,.85)'],[.45,'rgba(236,70,18,.42)'],[1,'rgba(200,40,10,0)']]),
   sprite([[0,'rgba(190,46,18,.55)'],[.5,'rgba(120,24,14,.25)'],[1,'rgba(60,10,10,0)']]),
  ];
  const ember=sprite([[0,'rgba(255,246,200,1)'],[.3,'rgba(255,170,60,.8)'],[1,'rgba(255,90,20,0)']]);
  let width=1,height=1,frame=0,last=0,visible=true,disposed=false,time=0;
  let particles:Particle[]=[];
  function spawn(){
   const b=burners[Math.floor(Math.random()*burners.length)];
   const isEmber=Math.random()<.035;
   const max=isEmber?1.6+Math.random()*1.4:.75+Math.random()*.7;
   particles.push({x:(b+(Math.random()-.5)*.055)*width,y:height-2,vx:(Math.random()-.5)*height*.08,vy:-height*(isEmber?.32+Math.random()*.3:.4+Math.random()*.38),life:0,max,size:height*(isEmber?.012+Math.random()*.01:.09+Math.random()*.09),seed:Math.random()*100,ember:isEmber});
  }
  function step(dt:number){
   time+=dt;
   const rate=width*.6*dt;
   for(let i=0;i<rate;i++)spawn();
   for(const p of particles){
    p.life+=dt;
    const k=p.life/p.max;
    // Lateral turbulence; plumes narrow and accelerate as they rise.
    p.vx+=Math.sin(time*3.1+p.seed)*height*.25*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt*(1+k*.5);
    if(!p.ember)p.size*=1-dt*.55;
   }
   particles=particles.filter(p=>p.life<p.max&&p.y>-20);
   if(particles.length>900)particles.splice(0,particles.length-900);
  }
  function draw(){
   ctx!.clearRect(0,0,width,height);
   // Back wall radiance.
   const wall=ctx!.createLinearGradient(0,0,0,height);
   wall.addColorStop(0,'rgba(40,14,16,0)');wall.addColorStop(.55,'rgba(150,40,14,.28)');wall.addColorStop(1,'rgba(255,110,30,.55)');
   ctx!.fillStyle=wall;ctx!.fillRect(0,0,width,height);
   ctx!.globalCompositeOperation='lighter';
   for(const b of burners){
    const flicker=.75+.25*Math.sin(time*9+b*40);
    const g=ctx!.createRadialGradient(b*width,height,0,b*width,height,height*.5);
    g.addColorStop(0,`rgba(255,150,50,${.3*flicker})`);g.addColorStop(1,'rgba(255,80,20,0)');
    ctx!.fillStyle=g;ctx!.fillRect(b*width-height*.5,height*.5,height,height*.5);
   }
   for(const p of particles){
    const k=p.life/p.max;
    if(p.ember){
     ctx!.globalAlpha=(1-k)*(.6+.4*Math.sin(time*20+p.seed));
     const s=p.size*2.4;ctx!.drawImage(ember,p.x-s/2,p.y-s/2,s,s);continue;
    }
    const img=sprites[k<.14?0:k<.38?1:k<.7?2:3];
    ctx!.globalAlpha=Math.max(0,(1-k)*(k<.1?k/.1:1))*(k<.14?.3:.42);
    const s=p.size*(1+k*.5);
    ctx!.drawImage(img,p.x-s/2,p.y-s*.9,s,s*1.8);
   }
   ctx!.globalAlpha=1;ctx!.globalCompositeOperation='source-over';
   // Hot bed at the burner line.
   const bed=ctx!.createLinearGradient(0,height-height*.1,0,height);
   bed.addColorStop(0,'rgba(255,140,40,0)');bed.addColorStop(1,'rgba(255,224,150,.55)');
   ctx!.fillStyle=bed;ctx!.fillRect(0,height*.9,width,height*.1);
  }
  function tick(ts:number){
   frame=0;if(disposed||!animated||reduced.matches||!visible||document.hidden)return;
   if(ts-last>=1000/40){step(Math.min((ts-last)/1000,.05));last=ts;draw()}
   frame=requestAnimationFrame(tick);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=performance.now();draw();if(animated&&!reduced.matches&&visible&&!document.hidden)frame=requestAnimationFrame(tick)}
  function warm(){particles=[];for(let i=0;i<60;i++)step(1/30)}
  function resize(){
   const box=canvas!.getBoundingClientRect();if(!box.width||!box.height)return;
   const changed=Math.abs(box.width-width)>1||Math.abs(box.height-height)>1;
   width=box.width;height=box.height;
   const dpr=Math.min(window.devicePixelRatio||1,1.5);
   canvas!.width=Math.round(width*dpr);canvas!.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);
   if(changed)warm();draw();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()});intersection.observe(canvas);
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  resize();sync();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync)};
 },[animated]);
 return <canvas ref={canvasRef} className="fire-canvas" aria-hidden="true"/>;
}
