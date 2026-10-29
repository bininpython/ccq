/* RB1 Roll · A Missão do Forno
 * Jogo de plataforma em pixel art (HTML5 Canvas + Web Audio, sem dependências).
 * O mundo é desenhado em 400×225 e ampliado sem suavização; textos e painéis são desenhados
 * na resolução da tela para ficarem nítidos. Personagem e música são originais. */
(()=>{
'use strict';

// ───────────────────────── Setup ─────────────────────────
const VW=400,VH=225,FLOOR=193,WORLD=1820;
const cvs=document.getElementById('game'),ctx=cvs.getContext('2d');
const buf=document.createElement('canvas');buf.width=VW;buf.height=VH;
const b=buf.getContext('2d');b.imageSmoothingEnabled=false;
let S=1,OX=0,OY=0,DPR=1;
function resize(){
 DPR=Math.min(window.devicePixelRatio||1,2);
 const w=innerWidth,h=innerHeight;
 cvs.width=Math.round(w*DPR);cvs.height=Math.round(h*DPR);
 S=Math.min(w/VW,h/VH);OX=(w-VW*S)/2;OY=(h-VH*S)/2;
}
addEventListener('resize',resize);resize();
const embedded=window.parent!==window;
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

// ───────────────────────── Input ─────────────────────────
const keys={left:0,right:0,jump:0,act:0};
const pressed={};
const take=k=>{const v=pressed[k];pressed[k]=0;return !!v};
const KEYMAP={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyE:'act',Enter:'act',KeyK:'act'};
addEventListener('keydown',e=>{
 AU.init();
 const k=KEYMAP[e.code];
 if(k){if(!keys[k])pressed[k]=1;keys[k]=1;e.preventDefault()}
 if(e.code==='KeyP'||e.code==='Escape')pressed.pause=1;
 if(e.code==='KeyM')toggleMute();
 if(e.code==='KeyC'||e.code==='Tab'){pressed.board=1;e.preventDefault()}
 if(e.code==='KeyR')pressed.restart=1;
});
addEventListener('keyup',e=>{const k=KEYMAP[e.code];if(k)keys[k]=0});
addEventListener('blur',()=>{for(const k in keys)keys[k]=0;if(state==='play')state='pause'});
let buttons=[];
function pointer(e){
 AU.init();
 const r=cvs.getBoundingClientRect();
 const x=(e.clientX-r.left-OX)/S,y=(e.clientY-r.top-OY)/S;
 for(const bt of buttons)if(x>=bt.x&&x<=bt.x+bt.w&&y>=bt.y&&y<=bt.y+bt.h){bt.fn();return}
 if(state==='title')startGame();
 else if(state==='inspect')pressed.act=1;
}
cvs.addEventListener('pointerdown',pointer);
const touch=document.getElementById('touch');
if('ontouchstart' in window||matchMedia('(pointer:coarse)').matches)touch.classList.add('on');
touch.querySelectorAll('button').forEach(bt=>{
 const k=bt.dataset.k;
 bt.addEventListener('pointerdown',e=>{e.preventDefault();AU.init();if(!keys[k])pressed[k]=1;keys[k]=1;bt.classList.add('down');if(state==='title')startGame()});
 const up=()=>{keys[k]=0;bt.classList.remove('down')};
 bt.addEventListener('pointerup',up);bt.addEventListener('pointercancel',up);bt.addEventListener('pointerleave',up);
});

// ───────────────────────── Audio ─────────────────────────
const midi=m=>440*2**((m-69)/12);
const MELODY=[72,0,76,0,79,0,76,0,81,0,79,0,76,0,74,0, 72,0,76,0,79,0,84,0,83,0,79,0,81,0,0,0, 77,0,81,0,84,0,81,0,79,0,76,0,72,0,74,0, 76,0,74,0,72,0,67,0,72,0,0,0,0,0,0,0];
const BASS=[48,48,43,43, 45,45,40,43, 41,41,48,48, 43,43,48,48];
const AU={
 ac:null,master:null,music:null,noise:null,muted:store.get('rb1game.muted',false),step:0,next:0,timer:0,
 init(){
  if(this.ac){if(this.ac.state==='suspended')this.ac.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  this.ac=new AC();this.master=this.ac.createGain();this.master.gain.value=this.muted?0:.55;this.master.connect(this.ac.destination);
  this.music=this.ac.createGain();this.music.gain.value=.2;this.music.connect(this.master);
  const len=this.ac.sampleRate*.5,nb=this.ac.createBuffer(1,len,this.ac.sampleRate),d=nb.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noise=nb;
 },
 tone(f,t,d,type='square',v=.18,dest=this.master,slide=0){
  const o=this.ac.createOscillator(),g=this.ac.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+d);
  o.connect(g);g.connect(dest);o.start(t);o.stop(t+d+.03);
 },
 hiss(t,d,v=.15,freq=3000,dest=this.master){
  const s=this.ac.createBufferSource(),f=this.ac.createBiquadFilter(),g=this.ac.createGain();
  s.buffer=this.noise;f.type='bandpass';f.frequency.value=freq;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);
  s.connect(f);f.connect(g);g.connect(dest);s.start(t);s.stop(t+d);
 },
 sfx(n){
  if(!this.ac)return;const t=this.ac.currentTime;
  const seq=(notes,step,type='square',v=.14)=>notes.forEach((m,i)=>this.tone(midi(m),t+i*step,step*1.6,type,v));
  switch(n){
   case'jump':this.tone(330,t,.14,'square',.12,this.master,700);break;
   case'coin':this.tone(988,t,.06,'square',.12);this.tone(1319,t+.06,.22,'square',.12);break;
   case'power':seq([72,76,79,84,88],.06);break;
   case'hit':this.hiss(t,.3,.25,900);this.tone(220,t,.3,'square',.12,this.master,70);break;
   case'write':for(let i=0;i<4;i++)this.hiss(t+i*.06,.03,.08,6000);break;
   case'select':this.tone(660,t,.06,'square',.08);break;
   case'good':seq([76,79,84],.07);break;
   case'ok':seq([72,76],.08);break;
   case'bad':seq([64,60],.1,'square',.1);break;
   case'crane':this.tone(98,t,.9,'sawtooth',.05,this.master,130);break;
   case'clank':this.hiss(t,.12,.2,1800);this.tone(140,t,.15,'triangle',.25);break;
   case'steam':this.hiss(t,.6,.06,2500);break;
   case'bump':this.tone(180,t,.08,'square',.12,this.master,120);break;
   case'win':seq([72,76,79,84,79,84,88],.1,'square',.13);break;
  }
 },
 startMusic(){if(!this.ac||this.timer)return;this.next=this.ac.currentTime+.06;this.timer=setInterval(()=>this.schedule(),40)},
 stopMusic(){clearInterval(this.timer);this.timer=0},
 schedule(){
  const spb=60/138/4;
  while(this.next<this.ac.currentTime+.15){
   const s=this.step,t=this.next,m=MELODY[s];
   if(m)this.tone(midi(m),t,spb*1.7,'square',.16,this.music);
   if(s%4===0)this.tone(midi(BASS[s>>2]),t,spb*3,'triangle',.5,this.music);
   if(s%4===2)this.tone(midi(BASS[s>>2]+12),t,spb*1.2,'triangle',.35,this.music);
   if(s%2===1)this.hiss(t,.04,.05,8000,this.music);
   this.step=(s+1)%64;this.next+=spb;
  }
 },
};
function toggleMute(){AU.muted=!AU.muted;store.set('rb1game.muted',AU.muted);if(AU.master)AU.master.gain.value=AU.muted?0:.55}

// ───────────────────────── Sprites ─────────────────────────
const PAL={O:'#f1511b',o:'#b33a0f',h:'#ff9466',S:'#f2c39c',s:'#c98d64',G:'#86e1ff',K:'#1b1a22',P:'#5d2c8a',p:'#3e1b60',W:'#e2e2ea',w:'#a7a7b8',Y:'#ffd23f',B:'#3d2b22',b:'#22170f'};
function sprite(rows,pal=PAL){
 const h=rows.length,w=Math.max(...rows.map(r=>r.length));
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
 rows.forEach((r,y)=>[...r].forEach((ch,i)=>{if(ch!=='.'&&pal[ch]){x.fillStyle=pal[ch];x.fillRect(i,y,1,1)}}));
 return c;
}
function flip(c){const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const x=f.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(c,0,0);return f}
function flash(c){const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const x=f.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);return f}
const UP=[
 '....hhOO....',
 '...hOOOOOo..',
 '..oOOOOOOOo.',
 '..oooooooOOO',
 '...SSSSSSS..',
 '...KGGKGGs..',
 '...SSSSSSs..',
 '....SSsss...',
 '..wWPPPPWw..',
 '.SwWPYYPWwS.',
 '.SwPPPPPPwS.',
 '..pPPPPPPp..',
];
const UP_CARRY=UP.map((r,i)=>{const a=[...r];if(i<=1){a[1]='S';a[10]='S'}else if(i<=8){a[1]='w';a[10]='w'}if(i===9||i===10){a[1]='.';a[10]='.'}return a.join('')});
const LEGS={
 idle:['...PPp.PPp..','...PPp.PPp..','...BBb.BBb..','..BBBb.BBBb.'],
 walkA:['..PPp...PPp.','.PPp.....PPp','.BBb.....BBb','BBBb.....BBb'],
 walkB:['....PPPp....','....PPPp....','....BBBb....','...BBBBb....'],
 jump:['..PPp..PPp..','.PPp....PPp.','.BBb....BBb.','............'],
};
const HERO={};
for(const carry of [0,1])for(const [k,legs] of Object.entries(LEGS)){
 const c=sprite([...(carry?UP_CARRY:UP),...legs]);
 HERO[k+carry]={r:c,l:flip(c),fr:flash(c),fl:flash(flip(c))};
}
const CLIP=sprite(['...kKKk...','.bBkKKkBb.','.bWWWWWWb.','.bWLLLLWb.','.bWWWWWWb.','.bWLLLWWb.','.bWWWWWWb.','.bWLLRLWb.','.bWWWWWWb.','.bbbbbbbb.'],{B:'#8a5a2b',b:'#5e3b1a',K:'#c3c8d0',k:'#6b7280',W:'#f4f1e6',L:'#9aa6c8',R:'#e0473b'});
const HELMET=sprite(['...hOOO...','..hOOOOO..','.OOOOOOOO.','.OOOYYOOO.','oooooooooo'],PAL);
const NUT=sprite(['..YYYY..','.YYyyYY.','YYy..yYY','YYy..yYY','.YYyyYY.','..YYYY..'],{Y:'#ffd23f',y:'#c99512'});
const DIG={'0':['###','#.#','#.#','#.#','###'],'1':['.#.','##.','.#.','.#.','###'],'2':['###','..#','###','#..','###'],'3':['###','..#','.##','..#','###'],'4':['#.#','#.#','###','..#','..#'],'?':['###','..#','.##','...','.#.']};
function digit(ch,x,y,color){b.fillStyle=color;DIG[ch].forEach((r,j)=>[...r].forEach((c,i)=>{if(c==='#')b.fillRect(x+i,y+j,1,1)}))}

// Rolls: shaded pixel discs, rendered once per variant; spokes are drawn live so they spin.
const ROLL_PAL={steel:['#2a2632','#57526a','#8f8aa0','#c9c5d6','#f3f1f8'],hot:['#3a130e','#8f2c12','#d9561b','#ff9b3d','#ffe2a2'],fresh:['#1d2a33','#476478','#86a7ba','#c6dde8','#f4fbff']};
function rollSprite(r,v){
 const p=ROLL_PAL[v],s=r*2+1,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');
 for(let j=0;j<s;j++)for(let i=0;i<s;i++){
  const dx=i-r,dy=j-r,d=Math.hypot(dx,dy);if(d>r+.4)continue;
  let col;
  if(d>r-1.1)col=p[0];
  else if(d<2.2)col=p[0];
  else if(d<3.4)col=p[2];
  else{const k=(-dx-dy)/(2*r)+.5+(d>r-3?-.18:0);col=k>.86?p[4]:k>.62?p[3]:k>.36?p[2]:p[1]}
  x.fillStyle=col;x.fillRect(i,j,1,1);
 }
 return c;
}
const R=13,ROLLS={steel:rollSprite(R,'steel'),hot:rollSprite(R,'hot'),fresh:rollSprite(R,'fresh')};
const BIGR=26,BIG={steel:rollSprite(BIGR,'steel'),hot:rollSprite(BIGR,'hot'),fresh:rollSprite(BIGR,'fresh')};
function drawRoll(g,cx,cy,variant,ang,img=ROLLS[variant],r=R){
 g.drawImage(img,Math.round(cx-r),Math.round(cy-r));
 g.fillStyle=ROLL_PAL[variant][0];
 for(let k=0;k<4;k++){const a=ang+k*Math.PI/2;for(let t=4;t<r-2;t++)g.fillRect(Math.round(cx+Math.cos(a)*t),Math.round(cy+Math.sin(a)*t),1,1)}
}

// ───────────────────────── World layout ─────────────────────────
const ROLL_X=[430,760,980,1200,1420],ROLL_Y=118,STRIP_Y=ROLL_Y-R-2;
const FURN={x:600,y:56,w:1120,h:FLOOR-56},WIN={x:616,y:82,w:1088,h:104};
const PILLARS=[870,1090,1310,1530];
const RACK={x:500,w:88},TABLE={x:92,w:58,y:168},TERM={x:1752,w:48};
const PLATFORMS=[{x:150,y:160,w:52},{x:296,y:160,w:52},{x:842,y:160,w:56},{x:1062,y:160,w:56},{x:1282,y:160,w:56},{x:1502,y:160,w:56}];
const BLOCKS_AT=[[168,112],[314,112],[862,112],[1082,112],[1302,112],[1522,112]];
const VENTS=[870,1090,1310,1530];
const CHIMNEYS=[700,1000,1300,1600];
const COINS_AT=[[160,148],[176,148],[192,148],[306,148],[322,148],[338,148],[250,176],[262,176],[640,176],[652,176],[664,176],[852,148],[870,148],[888,148],[1072,148],[1090,148],[1108,148],[1292,148],[1310,148],[1328,148],[1512,148],[1530,148],[1548,148],[1640,176],[1652,176],[1664,176]];

// Static layers, drawn once.
const FAR_W=Math.ceil(VW+(WORLD-VW)*.45);
const far=document.createElement('canvas');far.width=FAR_W;far.height=VH;
const mid=document.createElement('canvas');mid.width=WORLD;mid.height=VH;
function rect(g,c,x,y,w,h){g.fillStyle=c;g.fillRect(x,y,w,h)}
(function paintFar(){
 const g=far.getContext('2d');
 const grad=g.createLinearGradient(0,0,0,VH);grad.addColorStop(0,'#0d0b14');grad.addColorStop(.55,'#17131f');grad.addColorStop(1,'#1d1827');
 g.fillStyle=grad;g.fillRect(0,0,FAR_W,VH);
 for(let x=10;x<FAR_W;x+=118){
  rect(g,'#221d2d',x,18,62,80);rect(g,'#152238',x+3,21,56,74);
  for(let i=0;i<4;i++)for(let j=0;j<3;j++){rect(g,'#1a2a46',x+5+i*14,23+j*24,12,22);rect(g,'#24395e',x+6+i*14,24+j*24,2,20)}
  rect(g,'#2d2639',x+64,0,10,VH);rect(g,'#3a3247',x+64,0,2,VH);rect(g,'#1b1724',x+72,0,2,VH);
 }
 rect(g,'#3a3248',0,104,FAR_W,6);rect(g,'#4b4160',0,104,FAR_W,1);
 rect(g,'#5a2632',0,116,FAR_W,3);
 for(let x=24;x<FAR_W;x+=64){rect(g,'#4b4160',x,102,4,10);rect(g,'#7a3341',x+30,114,3,7)}
 for(let x=0;x<FAR_W;x+=32){rect(g,'#141119',x,124,1,70)}
 for(let x=60;x<FAR_W;x+=210){g.fillStyle='#e6b422';g.beginPath();g.moveTo(x,148);g.lineTo(x+7,136);g.lineTo(x+14,148);g.fill();rect(g,'#1b1724',x+6,140,2,4);rect(g,'#1b1724',x+6,145,2,1)}
})();
(function paintMid(){
 const g=mid.getContext('2d');
 // Crane rail.
 rect(g,'#2f2a3a',0,10,WORLD,5);rect(g,'#4a4258',0,10,WORLD,1);
 for(let x=40;x<WORLD;x+=220){rect(g,'#2a2534',x,0,6,12)}
 // Workshop: pegboard with tools, table.
 rect(g,'#2c2636',66,118,98,44);rect(g,'#3a3246',68,120,94,40);
 for(let x=72;x<160;x+=6)for(let y=124;y<158;y+=6)rect(g,'#2c2636',x,y,1,1);
 rect(g,'#9aa0aa',78,126,3,18);rect(g,'#9aa0aa',75,126,9,3);
 rect(g,'#c33',92,128,10,4);rect(g,'#9aa0aa',96,132,2,12);
 rect(g,'#9aa0aa',112,124,2,22);rect(g,'#9aa0aa',108,144,10,3);
 rect(g,'#e6b422',128,128,14,10);rect(g,'#2c2636',131,131,8,4);
 rect(g,'#9aa0aa',148,126,8,2);rect(g,'#9aa0aa',151,126,2,16);
 rect(g,'#6b4a2e',TABLE.x,TABLE.y,TABLE.w,4);rect(g,'#8a6440',TABLE.x,TABLE.y,TABLE.w,1);
 rect(g,'#4a3220',TABLE.x+3,TABLE.y+4,3,FLOOR-TABLE.y-4);rect(g,'#4a3220',TABLE.x+TABLE.w-6,TABLE.y+4,3,FLOOR-TABLE.y-4);
 // Roll rack (stock).
 for(const x of [RACK.x,RACK.x+RACK.w-4]){rect(g,'#57526a',x,122,4,FLOOR-122);rect(g,'#7a7590',x,122,1,FLOOR-122)}
 for(const y of [148,184]){rect(g,'#57526a',RACK.x,y,RACK.w,3);rect(g,'#7a7590',RACK.x,y,RACK.w,1)}
 rect(g,'#e6b422',RACK.x+4,122,RACK.w-8,3);for(let x=RACK.x+4;x<RACK.x+RACK.w-4;x+=8)rect(g,'#1b1724',x,122,4,3);
 // External roll stand.
 const sx=ROLL_X[0];rect(g,'#3b3546',sx-6,ROLL_Y+4,12,FLOOR-ROLL_Y-4);rect(g,'#4f4860',sx-6,ROLL_Y+4,2,FLOOR-ROLL_Y-4);
 rect(g,'#2a2534',sx-11,FLOOR-6,22,6);rect(g,'#4a4258',sx-14,ROLL_Y-5,28,10);rect(g,'#5f5674',sx-14,ROLL_Y-5,28,1);
 // Furnace casing.
 for(const x of CHIMNEYS){rect(g,'#2f2a3a',x-7,22,14,36);rect(g,'#433b52',x-7,22,3,36);rect(g,'#3a3348',x-9,18,18,5);rect(g,'#f1511b',x-7,30,14,2)}
 rect(g,'#2e2938',FURN.x,FURN.y,FURN.w,FURN.h);rect(g,'#433b52',FURN.x,FURN.y,FURN.w,2);rect(g,'#433b52',FURN.x,FURN.y,2,FURN.h);rect(g,'#1d1925',FURN.x+FURN.w-2,FURN.y,2,FURN.h);
 rect(g,'#f1511b',FURN.x,FURN.y+16,FURN.w,2);rect(g,'#9a3410',FURN.x,FURN.y+18,FURN.w,1);
 for(let x=FURN.x+8;x<FURN.x+FURN.w-4;x+=14){rect(g,'#5a5170',x,FURN.y+6,2,2);rect(g,'#1d1925',x+1,FURN.y+7,1,1)}
 // Refractory frame and window.
 rect(g,'#6e3d2b',WIN.x-6,WIN.y-6,WIN.w+12,WIN.h+12);
 for(let y=WIN.y-6;y<WIN.y+WIN.h+6;y+=4)for(let x=WIN.x-6+((y/4)%2?0:4);x<WIN.x+WIN.w+6;x+=8)rect(g,'#552c1f',x,y,1,4),rect(g,'#552c1f',x,y,8,1);
 rect(g,'#110b0d',WIN.x,WIN.y,WIN.w,WIN.h);
 for(const x of PILLARS){rect(g,'#2e2938',x-4,WIN.y,8,WIN.h);rect(g,'#433b52',x-4,WIN.y,1,WIN.h);rect(g,'#1d1925',x+3,WIN.y,1,WIN.h)}
 for(let x=WIN.x+12;x<WIN.x+WIN.w;x+=24){if(PILLARS.some(p=>Math.abs(p-x)<8))continue;rect(g,'#3a3348',x-4,WIN.y+WIN.h-4,8,4);rect(g,'#ffb35c',x-2,WIN.y+WIN.h-5,4,1)}
 // Strip slots.
 rect(g,'#0a0708',FURN.x-1,STRIP_Y-3,18,7);rect(g,'#0a0708',FURN.x+FURN.w-17,STRIP_Y-3,18,7);
 // Platforms (steel catwalks).
 for(const p of PLATFORMS){rect(g,'#57526a',p.x,p.y,p.w,4);rect(g,'#8c86a0',p.x,p.y,p.w,1);for(let x=p.x+2;x<p.x+p.w;x+=4)rect(g,'#2a2534',x,p.y+2,2,1);rect(g,'#3b3546',p.x+3,p.y+4,2,FLOOR-p.y-4);rect(g,'#3b3546',p.x+p.w-5,p.y+4,2,FLOOR-p.y-4)}
 // Terminal (control station).
 rect(g,'#24212c',TERM.x,128,TERM.w,FLOOR-128);rect(g,'#37324a',TERM.x,128,TERM.w,2);rect(g,'#37324a',TERM.x,128,2,FLOOR-128);
 rect(g,'#07120d',TERM.x+6,135,TERM.w-12,26);rect(g,'#3a3446',TERM.x+5,166,TERM.w-10,6);
 for(let x=TERM.x+7;x<TERM.x+TERM.w-7;x+=4)rect(g,'#5f5674',x,167,2,2);
 rect(g,'#f1511b',TERM.x+6,178,6,3);rect(g,'#16a34a',TERM.x+15,178,6,3);rect(g,'#7c3aed',TERM.x+24,178,6,3);
 // Floor: diamond plate + safety edge.
 rect(g,'#24212c',0,FLOOR,WORLD,VH-FLOOR);
 for(let y=FLOOR+4;y<VH;y+=4)for(let x=((y/4)%2)*4;x<WORLD;x+=8)rect(g,'#34303f',x,y,2,1);
 for(let x=0;x<WORLD;x++)rect(g,((x>>2)%2)?'#f2c230':'#1b1a22',x,FLOOR,1,2);
 for(const v of VENTS){rect(g,'#121016',v-10,FLOOR,20,3);for(let x=v-9;x<v+10;x+=3)rect(g,'#3a3446',x,FLOOR,1,3)}
})();

// ───────────────────────── Game state ─────────────────────────
let state='title',frame=0,camX=0,shake=0,best=store.get('rb1game.best',0);
let P,rolls,blocks,coins,items,parts,embers,toasts,log,crane,stats,inspect,boardOpen,boardTimer,cut,doneData,emberTimer;
const SHIFT=()=>{const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return h>=23||h<7?'TN':h<15?'TM':'TT'};
const nowHM=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date());
const statusOf=d=>d<=5?'green':d<=10?'yellow':'red';
const STATUS={green:['EM DIA','#22c55e'],yellow:['ATENÇÃO','#facc15'],red:['PRIORIDADE','#ef4444']};
const fmt=v=>v.toLocaleString('pt-BR');
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}

function reset(){
 const days=shuffle([12+Math.random()*10|0,15+Math.random()*12|0,6+Math.random()*4|0,Math.random()*5|0,1+Math.random()*4|0]);
 rolls=ROLL_X.map((x,i)=>({x,i,days:days[i],diam:780+(Math.random()*90|0),inspected:false,status:statusOf(days[i]),replaced:false,ang:Math.random()*6,variant:i?'hot':'steel'}));
 P={x:30,y:FLOOR-15,w:10,h:15,vx:0,vy:0,face:1,ground:true,coyote:0,jumpBuf:0,anim:0,carry:false,board:false,inv:0,hearts:2,lastSafe:30};
 blocks=BLOCKS_AT.map(([x,y],i)=>({x,y,used:false,bump:0,kind:i%2?'helmet':'coins'}));
 coins=COINS_AT.map(([x,y])=>({x,y,got:false,t:Math.random()*6}));
 items=[];parts=[];embers=[];toasts=[];log=[];
 crane={x:300,target:300,hook:0,cargo:null};
 stats={score:0,time:0,coins:0,epi:0,inspections:0,precise:0,swaps:0,hits:0};
 inspect=null;boardOpen=false;boardTimer=0;cut=null;doneData=null;emberTimer=120;
}
const ventPhase=i=>(frame+i*67)%260;
reset();

function toast(text,color='#fff',t=150){toasts.push({text,color,t,max:t});if(toasts.length>3)toasts.shift()}
function burst(x,y,colors,n=12,speed=1.6,grav=.08,life=40){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=Math.random()*speed;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,g:grav,life:life*(.6+Math.random()*.6),max:life,c:colors[i%colors.length],s:Math.random()<.3?2:1})}}
function addScore(v,x,y){stats.score=Math.max(0,stats.score+v);if(x!==undefined)parts.push({x,y,vx:0,vy:-.5,g:0,life:50,max:50,text:(v>0?'+':'')+v,c:v>0?'#ffd23f':'#ef4444'})}
function writeLog(title,line,color){log.push({title,line,color,shown:0});boardTimer=260;AU.sfx('write')}

function startGame(){reset();state='play';AU.init();AU.startMusic();toast('Pegue a prancheta na bancada','#ffd23f',240)}

// ───────────────────────── Objective ─────────────────────────
function objective(){
 const ins=rolls.filter(r=>r.inspected).length,pend=rolls.filter(r=>r.inspected&&r.status==='red').length;
 if(!P.board)return'Pegue a prancheta na bancada';
 if(pend&&P.carry)return'Leve o rolo novo até a posição em PRIORIDADE';
 if(pend)return`Pegue um rolo novo no estoque (${pend} troca${pend>1?'s':''} pendente${pend>1?'s':''})`;
 if(ins<5)return`Inspecione os rolos sob o forno (${ins}/5)`;
 return'Registre os dados no terminal RB1 Roll →';
}
function nearby(){
 const cx=P.x+P.w/2;
 if(!P.board&&Math.abs(cx-(TABLE.x+24))<20)return{label:'Pegar prancheta',fn:()=>{P.board=true;AU.sfx('power');toast('Prancheta na mão! Inspecione os 5 rolos','#ffd23f');writeLog('TURNO '+SHIFT(),'Início da ronda · '+nowHM(),'#7c3aed')}};
 if(cx>RACK.x&&cx<RACK.x+RACK.w&&P.board&&!P.carry){
  const pend=rolls.some(r=>r.inspected&&r.status==='red');
  return{label:pend?'Pegar rolo novo':'Estoque de rolos',fn:()=>{if(!pend){toast('Nenhuma troca necessária ainda. Inspecione primeiro.','#e4e4e7');AU.sfx('bad');return}P.carry=true;AU.sfx('clank');toast('Rolo novo! Cuidado: mais pesado, pula menos.','#86a7ba')}};
 }
 for(const r of rolls){
  if(Math.abs(cx-r.x)>16)continue;
  if(!P.board)return{label:'Precisa da prancheta',fn:()=>{toast('Pegue a prancheta na bancada primeiro','#ffd23f');AU.sfx('bad')}};
  if(!r.inspected)return{label:'Inspecionar rolo '+r.i,fn:()=>openInspect(r)};
  if(r.status==='red'&&P.carry)return{label:'Trocar rolo '+r.i,fn:()=>startSwap(r)};
  if(r.status==='red')return{label:'Rolo em prioridade',fn:()=>{toast('Busque um rolo novo no estoque','#ef4444');AU.sfx('bad')}};
  return{label:`Rolo ${r.i} · ${r.days} dias`,fn:()=>{toast(`Rolo ${r.i}: ${STATUS[r.status][0].toLowerCase()} · ${r.days} dias`,STATUS[r.status][1]);AU.sfx('select')}};
 }
 if(cx>TERM.x-6){
  const done=rolls.every(r=>r.inspected&&r.status!=='red');
  return{label:done?'Registrar no RB1 Roll':'Terminal RB1 Roll',fn:()=>{if(!done){toast('Conclua as inspeções e as trocas antes','#e4e4e7');AU.sfx('bad');return}finish()}};
 }
 return null;
}

// ───────────────────────── Inspection mini-game ─────────────────────────
function openInspect(r){state='inspect';inspect={r,pos:0,dir:1,speed:.018+Math.random()*.006,phase:'aim',t:0,quality:null};AU.sfx('select')}
function updateInspect(){
 const s=inspect;s.t++;
 if(s.phase==='aim'){
  s.pos+=s.dir*s.speed;if(s.pos>1){s.pos=1;s.dir=-1}if(s.pos<0){s.pos=0;s.dir=1}
  if(take('act')||take('jump')){
   const d=Math.abs(s.pos-.5);
   s.quality=d<.08?'precise':d<.2?'ok':'poor';s.phase='result';s.t=0;
   const pts={precise:150,ok:80,poor:30}[s.quality];addScore(pts);
   stats.inspections++;if(s.quality==='precise')stats.precise++;
   AU.sfx(s.quality==='precise'?'good':s.quality==='ok'?'ok':'bad');
  }
 }else if(s.t>110||(s.t>30&&(take('act')||take('jump')))){
  const r=s.r;r.inspected=true;
  const [label,color]=STATUS[r.status];
  writeLog(`POS ${r.i} · ${r.days} DIAS`,`${label} · Ø ${r.diam} · P ${fmt(Math.round(Math.PI*r.diam))} mm`,color);
  toast(r.status==='red'?`Rolo ${r.i} precisa de troca! Pegue um rolo novo no estoque.`:`Rolo ${r.i} registrado: ${label.toLowerCase()}`,color,200);
  inspect=null;state='play';
 }
}

// ───────────────────────── Roll swap cutscene ─────────────────────────
function startSwap(r){state='crane';cut={r,phase:0,t:0};crane.target=r.x;AU.sfx('crane')}
function updateSwap(){
 const c=cut,r=c.r;c.t++;
 crane.x+=(crane.target-crane.x)*.08;
 const reach=ROLL_Y-16;
 switch(c.phase){
  case 0:if(Math.abs(crane.x-crane.target)<1){c.phase=1;c.t=0}break;
  case 1:crane.hook=Math.min(reach,crane.hook+3);if(crane.hook>=reach){c.phase=2;c.t=0;AU.sfx('clank');crane.cargo=r.variant;r.hidden=true;shake=6;burst(r.x,ROLL_Y,['#ff9b3d','#ffe2a2','#d9561b'],18,2)}break;
  case 2:crane.hook=Math.max(0,crane.hook-2.5);if(crane.hook<=0){c.phase=3;c.t=0;crane.cargo=null}break;
  case 3:if(c.t===1){P.carry=false;crane.cargo='fresh';AU.sfx('crane')}crane.hook=Math.min(reach,crane.hook+2.5);if(crane.hook>=reach){c.phase=4;c.t=0;r.hidden=false;r.variant='fresh';r.days=0;r.status='green';r.replaced=true;crane.cargo=null;AU.sfx('clank');shake=5;burst(r.x,ROLL_Y,['#ffffff','#86e1ff','#ffd23f'],24,2.2,.05,50)}break;
  case 4:crane.hook=Math.max(0,crane.hook-3);if(crane.hook<=0&&c.t>30){
   stats.swaps++;addScore(250,r.x,ROLL_Y-30);AU.sfx('power');
   writeLog(`TROCA · POS ${r.i}`,`Turno ${SHIFT()} · ${nowHM()} · Ø ${r.diam} mm`,'#86e1ff');
   toast(`Troca do rolo ${r.i} registrada!`,'#86e1ff');cut=null;state='play';
  }break;
 }
}

function finish(){
 const secs=Math.floor(stats.time/60),bonus=Math.max(0,3000-secs*12);
 addScore(bonus);
 const rank=stats.score>=5200?'S':stats.score>=4200?'A':stats.score>=3000?'B':'C';
 doneData={secs,bonus,rank};
 if(stats.score>best){best=stats.score;store.set('rb1game.best',best)}
 writeLog('REGISTRADO NO RB1 ROLL',`${stats.swaps} trocas · ${stats.inspections} inspeções`,'#22c55e');
 state='done';AU.stopMusic();AU.sfx('win');
 burst(P.x,P.y,['#f1511b','#7c3aed','#ffd23f','#22c55e'],40,3,.06,80);
}

// ───────────────────────── Play update ─────────────────────────
function hurt(src){
 if(P.inv>0)return;
 stats.hits++;P.hearts--;P.inv=110;P.vy=-3;P.vx=(P.x<src?-2.2:2.2);
 AU.sfx('hit');shake=8;addScore(-50,P.x,P.y-6);
 burst(P.x+5,P.y+6,['#ffffff','#ef4444'],10);
 if(P.hearts<=0){P.hearts=2;addScore(-100);P.x=P.lastSafe;P.y=FLOOR-P.h;P.vx=0;P.vy=0;toast('Acidente evitado! Use o EPI e preste atenção.','#ef4444',220)}
 else toast('Cuidado! Proteja-se das fagulhas e do vapor.','#ef4444');
}
function overlap(a,bx,by,bw,bh){return a.x<bx+bw&&a.x+a.w>bx&&a.y<by+bh&&a.y+a.h>by}
function updatePlay(){
 stats.time++;
 if(take('pause')){state='pause';return}
 if(take('board'))boardOpen=!boardOpen;
 // Horizontal movement with acceleration.
 const max=P.carry?1.15:1.75,acc=P.ground?.32:.22;
 if(keys.left){P.vx=Math.max(-max,P.vx-acc);P.face=-1}
 else if(keys.right){P.vx=Math.min(max,P.vx+acc);P.face=1}
 else P.vx*=P.ground?.72:.92;
 if(Math.abs(P.vx)<.05)P.vx=0;
 // Jump with buffer and coyote time; short hop when the key is released early.
 if(take('jump'))P.jumpBuf=7;
 if(P.jumpBuf>0)P.jumpBuf--;
 if(P.ground)P.coyote=6;else if(P.coyote>0)P.coyote--;
 if(P.jumpBuf&&P.coyote){P.vy=P.carry?-3.7:-4.75;P.jumpBuf=0;P.coyote=0;P.ground=false;AU.sfx('jump')}
 P.vy+=.24;if(!keys.jump&&P.vy<-1.4)P.vy+=.3;if(P.vy>5)P.vy=5;
 // Move X and resolve against solid blocks.
 P.x+=P.vx;
 for(const k of blocks){if(overlap(P,k.x,k.y,16,16)){if(P.vx>0)P.x=k.x-P.w;else if(P.vx<0)P.x=k.x+16;P.vx=0}}
 P.x=Math.max(0,Math.min(WORLD-P.w,P.x));
 // Move Y.
 const prevBottom=P.y+P.h;P.y+=P.vy;P.ground=false;
 if(P.y+P.h>=FLOOR){P.y=FLOOR-P.h;if(P.vy>2.5)burst(P.x+5,FLOOR,['#6b6680'],4,.6,.05,20);P.vy=0;P.ground=true}
 if(P.vy>=0)for(const p of PLATFORMS){if(P.x+P.w>p.x+1&&P.x<p.x+p.w-1&&prevBottom<=p.y+.5&&P.y+P.h>=p.y){P.y=p.y-P.h;P.vy=0;P.ground=true}}
 for(const k of blocks){
  if(!overlap(P,k.x,k.y,16,16))continue;
  if(P.vy<0){P.y=k.y+16;P.vy=.5;hitBlock(k)}
  else{P.y=k.y-P.h;P.vy=0;P.ground=true}
 }
 if(P.ground&&P.y+P.h===FLOOR&&!VENTS.some(v=>Math.abs(P.x+5-v)<26))P.lastSafe=P.x;
 if(P.inv>0)P.inv--;
 P.anim+=Math.abs(P.vx)*.12;
 // Interact.
 const near=nearby();
 if(take('act')&&near)near.fn();
 // Coins.
 for(const c of coins){c.t+=.08;if(!c.got&&overlap(P,c.x-4,c.y-3,8,8)){c.got=true;stats.coins++;addScore(10);AU.sfx('coin');burst(c.x,c.y,['#ffd23f','#fff'],6,1)}}
 // Items popped from blocks.
 for(const it of items){
  it.t++;if(it.t<18)it.y-=.9;
  if(!it.got&&it.t>8&&overlap(P,it.x-5,it.y-3,10,6)){
   it.got=true;
   if(it.kind==='helmet'){if(P.hearts<3)P.hearts++;stats.epi++;addScore(100,it.x,it.y);AU.sfx('power');toast('EPI coletado: capacete! +1 proteção','#f1511b')}
  }
 }
 items=items.filter(it=>!it.got);
 // Hazards: embers from the furnace top lip, steam from floor vents.
 if(--emberTimer<=0){emberTimer=55+Math.random()*50|0;const x=FURN.x+30+Math.random()*(FURN.w-60);embers.push({x,y:FURN.y+18,vx:(Math.random()-.5)*.3,vy:0,warn:45})}
 for(const e of embers){
  if(e.warn>0){e.warn--;continue}
  e.vy=Math.min(2.4,e.vy+.06);e.x+=e.vx;e.y+=e.vy;
  if(Math.random()<.4)parts.push({x:e.x,y:e.y,vx:0,vy:-.2,g:0,life:12,max:12,c:'#ff9b3d',s:1});
  if(overlap(P,e.x-2,e.y-2,4,4))hurt(e.x),e.dead=true;
  if(e.y>FLOOR-2){e.dead=true;burst(e.x,FLOOR-1,['#ff9b3d','#ffe2a2'],5,1,.1,18)}
 }
 embers=embers.filter(e=>!e.dead);
 VENTS.forEach((v,i)=>{
  const ph=ventPhase(i);
  if(ph===180)AU.sfx('steam');
  if(ph>=180&&ph<250&&overlap(P,v-7,FLOOR-48,14,48))hurt(v);
 });
}
function hitBlock(k){
 AU.sfx('bump');k.bump=8;
 if(k.used)return;k.used=true;
 if(k.kind==='helmet')items.push({x:k.x+8,y:k.y-2,kind:'helmet',t:0});
 else{for(let i=0;i<3;i++)setTimeout(()=>{stats.coins++;addScore(10,k.x+8,k.y-10-i*6);AU.sfx('coin')},i*90);burst(k.x+8,k.y,['#ffd23f'],8,1.4)}
}
function updateCommon(){
 frame++;
 crane.x+=(crane.target-crane.x)*.02;
 if(state==='play'&&!cut&&frame%400===0)crane.target=200+Math.random()*(WORLD-400);
 for(const r of rolls)if(!r.hidden)r.ang+=.045;
 for(const p of parts){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.life--}
 parts=parts.filter(p=>p.life>0);
 for(const t of toasts)t.t--;toasts=toasts.filter(t=>t.t>0);
 if(boardTimer>0)boardTimer--;
 for(const l of log)if(l.shown<200)l.shown+=1.2;
 for(const k of blocks)if(k.bump>0)k.bump--;
 if(shake>0)shake*=.85;if(shake<.3)shake=0;
 // Chimney smoke.
 if(frame%9===0)for(const x of CHIMNEYS)parts.push({x:x+(Math.random()-.5)*6,y:18,vx:.15+Math.random()*.15,vy:-.25,g:0,life:90,max:90,c:'#5a5468',s:2,smoke:true});
 // Camera.
 let target;
 if(state==='title')target=600+Math.sin(frame/260)*420;
 else if(cut)target=cut.r.x-VW/2;
 else target=P.x+P.w/2-VW/2+P.face*24;
 target=Math.max(0,Math.min(WORLD-VW,target));
 camX+=(target-camX)*(state==='title'?.03:.12);
}

// ───────────────────────── World render (pixel layer) ─────────────────────────
function renderWorld(){
 const cx=Math.round(camX+(shake?(Math.random()-.5)*shake:0)),cy=shake?Math.round((Math.random()-.5)*shake*.6):0;
 b.setTransform(1,0,0,1,0,0);
 b.drawImage(far,Math.round(-cx*.45),0);
 b.setTransform(1,0,0,1,-cx,cy);
 // Furnace interior glow and fire (behind casing pieces drawn from the static layer).
 const g=b.createLinearGradient(0,WIN.y,0,WIN.y+WIN.h);g.addColorStop(0,'#160c0c');g.addColorStop(.55,'#3a140d');g.addColorStop(1,'#a8380f');
 const t=frame/60,fy=WIN.y+WIN.h;
 b.drawImage(mid,cx-4,0,VW+8,VH,cx-4,0,VW+8,VH);
 // The static layer paints the window dark; the glow and flames are drawn over it, clipped to the window.
 b.save();b.beginPath();b.rect(WIN.x,WIN.y,WIN.w,WIN.h);b.clip();
 b.fillStyle=g;b.fillRect(WIN.x,WIN.y,WIN.w,WIN.h);
 for(let x=WIN.x;x<WIN.x+WIN.w;x+=2){
  if(x<cx-4||x>cx+VW+4)continue;
  const base=(x-WIN.x)%24;const dist=Math.min(base,24-base);
  const n=Math.sin(x*.09+t*3.1)*.5+Math.sin(x*.023-t*1.7)*.35+Math.sin(x*.21+t*7)*.15;
  const hgt=Math.max(3,26+n*8-dist*1.4);
  for(let y=0;y<hgt;y+=2){const k=y/hgt;if(k>.8&&((x*7+y*3+frame)>>2)%3===0)continue;b.fillStyle=k<.2?'#fff4c2':k<.42?'#ffc94a':k<.7?'#ff8a2a':'#d9461b';b.fillRect(x,fy-y-6,2,2)}
 }
 for(let x=WIN.x+12;x<WIN.x+WIN.w;x+=24){if(PILLARS.some(p=>Math.abs(p-x)<8))continue;b.fillStyle='#3a3348';b.fillRect(x-4,fy-4,8,4);b.fillStyle='#ffe2a2';b.fillRect(x-2,fy-5,4,1)}
 for(const x of PILLARS){b.fillStyle='#2e2938';b.fillRect(x-4,WIN.y,8,WIN.h);b.fillStyle='#433b52';b.fillRect(x-4,WIN.y,1,WIN.h);b.fillStyle='#1d1925';b.fillRect(x+3,WIN.y,1,WIN.h)}
 b.restore();
 // Rack stock: three fresh rolls always available.
 for(const [x,y] of [[RACK.x+20,135],[RACK.x+46,135],[RACK.x+33,171]])drawRoll(b,x,y,'fresh',0);
 // Clipboard on the table.
 if(!P.board){b.drawImage(CLIP,TABLE.x+20,TABLE.y-10);if((frame>>4)%2)rect(b,'#ffd23f',TABLE.x+24,TABLE.y-16,2,2)}
 // Strip over the rolls (moving marks).
 rect(b,'#dcdae4',380,STRIP_Y,1380,2);rect(b,'#8f8aa0',380,STRIP_Y+2,1380,1);
 for(let x=380+((frame*1.2)%16);x<1760;x+=16)rect(b,'#6b6680',Math.floor(x),STRIP_Y,3,1);
 // Rolls, plates and status LEDs.
 for(const r of rolls){
  if(!r.hidden)drawRoll(b,r.x,ROLL_Y,r.variant,r.ang);
  const px=r.x-8,py=ROLL_Y+R+5;
  rect(b,'#1b1a22',px,py,16,9);rect(b,'#3a3446',px,py,16,1);
  digit(String(r.i),px+3,py+2,'#e4e4e7');
  const led=r.inspected?STATUS[r.status][1]:((frame>>4)%2?'#6b6680':'#3a3446');
  rect(b,led,px+10,py+3,3,3);if(r.inspected){b.globalAlpha=.35;rect(b,led,px+9,py+2,5,5);b.globalAlpha=1}
 }
 // Terminal screen (live chart).
 for(let i=0;i<9;i++){const h=4+((Math.sin(frame/30+i)*.5+.5)*14|0);rect(b,i%3===2?'#f1511b':'#22c55e',TERM.x+9+i*4,159-h,2,h)}
 if(rolls.every(r=>r.inspected&&r.status!=='red')&&(frame>>4)%2)rect(b,'#ffd23f',TERM.x+TERM.w/2-1,120,3,3);
 // Crane.
 const cxr=Math.round(crane.x);
 rect(b,'#4a4258',cxr-12,8,24,10);rect(b,'#f1511b',cxr-12,8,24,2);rect(b,'#2a2534',cxr-10,17,4,2);rect(b,'#2a2534',cxr+6,17,4,2);
 const hy=22+crane.hook;rect(b,'#8f8aa0',cxr,18,1,hy-18);rect(b,'#c9c5d6',cxr-3,hy,7,3);rect(b,'#c9c5d6',cxr-1,hy+3,3,3);
 if(crane.cargo)drawRoll(b,cxr,hy+6+R,crane.cargo,frame*.02);
 // Blocks.
 for(const k of blocks){
  const y=k.y-(k.bump>0?Math.sin(k.bump/8*Math.PI)*4:0)|0;
  if(k.used){rect(b,'#3a3446',k.x,y,16,16);rect(b,'#57526a',k.x+1,y+1,14,14);rect(b,'#3a3446',k.x+3,y+3,2,2);rect(b,'#3a3446',k.x+11,y+3,2,2);rect(b,'#3a3446',k.x+3,y+11,2,2);rect(b,'#3a3446',k.x+11,y+11,2,2)}
  else{
   rect(b,'#7a2a0c',k.x,y,16,16);rect(b,'#f1511b',k.x+1,y+1,14,14);rect(b,'#ff9466',k.x+1,y+1,14,1);rect(b,'#ff9466',k.x+1,y+1,1,14);rect(b,'#b33a0f',k.x+1,y+14,14,1);
   for(const [i,j] of [[3,3],[12,3],[3,12],[12,12]])rect(b,'#7a2a0c',k.x+i,y+j,1,1);
   const sh=(frame>>3)%8<4?'#ffffff':'#ffe2a2';
   [[6,4],[7,4],[8,4],[5,5],[9,5],[9,6],[7,7],[8,7],[7,8],[7,10]].forEach(([i,j])=>rect(b,sh,k.x+i,y+j,1,1));
  }
 }
 // Coins (spinning nuts).
 for(const c of coins){if(c.got)continue;const sc=Math.abs(Math.cos(c.t));const w=Math.max(1,Math.round(8*sc));b.drawImage(NUT,0,0,8,6,Math.round(c.x-w/2),Math.round(c.y-3+Math.sin(c.t*.7)),w,6)}
 for(const it of items)b.drawImage(HELMET,Math.round(it.x-5),Math.round(it.y-4));
 // Steam vents.
 VENTS.forEach((v,i)=>{
  const ph=ventPhase(i);
  if(ph>=140&&ph<180&&frame%4===0)parts.push({x:v+(Math.random()-.5)*10,y:FLOOR-2,vx:0,vy:-.3,g:0,life:20,max:20,c:'#c9c5d6',s:1});
  if(ph>=180&&ph<250){const k=Math.min(1,(ph-180)/10)*Math.min(1,(250-ph)/12);for(let n=0;n<5;n++){const y=FLOOR-Math.random()*48*k;parts.push({x:v+(Math.random()-.5)*12,y,vx:(Math.random()-.5)*.4,vy:-1.2,g:0,life:16,max:16,c:Math.random()<.5?'#e8e6f0':'#a9a5b8',s:2})}}
 });
 // Ember warnings and embers.
 for(const e of embers){if(e.warn>0){if((e.warn>>2)%2)rect(b,'#ffd23f',Math.round(e.x)-1,FLOOR-3,3,1);rect(b,'#ff9b3d',Math.round(e.x)-1,e.y,3,2)}else{rect(b,'#ffe2a2',Math.round(e.x)-1,Math.round(e.y)-1,3,3);rect(b,'#ff6a1a',Math.round(e.x)-2,Math.round(e.y),5,1)}}
 // Particles (non-text).
 for(const p of parts){if(p.text)continue;b.globalAlpha=p.smoke?Math.min(.5,p.life/p.max):Math.min(1,p.life/(p.max*.5));rect(b,p.c,Math.round(p.x),Math.round(p.y),p.s||1,p.s||1)}
 b.globalAlpha=1;
 // Hero.
 if(state!=='title'){
  const moving=Math.abs(P.vx)>.2;
  const key=(!P.ground?'jump':moving?((P.anim|0)%2?'walkA':'walkB'):'idle')+(P.carry?1:0);
  const frames=HERO[key],blink=P.inv>0&&(P.inv>>2)%2;
  const img=blink?(P.face>0?frames.fr:frames.fl):(P.face>0?frames.r:frames.l);
  rect(b,'rgba(0,0,0,.35)',Math.round(P.x),FLOOR,P.w,1);
  b.drawImage(img,Math.round(P.x-1),Math.round(P.y-1));
  if(P.carry)drawRoll(b,P.x+5,P.y-R+1,'fresh',frame*.05);
  if(P.board&&!P.carry)b.drawImage(CLIP,0,0,10,10,Math.round(P.face>0?P.x+7:P.x-6),Math.round(P.y+7),6,6);
 }
 // Warm light spill on the floor in front of the furnace.
 b.globalAlpha=.16+Math.sin(frame/7)*.03;b.fillStyle='#ff7a2a';b.fillRect(FURN.x,FLOOR-2,FURN.w,4);b.globalAlpha=.07;b.fillRect(FURN.x,FLOOR+2,FURN.w,10);b.globalAlpha=1;
 b.setTransform(1,0,0,1,0,0);
 // Vignette.
 const vg=b.createRadialGradient(VW/2,VH/2,VH*.4,VW/2,VH/2,VH*.95);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.45)');b.fillStyle=vg;b.fillRect(0,0,VW,VH);
}

// ───────────────────────── UI render (crisp layer) ─────────────────────────
const PX='"Press Start 2P",monospace',SANS='Inter,system-ui,sans-serif';
function U(){ctx.setTransform(DPR*S,0,0,DPR*S,DPR*OX,DPR*OY)}
function txt(s,x,y,size,color,align='left',font=PX,weight='',max){ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';max?ctx.fillText(s,x,y,max):ctx.fillText(s,x,y)}
function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke()}}
function button(label,x,y,w,h,fn,primary){
 buttons.push({x,y,w,h,fn});
 rr(x,y,w,h,4,primary?'#f1511b':'rgba(255,255,255,.08)',primary?null:'rgba(255,255,255,.25)');
 txt(label,x+w/2,y+h/2-3.5,7,'#fff','center');
}
function shadowText(s,x,y,size,color,align='left'){txt(s,x+1,y+1,size,'rgba(0,0,0,.6)',align);txt(s,x,y,size,color,align)}
function hud(){
 rr(4,4,VW-8,24,5,'rgba(10,10,12,.72)','rgba(255,255,255,.08)');
 for(let i=0;i<3;i++){ctx.globalAlpha=i<P.hearts?1:.22;ctx.imageSmoothingEnabled=false;ctx.drawImage(HELMET,10+i*13,10,10,5);ctx.globalAlpha=1}
 txt('PONTOS',54,8,4.5,'#9a9aa2');txt(String(stats.score).padStart(5,'0'),54,15,7,'#ffd23f');
 const secs=Math.floor(stats.time/60);txt('TEMPO',104,8,4.5,'#9a9aa2');txt(`${String(secs/60|0).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`,104,15,7,'#fff');
 txt('TURNO',146,8,4.5,'#9a9aa2');txt(SHIFT(),146,15,7,'#a78bfa');
 ctx.imageSmoothingEnabled=false;ctx.drawImage(NUT,178,15,8,6);txt('x'+stats.coins,189,15,6,'#fff');
 txt('MISSÃO',212,8,4.5,'#9a9aa2');txt(objective(),212,15.5,6.2,'#fff','left',SANS,700,VW-118-212);
 // Roll status dots.
 rolls.forEach((r,i)=>{const x=VW-105+i*10,c=r.inspected?STATUS[r.status][1]:'#3a3446';ctx.beginPath();ctx.arc(x,16,3.8,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();txt(String(i),x,13.6,4.5,r.inspected?'#0a0a0a':'#9a9aa2','center')});
 corner(true);
}
// Icon buttons (pause, sound, close) drawn in the crisp layer, top-right.
function corner(withPause){
 const list=[];
 if(withPause)list.push(['pause',()=>{if(state==='play')state='pause';else if(state==='pause')state='play'}]);
 list.push(['sound',()=>{AU.init();toggleMute()}]);
 let x=VW-10-list.length*15;
 for(const [kind,fn] of list){
  buttons.push({x,y:9,w:13,h:13,fn});
  rr(x,9,13,13,3,'rgba(255,255,255,.08)','rgba(255,255,255,.2)');
  ctx.fillStyle='#e4e4e7';ctx.strokeStyle='#e4e4e7';ctx.lineWidth=1;ctx.lineCap='round';
  const cx=x+6.5,cy=15.5;
  if(kind==='pause'){ctx.fillRect(cx-2.5,cy-3,1.8,6);ctx.fillRect(cx+.7,cy-3,1.8,6)}
  else if(kind==='sound'){ctx.beginPath();ctx.moveTo(cx-4,cy-1.5);ctx.lineTo(cx-2,cy-1.5);ctx.lineTo(cx+.5,cy-3.5);ctx.lineTo(cx+.5,cy+3.5);ctx.lineTo(cx-2,cy+1.5);ctx.lineTo(cx-4,cy+1.5);ctx.fill();
   if(AU.muted){ctx.beginPath();ctx.moveTo(cx+2,cy-2);ctx.lineTo(cx+4.5,cy+2);ctx.moveTo(cx+4.5,cy-2);ctx.lineTo(cx+2,cy+2);ctx.stroke()}
   else{ctx.beginPath();ctx.arc(cx+.5,cy,2.6,-.8,.8);ctx.stroke();ctx.beginPath();ctx.arc(cx+.5,cy,4.4,-.8,.8);ctx.stroke()}}
  else{ctx.beginPath();ctx.moveTo(cx-2.5,cy-2.5);ctx.lineTo(cx+2.5,cy+2.5);ctx.moveTo(cx+2.5,cy-2.5);ctx.lineTo(cx-2.5,cy+2.5);ctx.stroke()}
  x+=15;
 }
}
function prompt(){
 const n=nearby();if(!n||state!=='play')return;
 const x=P.x+P.w/2-Math.round(camX),y=P.y-(P.carry?R*2+12:14);
 ctx.font=`700 6px ${SANS}`;const w=ctx.measureText(n.label).width+22;
 rr(x-w/2,y-11,w,12,3,'rgba(10,10,12,.85)','rgba(255,255,255,.2)');
 rr(x-w/2+3,y-9,8,8,2,'#f1511b');txt('E',x-w/2+7,y-7.2,4.5,'#fff','center');
 txt(n.label,x-w/2+14,y-8.6,6,'#fff','left',SANS,700);
}
function toastsUI(){
 toasts.forEach((t,i)=>{
  const a=Math.min(1,t.t/20,(t.max-t.t)/10);ctx.globalAlpha=a;
  ctx.font=`700 7px ${SANS}`;const w=ctx.measureText(t.text).width+20;
  const y=VH-30-(toasts.length-1-i)*15;
  rr(VW/2-w/2,y,w,13,4,'rgba(10,10,12,.88)','rgba(255,255,255,.12)');
  ctx.beginPath();ctx.arc(VW/2-w/2+7,y+6.5,2,0,Math.PI*2);ctx.fillStyle=t.color;ctx.fill();
  txt(t.text,VW/2-w/2+12,y+3,7,'#fff','left',SANS,700);ctx.globalAlpha=1;
 });
 for(const p of parts){if(!p.text)continue;ctx.globalAlpha=Math.min(1,p.life/25);shadowText(p.text,p.x-Math.round(camX),p.y,6,p.c,'center');ctx.globalAlpha=1}
}
function board(){
 const show=boardOpen||boardTimer>0;if(!show||!P.board)return;
 const slide=boardOpen?1:Math.min(1,boardTimer/20,(260-boardTimer)/12+.0001);
 const w=136,x=VW-w-8+(1-Math.min(1,slide))*150,y=34,h=150;
 rr(x,y,w,h,6,'#8a5a2b');rr(x+1,y+1,w-2,h-2,5,null,'#5e3b1a');
 rr(x+6,y+10,w-12,h-16,2,'#f6f3ea');
 rr(x+w/2-16,y-2,32,10,3,'#c3c8d0','#6b7280');
 txt('PRANCHETA · RONDA',x+12,y+15,4.6,'#7c3aed');
 ctx.strokeStyle='#e7e2d3';ctx.lineWidth=.5;for(let ly=y+28;ly<y+h-22;ly+=13){ctx.beginPath();ctx.moveTo(x+10,ly+10);ctx.lineTo(x+w-10,ly+10);ctx.stroke()}
 txt('Tecla C · abrir/fechar',x+w/2,y+h-11,4.6,'#f3e9d8','center',SANS,600);
 const list=log.slice(-7);
 list.forEach((l,i)=>{
  const ly=y+26+i*14.5;
  const t1=l.title.slice(0,Math.ceil(l.shown*1.2)),t2=l.line.slice(0,Math.max(0,Math.ceil(l.shown*1.2-l.title.length)));
  ctx.beginPath();ctx.arc(x+12,ly+3,1.6,0,Math.PI*2);ctx.fillStyle=l.color;ctx.fill();
  txt(t1,x+16,ly,5.6,'#22223a','left',SANS,700);
  txt(t2,x+16,ly+6.5,4.8,'#5b5b70','left',SANS,500);
 });
}
function panel(x,y,w,h){rr(x,y,w,h,8,'rgba(14,14,18,.96)','rgba(255,255,255,.12)')}
function inspectUI(){
 const s=inspect,r=s.r;
 ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,VW,VH);
 const x=60,y=34,w=280,h=160;panel(x,y,w,h);
 txt('INSPEÇÃO',x+14,y+12,5,'#a78bfa');txt(`Rolo ${r.i} · ${r.i?'Forno, posição '+r.i:'Externo'}`,x+14,y+21,9,'#fff','left',SANS,800);
 // Big roll.
 ctx.imageSmoothingEnabled=false;
 const bx=x+60,by=y+92;
 ctx.save();ctx.translate(bx,by);ctx.rotate(r.ang);ctx.drawImage(BIG[r.variant],-BIGR,-BIGR);ctx.restore();
 ctx.fillStyle=ROLL_PAL[r.variant][0];for(let k=0;k<6;k++){const a=r.ang+k*Math.PI/3;for(let t=6;t<BIGR-3;t+=1.4){ctx.fillRect(bx+Math.cos(a)*t-.6,by+Math.sin(a)*t-.6,1.2,1.2)}}
 // Scanner sweep.
 const sw=Math.sin(frame/12)*BIGR;ctx.fillStyle='rgba(124,58,237,.25)';ctx.fillRect(bx-BIGR-4,by+sw-1,BIGR*2+8,2);
 const gx=x+120,gw=144;
 if(s.phase==='aim'){
  txt('Pare o cursor no verde para uma',gx,y+44,6.5,'#e4e4e7','left',SANS,600);
  txt('leitura precisa de desgaste.',gx,y+53,6.5,'#e4e4e7','left',SANS,600);
  const by2=y+74;
  const zones=[[0,.3,'#ef4444'],[.3,.42,'#facc15'],[.42,.58,'#22c55e'],[.58,.7,'#facc15'],[.7,1,'#ef4444']];
  zones.forEach(([a,c,col])=>{ctx.fillStyle=col;ctx.globalAlpha=.85;ctx.fillRect(gx+a*gw,by2,(c-a)*gw,12)});ctx.globalAlpha=1;
  rr(gx,by2,gw,12,2,null,'rgba(255,255,255,.4)');
  const cxp=gx+s.pos*gw;ctx.fillStyle='#fff';ctx.fillRect(cxp-1,by2-4,2,20);ctx.beginPath();ctx.moveTo(cxp-4,by2-6);ctx.lineTo(cxp+4,by2-6);ctx.lineTo(cxp,by2-1);ctx.fill();
  rr(gx,y+102,gw,16,4,'#f1511b');txt('E / ESPAÇO / TOQUE · PARAR',gx+gw/2,y+107,4.8,'#fff','center');
 }else{
  const q={precise:['LEITURA PRECISA','#22c55e','+150'],ok:['LEITURA ACEITÁVEL','#facc15','+80'],poor:['LEITURA IMPRECISA','#ef4444','+30']}[s.quality];
  txt(q[0],gx,y+42,6,q[1]);txt(q[2]+' pontos',gx+gw,y+43,6,'#ffd23f','right',SANS,700);
  const [label,col]=STATUS[r.status];
  const rows=[['Tempo de uso',r.days+' dias'],['Diâmetro','Ø '+r.diam+' mm'],['Perímetro',fmt(Math.round(Math.PI*r.diam))+' mm']];
  rows.forEach(([k,v],i)=>{const yy=y+58+i*13;txt(k,gx,yy,6.5,'#9a9aa2','left',SANS,500);txt(v,gx+gw,yy,6.5,'#fff','right',SANS,700);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(gx,yy+10,gw,.5)});
  rr(gx,y+100,gw,18,4,col+'33',col);txt('STATUS: '+label,gx+gw/2,y+106,5.6,col,'center');
  txt('anotando na prancheta…',gx+gw/2,y+124,5.6,'#9a9aa2','center',SANS,500);
 }
}
function titleUI(){
 ctx.fillStyle='rgba(6,6,10,.55)';ctx.fillRect(0,0,VW,VH);
 corner(false);
 txt('RB1 ROLL · APRESENTA',VW/2,30,5.5,'#a78bfa','center');
 shadowText('A MISSÃO',VW/2,46,17,'#fff','center');
 shadowText('DO FORNO',VW/2,68,17,'#fff','center');
 ctx.fillStyle='#f1511b';ctx.fillRect(VW/2+70,80,5,5);
 txt('Rolando, técnico do RB1, precisa inspecionar os rolos, trocar os que estão',VW/2,98,6.6,'#d4d4d8','center',SANS,500);
 txt('em prioridade e registrar tudo na prancheta antes do fim do turno.',VW/2,107,6.6,'#d4d4d8','center',SANS,500);
 // Hero preview.
 ctx.imageSmoothingEnabled=false;const hf=HERO[((frame>>3)%2?'walkA':'walkB')+'0'];ctx.drawImage(hf.r,VW/2-12,120,24,32);
 if((frame>>5)%2===0)txt('PRESSIONE ENTER OU TOQUE PARA COMEÇAR',VW/2,160,5.6,'#ffd23f','center');
 const ctl=[['← →','andar'],['↑ / ESPAÇO','pular'],['E','agir'],['C','prancheta'],['P','pausa'],['M','som']];
 let cx=VW/2-ctl.length*30;
 ctl.forEach(([k,v])=>{rr(cx,178,56,18,4,'rgba(255,255,255,.06)','rgba(255,255,255,.14)');txt(k,cx+28,182,4.6,'#fff','center');txt(v,cx+28,189,5,'#9a9aa2','center',SANS,500);cx+=60});
 if(best)txt('RECORDE: '+best,VW/2,204,5,'#9a9aa2','center');
}
function pauseUI(){
 ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,VW,VH);
 panel(VW/2-90,60,180,104);
 txt('PAUSA',VW/2,74,10,'#fff','center');
 button('CONTINUAR',VW/2-70,98,140,16,()=>{state='play'},true);
 button('RECOMEÇAR',VW/2-70,118,140,16,()=>startGame());
 button(AU.muted?'LIGAR SOM':'DESLIGAR SOM',VW/2-70,138,140,16,()=>{AU.init();toggleMute()});
}
function doneUI(){
 ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,VW,VH);
 const x=40,y=16,w=320,h=194;panel(x,y,w,h);
 txt('MISSÃO CUMPRIDA',x+16,y+14,5.5,'#22c55e');
 txt('Dados registrados no RB1 Roll',x+16,y+23,10,'#fff','left',SANS,800);
 // Rank badge.
 rr(x+w-58,y+12,42,42,8,'#f1511b');txt(doneData.rank,x+w-37,y+21,20,'#fff','center');txt('NOTA',x+w-37,y+45,4.5,'#ffe2a2','center');
 const st=[['Pontuação',fmt(stats.score)],['Tempo',`${doneData.secs/60|0}min ${doneData.secs%60}s`],['Inspeções precisas',`${stats.precise}/${stats.inspections}`],['Trocas realizadas',String(stats.swaps)],['EPI coletados',String(stats.epi)],['Porcas coletadas',String(stats.coins)]];
 st.forEach(([k,v],i)=>{const cx=x+16+(i%3)*84,cy=y+44+(i/3|0)*24;txt(k,cx,cy,5.6,'#9a9aa2','left',SANS,500);txt(v,cx,cy+8,8,'#fff','left',SANS,800)});
 // Final roll table.
 const ty=y+98;txt('CONDIÇÃO FINAL DOS ROLOS',x+16,ty,4.8,'#a78bfa');
 rolls.forEach((r,i)=>{const cx=x+16+i*58,cy=ty+10;const [label,col]=STATUS[r.status];rr(cx,cy,54,38,4,'rgba(255,255,255,.04)','rgba(255,255,255,.1)');ctx.beginPath();ctx.arc(cx+9,cy+10,5,0,Math.PI*2);ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.stroke();txt(String(r.i),cx+9,cy+7.5,5,col,'center');txt(r.days+' d',cx+48,cy+7,6.5,'#fff','right',SANS,800);txt(label,cx+6,cy+20,4.2,col);txt(r.replaced?'rolo trocado':'mantido',cx+6,cy+28,5,'#9a9aa2','left',SANS,500)});
 if(stats.score>=best)txt('RECORDE!',x+w-37,y+60,4.6,'#ffd23f','center');
 button('JOGAR DE NOVO',x+16,y+h-28,130,18,()=>startGame());
 button('ACESSAR O PAINEL →',x+w-166,y+h-28,150,18,enterPanel,true);
}
function enterPanel(){if(embedded)parent.postMessage({type:'rb1:enter'},'*');else location.href='/#painel'}

// ───────────────────────── Loop ─────────────────────────
let last=performance.now(),acc=0;
function loop(now){
 acc+=Math.min(100,now-last);last=now;
 while(acc>=1000/60){
  acc-=1000/60;
  if(state==='title'){if(take('act')||take('jump'))startGame()}
  else if(state==='play')updatePlay();
  else if(state==='inspect')updateInspect();
  else if(state==='crane')updateSwap();
  else if(state==='pause'){if(take('pause')||take('act'))state='play';if(take('restart'))startGame()}
  else if(state==='done'){if(take('restart'))startGame();if(take('act'))enterPanel()}
  if(state==='play'&&take('restart'))startGame();
  updateCommon();
 }
 renderWorld();
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,cvs.width,cvs.height);
 ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(buf,OX,OY,VW*S,VH*S);
 U();buttons=[];
 if(state==='title')titleUI();
 else{
  hud();prompt();board();toastsUI();
  if(state==='inspect')inspectUI();
  if(state==='pause')pauseUI();
  if(state==='done')doneUI();
 }
 requestAnimationFrame(loop);
}
// Read-only hook for automated checks.
window.__rb1={get state(){return state},get P(){return P},get rolls(){return rolls},get stats(){return stats}};
(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>requestAnimationFrame(loop));
})();
