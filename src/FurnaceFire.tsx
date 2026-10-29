import {useEffect,useRef} from 'react';

/** Decorative combustion illustration, independent of equipment telemetry.
 * Particle flames rise from a row of burners, confined to the heating band below the rolls. */
type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;seed:number;ember:boolean};
const burners=[.06,.19,.31,.44,.56,.69,.81,.94];

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
   sprite([[0,'rgba(255,214,120,1)'],[.5,'rgba(255,180,80,.5)'],[1,'rgba(255,160,60,0)']]),
   sprite([[0,'rgba(255,160,60,1)'],[.5,'rgba(255,130,40,.45)'],[1,'rgba(255,110,30,0)']]),
   sprite([[0,'rgba(244,110,40,1)'],[.5,'rgba(236,90,30,.4)'],[1,'rgba(220,70,20,0)']]),
   sprite([[0,'rgba(220,90,40,.8)'],[.5,'rgba(200,70,30,.3)'],[1,'rgba(180,60,30,0)']]),
  ];
  const ember=sprite([[0,'rgba(255,246,200,1)'],[.3,'rgba(255,170,60,.8)'],[1,'rgba(255,90,20,0)']]);
  let width=1,height=1,frame=0,last=0,visible=true,disposed=false,time=0;
  let particles:Particle[]=[];
  function spawn(){
   const b=burners[Math.floor(Math.random()*burners.length)];
   const isEmber=Math.random()<.012;
   const max=isEmber?1.2+Math.random()*.8:.7+Math.random()*.5;
   particles.push({x:(b+(Math.random()-.5)*.03)*width,y:height-2,vx:(Math.random()-.5)*height*.04,vy:-height*(isEmber?.5+Math.random()*.3:.5+Math.random()*.35),life:0,max,size:height*(isEmber?.03+Math.random()*.02:.26+Math.random()*.16),seed:Math.random()*100,ember:isEmber});
  }
  function step(dt:number){
   time+=dt;
   const rate=width*.28*dt;
   for(let i=0;i<rate;i++)spawn();
   for(const p of particles){
    p.life+=dt;
    const k=p.life/p.max;
    // Lateral turbulence; plumes narrow and accelerate as they rise.
    p.vx+=Math.sin(time*2.2+p.seed)*height*.1*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt*(1+k*.5);
    if(!p.ember)p.size*=1-dt*.55;
   }
   particles=particles.filter(p=>p.life<p.max&&p.y>-20);
   if(particles.length>900)particles.splice(0,particles.length-900);
  }
  function draw(){
   ctx!.clearRect(0,0,width,height);
   // Back wall radiance.
   const wall=ctx!.createLinearGradient(0,height*.55,0,height);
   wall.addColorStop(0,'rgba(255,150,70,0)');wall.addColorStop(1,'rgba(255,140,60,.22)');
   ctx!.fillStyle=wall;ctx!.fillRect(0,height*.55,width,height*.45);
   for(const b of burners){
    const flicker=.85+.15*Math.sin(time*5+b*40);
    const g=ctx!.createRadialGradient(b*width,height,0,b*width,height,height*.22);
    g.addColorStop(0,`rgba(255,150,60,${.25*flicker})`);g.addColorStop(1,'rgba(255,120,40,0)');
    ctx!.fillStyle=g;ctx!.fillRect(b*width-height*.22,height*.78,height*.44,height*.22);
   }
   for(const p of particles){
    const k=p.life/p.max;
    if(p.ember){
     ctx!.globalAlpha=(1-k)*.5;
     const s=p.size*2.4;ctx!.drawImage(ember,p.x-s/2,p.y-s/2,s,s);continue;
    }
    const img=sprites[k<.25?0:k<.5?1:k<.75?2:3];
    ctx!.globalAlpha=Math.max(0,(1-k)*(k<.15?k/.15:1))*.42;
    const s=p.size*(1+k*.5);
    ctx!.drawImage(img,p.x-s/2,p.y-s,s,s*2);
   }
   ctx!.globalAlpha=1;
   // Hot bed at the burner line.
   const bed=ctx!.createLinearGradient(0,height-height*.1,0,height);
   bed.addColorStop(0,'rgba(255,140,40,0)');bed.addColorStop(1,'rgba(255,190,110,.3)');
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
