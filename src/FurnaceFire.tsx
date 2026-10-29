import {useEffect,useRef} from 'react';

/** Decorative combustion illustration, independent of equipment telemetry.
 * A low-resolution heat field: each burner feeds heat at the bottom, heat rises with random
 * cooling and lateral drift, and a color ramp turns it into flame (white core → yellow → orange → red). */
const burners=[.06,.19,.31,.44,.56,.69,.81,.94];
const CELL=3;

// Heat (0..255) → RGBA. Transparent when cold so the flames sit on the chamber background.
const ramp=(()=>{
 const stops:[number,number,number,number,number][]=[[0,90,10,0,0],[.12,150,25,5,0],[.28,205,45,10,.45],[.45,240,95,18,.8],[.62,255,145,35,.95],[.8,255,200,90,1],[.93,255,236,170,1],[1,255,250,225,1]];
 const lut=new Uint8ClampedArray(256*4);
 for(let i=0;i<256;i++){
  const v=i/255;let k=0;while(k<stops.length-2&&v>stops[k+1][0])k++;
  const [a,r1,g1,b1,o1]=stops[k],[c,r2,g2,b2,o2]=stops[k+1],t=Math.min(1,Math.max(0,(v-a)/(c-a)));
  lut.set([r1+(r2-r1)*t,g1+(g2-g1)*t,b1+(b2-b1)*t,255*(o1+(o2-o1)*t)],i*4);
 }
 return lut;
})();

export function FurnaceFire({animated}:{animated:boolean}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;const ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const buffer=document.createElement('canvas');const bctx=buffer.getContext('2d')!;
  let width=1,height=1,cols=1,rows=1,heat=new Float32Array(1),image=bctx.createImageData(1,1);
  let frame=0,last=0,visible=true,disposed=false,time=0;
  function seed(){
   // Burner row: a soft profile under each burner, flickering independently.
   const base=(rows-1)*cols;
   for(let x=0;x<cols;x++){
    let v=0;
    for(let i=0;i<burners.length;i++){
     const d=(x/cols-burners[i])/.024;
     v=Math.max(v,Math.exp(-d*d)*(.82+.18*Math.sin(time*7+i*2.3)+Math.random()*.12));
    }
    heat[base+x]=Math.min(1,v);
   }
  }
  function step(){
   time+=1/30;seed();
   // Cooling per row tuned so the tallest tongues stay inside the band.
   // Each cell pulls a blend of the cells below it (shifted by a gentle, symmetric sway) and cools a little.
   const cool=1.45/rows;
   for(let y=0;y<rows-1;y++){
    const below=(y+1)*cols,sway=Math.sin(time*2.3+y*.7)*.18;
    for(let x=0;x<cols;x++){
     const sx=Math.min(cols-2,Math.max(1,Math.round(x-sway+(Math.random()-.5)*1.6)));
     const v=heat[below+sx]*.5+heat[below+sx-1]*.25+heat[below+sx+1]*.25;
     heat[y*cols+x]=Math.max(0,v-Math.random()*cool);
    }
   }
  }
  function draw(){
   const data=image.data;
   for(let i=0;i<heat.length;i++){const o=Math.round(Math.min(1,heat[i])*255)*4;data[i*4]=ramp[o];data[i*4+1]=ramp[o+1];data[i*4+2]=ramp[o+2];data[i*4+3]=ramp[o+3]}
   bctx.putImageData(image,0,0);
   ctx!.clearRect(0,0,width,height);
   ctx!.imageSmoothingEnabled=true;
   // Soft glow pass, then the sharper flame body.
   ctx!.globalAlpha=.55;ctx!.filter='blur(6px)';ctx!.drawImage(buffer,0,0,width,height);
   ctx!.globalAlpha=1;ctx!.filter='blur(1.2px)';ctx!.drawImage(buffer,0,0,width,height);
   ctx!.filter='none';
  }
  function tick(ts:number){
   frame=0;if(disposed||!animated||reduced.matches||!visible||document.hidden)return;
   if(ts-last>=1000/30){step();last=ts;draw()}
   frame=requestAnimationFrame(tick);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=performance.now();draw();if(animated&&!reduced.matches&&visible&&!document.hidden)frame=requestAnimationFrame(tick)}
  function resize(){
   const box=canvas!.getBoundingClientRect();if(!box.width||!box.height)return;
   width=box.width;height=box.height;
   const dpr=Math.min(window.devicePixelRatio||1,1.5);
   canvas!.width=Math.round(width*dpr);canvas!.height=Math.round(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);
   const c=Math.max(40,Math.round(width/CELL)),r=Math.max(16,Math.round(height/CELL));
   if(c!==cols||r!==rows){cols=c;rows=r;buffer.width=cols;buffer.height=rows;heat=new Float32Array(cols*rows);image=bctx.createImageData(cols,rows);for(let i=0;i<rows*2;i++)step()}
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
