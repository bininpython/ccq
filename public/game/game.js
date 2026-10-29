/* RB1 Roll · A Missão do Forno
 * Jogo de plataforma em pixel art (HTML5 Canvas + Web Audio, sem dependências).
 * O mundo é desenhado em 400×225 e ampliado sem suavização; textos e painéis são desenhados
 * na resolução da tela para ficarem nítidos. Personagens, gráficos e música são originais.
 * Tema central: segurança — EPI obrigatório, nunca ficar sob carga suspensa, valorização da vida. */
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
const keys={left:0,right:0,jump:0,down:0,act:0,exit:0};
const pressed={};
const take=k=>{const v=pressed[k];pressed[k]=0;return !!v};
const KEYMAP={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ArrowDown:'down',KeyS:'down',KeyE:'act',Enter:'act',KeyK:'act',KeyQ:'exit'};
function press(k){if(!keys[k])pressed[k]=1;keys[k]=1}
addEventListener('keydown',e=>{
 AU.init();
 const k=KEYMAP[e.code];
 if(k){press(k);e.preventDefault()}
 if(e.code==='KeyP'||e.code==='Escape')pressed.pause=1;
 if(e.code==='KeyM')toggleMute();
 if(e.code==='KeyC'||e.code==='Tab'){pressed.board=1;e.preventDefault()}
 if(e.code==='KeyR')pressed.restart=1;
});
addEventListener('keyup',e=>{const k=KEYMAP[e.code];if(k)keys[k]=0});
addEventListener('blur',()=>{for(const k in keys)keys[k]=0;if(state==='play'||state==='crane'){paused=state;state='pause'}});
let buttons=[];
cvs.addEventListener('pointerdown',e=>{
 AU.init();
 const r=cvs.getBoundingClientRect();
 const x=(e.clientX-r.left-OX)/S,y=(e.clientY-r.top-OY)/S;
 for(const bt of buttons)if(x>=bt.x&&x<=bt.x+bt.w&&y>=bt.y&&y<=bt.y+bt.h){bt.fn();return}
 if(state==='title')beginShift();
 else if(state==='brief'||state==='inspect')pressed.act=1;
});
const touch=document.getElementById('touch');
if('ontouchstart' in window||matchMedia('(pointer:coarse)').matches)touch.classList.add('on');
touch.querySelectorAll('button').forEach(bt=>{
 const k=bt.dataset.k;
 bt.addEventListener('pointerdown',e=>{e.preventDefault();AU.init();press(k);bt.classList.add('down')});
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
   case'clank':this.hiss(t,.12,.2,1800);this.tone(140,t,.15,'triangle',.25);break;
   case'steam':this.hiss(t,.6,.06,2500);break;
   case'bump':this.tone(180,t,.08,'square',.12,this.master,120);break;
   case'beep':this.tone(1760,t,.07,'square',.06);break;
   case'alarm':this.tone(880,t,.14,'square',.12);this.tone(660,t+.15,.14,'square',.12);break;
   case'motor':this.tone(70,t,.12,'sawtooth',.035);break;
   case'gear':seq([60,64,67,72],.05,'triangle',.2);break;
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
// Uniforme Aperam: camisa cinza de manga longa com friso laranja no bolso e crachá branco, calça escura e botina.
const PAL={Q:'#7a4a32',q:'#5a3424',O:'#f1511b',o:'#b33a0f',h:'#ff9466',H:'#2b1d16',S:'#e8b48f',s:'#c48b66',K:'#1b1a22',G:'#bfe9ff',C:'#d3d6de',c:'#9aa0ae',W:'#ffffff',L:'#d9a441',D:'#2f3442',d:'#1e2129',B:'#141418',b:'#2a2a30'};
function sprite(rows,pal=PAL){
 const h=rows.length,w=Math.max(...rows.map(r=>r.length));
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
 rows.forEach((r,y)=>[...r].forEach((ch,i)=>{if(ch!=='.'&&pal[ch]){x.fillStyle=pal[ch];x.fillRect(i,y,1,1)}}));
 return c;
}
function flip(c){const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const x=f.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(c,0,0);return f}
function flash(c){const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const x=f.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);return f}
const LEGS={
 idle:['...DDd.DDd..','...DDd.DDd..','...BBb.BBb..','..BBBb.BBBb.'],
 walkA:['..DDd...DDd.','.DDd.....DDd','.BBb.....BBb','BBBb.....BBb'],
 walkB:['....DDDd....','....DDDd....','....BBBb....','...BBBBb....'],
 jump:['..DDd..DDd..','.DDd....DDd.','.BBb....BBb.','............'],
};
// style 'a' = Rolando (cabelo curto), 'b' = Rafaela (cabelo longo). epi = capacete, óculos e luvas.
function heroRows(style,epi,legs){
 const long=style==='b',side=long?'H':'.';
 const top=epi?['....hhOO....','...hOOOOOo..','..oOOOOOOOo.','..oooooooOOO']
  :long?['....HHHH....','...HHHHHH...','..HHHHHHHH..','..HHHHHHHH..']:['............','....HHHH....','...HHHHHH...','..HHHHHHHH..'];
 const eye=epi?'SGGSGG':'SKSSKS',hand=epi?'L':'S';
 // Rafaela: ponytail falling behind the shoulders (visible with or without the helmet).
 return[...top,
  `..${side}SSSSSSS..`,
  `..${side}${eye}s..`,
  `..${side}SSSSSSs..`,
  long?'..HHSSsss...':'....SSsss...',
  long?'..HcCCCCCc..':'..cCCCCCCc..',
  `.${hand}cCWOOCCc${hand}.`,
  `.${hand}cCCCCCCc${hand}.`,
  '..dDDDDDDd..',
  ...legs].map((row,y)=>{if(!long)return row;const a=[...row];if(y>=3&&y<=8)a[1]='Q';if(y>=5&&y<=11)a[0]=y===11?'q':'Q';return a.join('')});
}
const HERO={};
for(const style of ['a','b'])for(const epi of [0,1])for(const [k,legs] of Object.entries(LEGS)){
 const c=sprite(heroRows(style,epi,legs));
 HERO[style+epi+k]={r:c,l:flip(c),fr:flash(c),fl:flash(flip(c))};
}
const CLIP=sprite(['...kKKk...','.bBkKKkBb.','.bWWWWWWb.','.bWLLLLWb.','.bWWWWWWb.','.bWLLLWWb.','.bWWWWWWb.','.bWLLRLWb.','.bWWWWWWb.','.bbbbbbbb.'],{B:'#8a5a2b',b:'#5e3b1a',K:'#c3c8d0',k:'#6b7280',W:'#f4f1e6',L:'#9aa6c8',R:'#e0473b'});
const HELMET=sprite(['...hOOO...','..hOOOOO..','.OOOOOOOO.','.OOOYYOOO.','oooooooooo'],{...PAL,Y:'#ffd23f'});
const NUT=sprite(['..YYYY..','.YYyyYY.','YYy..yYY','YYy..yYY','.YYyyYY.','..YYYY..'],{Y:'#ffd23f',y:'#c99512'});
const REMOTE=sprite(['.k....','.k....','KKKK..','KRGK..','KYYK..','KKKK..'],{K:'#24242c',k:'#9aa0ae',R:'#ef4444',G:'#22c55e',Y:'#facc15'});
const DIG={'0':['###','#.#','#.#','#.#','###'],'1':['.#.','##.','.#.','.#.','###'],'2':['###','..#','###','#..','###'],'3':['###','..#','.##','..#','###'],'4':['#.#','#.#','###','..#','..#']};
function digit(ch,x,y,color){b.fillStyle=color;DIG[ch].forEach((r,j)=>[...r].forEach((c,i)=>{if(c==='#')b.fillRect(x+i,y+j,1,1)}))}

// Rolls: shaded pixel discs, rendered once per variant; spokes are drawn live so they spin.
const ROLL_PAL={steel:['#2a2632','#57526a','#8f8aa0','#c9c5d6','#f3f1f8'],hot:['#3a130e','#8f2c12','#d9561b','#ff9b3d','#ffe2a2'],used:['#2a1a16','#5e3428','#8a5644','#b07a62','#d4a48a'],fresh:['#1d2a33','#476478','#86a7ba','#c6dde8','#f4fbff']};
function rollSprite(r,v){
 const p=ROLL_PAL[v],s=r*2+1,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');
 for(let j=0;j<s;j++)for(let i=0;i<s;i++){
  const dx=i-r,dy=j-r,d=Math.hypot(dx,dy);if(d>r+.4)continue;
  let col;
  if(d>r-1.1||d<2.2)col=p[0];
  else if(d<3.4)col=p[2];
  else{const k=(-dx-dy)/(2*r)+.5+(d>r-3?-.18:0);col=k>.86?p[4]:k>.62?p[3]:k>.36?p[2]:p[1]}
  x.fillStyle=col;x.fillRect(i,j,1,1);
 }
 return c;
}
const R=13,BIGR=26,ROLLS={},BIG={};
for(const v of Object.keys(ROLL_PAL)){ROLLS[v]=rollSprite(R,v);BIG[v]=rollSprite(BIGR,v)}
function drawRoll(g,cx,cy,variant,ang){
 g.drawImage(ROLLS[variant],Math.round(cx-R),Math.round(cy-R));
 g.fillStyle=ROLL_PAL[variant][0];
 for(let k=0;k<4;k++){const a=ang+k*Math.PI/2;for(let t=4;t<R-2;t++)g.fillRect(Math.round(cx+Math.cos(a)*t),Math.round(cy+Math.sin(a)*t),1,1)}
}

// ───────────────────────── World layout ─────────────────────────
const ROLL_X=[430,760,980,1200,1420],ROLL_Y=118,STRIP_Y=ROLL_Y-R-2;
const FURN={x:600,y:56,w:1120,h:FLOOR-56},WIN={x:616,y:82,w:1088,h:104};
const PILLARS=[870,1090,1310,1530];
const LOCKER={x:34,w:30},TABLE={x:92,w:58,y:168},GATE_X=394,REMOTE_POST=490,RACK={x:500,w:88},TERM={x:1752,w:48};
const RACK_SLOTS=[520,546],RACK_Y=135;
const CRADLE_SLOTS=[640,668],CRADLE_Y=FLOOR-R-1;
const PLATFORMS=[{x:150,y:160,w:52},{x:296,y:160,w:52},{x:842,y:160,w:56},{x:1062,y:160,w:56},{x:1282,y:160,w:56},{x:1502,y:160,w:56}];
const BLOCKS_AT=[[168,112],[314,112],[862,112],[1082,112],[1302,112],[1522,112]];
const VENTS=[870,1090,1310,1530];
const CHIMNEYS=[700,1000,1300,1600];
const COINS_AT=[[160,148],[176,148],[192,148],[306,148],[322,148],[338,148],[230,176],[242,176],[852,148],[870,148],[888,148],[1072,148],[1090,148],[1108,148],[1292,148],[1310,148],[1328,148],[1512,148],[1530,148],[1548,148],[1640,176],[1652,176],[1664,176]];
// Crane: hook depth is measured from the trolley; the load hangs below the hook block.
const HOOK_TOP=22,HOOK_MAX=140,CRANE_MIN=200,CRANE_MAX=1740;
const loadY=h=>HOOK_TOP+h+6+R;

// Static layers, drawn once.
const FAR_W=Math.ceil(VW+(WORLD-VW)*.45);
const far=document.createElement('canvas');far.width=FAR_W;far.height=VH;
const mid=document.createElement('canvas');mid.width=WORLD;mid.height=VH;
function rect(g,c,x,y,w,h){g.fillStyle=c;g.fillRect(x,y,w,h)}
function signTriangle(g,x,y){g.fillStyle='#1b1a22';g.beginPath();g.moveTo(x-1,y+13);g.lineTo(x+7,y-1);g.lineTo(x+15,y+13);g.fill();g.fillStyle='#f2c230';g.beginPath();g.moveTo(x+1,y+12);g.lineTo(x+7,y+1);g.lineTo(x+13,y+12);g.fill()}
function signCircle(g,x,y,color){g.fillStyle='#ffffff';g.beginPath();g.arc(x,y,8,0,Math.PI*2);g.fill();g.fillStyle=color;g.beginPath();g.arc(x,y,7,0,Math.PI*2);g.fill()}
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
 for(let x=0;x<FAR_W;x+=32)rect(g,'#141119',x,124,1,70);
})();
(function paintMid(){
 const g=mid.getContext('2d');
 // Crane runway rail.
 rect(g,'#2f2a3a',0,10,WORLD,5);rect(g,'#4a4258',0,10,WORLD,1);
 for(let x=40;x<WORLD;x+=220)rect(g,'#2a2534',x,0,6,12);
 for(let x=0;x<WORLD;x+=12)rect(g,'#f2c230',x,14,6,1);
 // EPI locker with the blue "mandatory" sign.
 rect(g,'#2b3a4d',LOCKER.x,124,LOCKER.w,FLOOR-124);rect(g,'#3b4f67',LOCKER.x,124,LOCKER.w,2);rect(g,'#1b2532',LOCKER.x+LOCKER.w/2,126,1,FLOOR-126);
 for(const dx of [6,22])rect(g,'#9aa0ae',LOCKER.x+dx,150,2,6);
 for(let y=130;y<146;y+=3){rect(g,'#1b2532',LOCKER.x+3,y,10,1);rect(g,'#1b2532',LOCKER.x+18,y,10,1)}
 signCircle(g,LOCKER.x+15,114,'#2563eb');rect(g,'#fff',LOCKER.x+11,112,8,3);rect(g,'#fff',LOCKER.x+10,115,10,1);
 // Workshop: pegboard with tools, table.
 rect(g,'#2c2636',72,118,92,44);rect(g,'#3a3246',74,120,88,40);
 for(let x=78;x<160;x+=6)for(let y=124;y<158;y+=6)rect(g,'#2c2636',x,y,1,1);
 rect(g,'#9aa0aa',80,126,3,18);rect(g,'#9aa0aa',77,126,9,3);
 rect(g,'#c33',94,128,10,4);rect(g,'#9aa0aa',98,132,2,12);
 rect(g,'#9aa0aa',114,124,2,22);rect(g,'#9aa0aa',110,144,10,3);
 rect(g,'#e6b422',128,128,14,10);rect(g,'#2c2636',131,131,8,4);
 rect(g,'#9aa0aa',148,126,8,2);rect(g,'#9aa0aa',151,126,2,16);
 rect(g,'#6b4a2e',TABLE.x,TABLE.y,TABLE.w,4);rect(g,'#8a6440',TABLE.x,TABLE.y,TABLE.w,1);
 rect(g,'#4a3220',TABLE.x+3,TABLE.y+4,3,FLOOR-TABLE.y-4);rect(g,'#4a3220',TABLE.x+TABLE.w-6,TABLE.y+4,3,FLOOR-TABLE.y-4);
 // Safety gate (EPI obligatory beyond this point).
 for(const x of [GATE_X-2,GATE_X+10]){rect(g,'#f2c230',x,148,3,FLOOR-148);for(let y=150;y<FLOOR;y+=8)rect(g,'#1b1a22',x,y,3,4)}
 signCircle(g,GATE_X+5,134,'#2563eb');rect(g,'#fff',GATE_X+1,132,8,3);rect(g,'#fff',GATE_X,135,10,1);
 // Warning signs: suspended load near the rack, general danger at the furnace entry.
 signTriangle(g,RACK.x+36,100);rect(g,'#1b1a22',RACK.x+42,104,2,2);rect(g,'#1b1a22',RACK.x+40,106,6,4);
 signTriangle(g,590,128);rect(g,'#1b1a22',596,132,2,5);rect(g,'#1b1a22',596,138,2,1);
 // Remote control post.
 rect(g,'#57526a',REMOTE_POST-1,140,3,FLOOR-140);rect(g,'#2a2534',REMOTE_POST-4,FLOOR-3,9,3);rect(g,'#f2c230',REMOTE_POST-4,138,9,3);
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
 rect(g,'#6e3d2b',WIN.x-6,WIN.y-6,WIN.w+12,WIN.h+12);
 for(let y=WIN.y-6;y<WIN.y+WIN.h+6;y+=4)for(let x=WIN.x-6+((y/4)%2?0:4);x<WIN.x+WIN.w+6;x+=8){rect(g,'#552c1f',x,y,1,4);rect(g,'#552c1f',x,y,8,1)}
 rect(g,'#110b0d',WIN.x,WIN.y,WIN.w,WIN.h);
 rect(g,'#0a0708',FURN.x-1,STRIP_Y-3,18,7);rect(g,'#0a0708',FURN.x+FURN.w-17,STRIP_Y-3,18,7);
 // Hot-surface signs on the casing.
 for(const x of [740,1180,1640]){signTriangle(g,x,60);rect(g,'#1b1a22',x+5,65,1,4);rect(g,'#1b1a22',x+7,64,1,5);rect(g,'#1b1a22',x+9,65,1,4)}
 // Platforms (steel catwalks).
 for(const p of PLATFORMS){rect(g,'#57526a',p.x,p.y,p.w,4);rect(g,'#8c86a0',p.x,p.y,p.w,1);for(let x=p.x+2;x<p.x+p.w;x+=4)rect(g,'#2a2534',x,p.y+2,2,1);rect(g,'#3b3546',p.x+3,p.y+4,2,FLOOR-p.y-4);rect(g,'#3b3546',p.x+p.w-5,p.y+4,2,FLOOR-p.y-4)}
 // Cooling cradle for used rolls.
 for(const x of CRADLE_SLOTS){rect(g,'#3b3546',x-13,FLOOR-5,26,5);rect(g,'#57526a',x-13,FLOOR-5,26,1);rect(g,'#3b3546',x-12,FLOOR-11,3,6);rect(g,'#3b3546',x+9,FLOOR-11,3,6)}
 // Terminal (control station).
 rect(g,'#24212c',TERM.x,128,TERM.w,FLOOR-128);rect(g,'#37324a',TERM.x,128,TERM.w,2);rect(g,'#37324a',TERM.x,128,2,FLOOR-128);
 rect(g,'#07120d',TERM.x+6,135,TERM.w-12,26);rect(g,'#3a3446',TERM.x+5,166,TERM.w-10,6);
 for(let x=TERM.x+7;x<TERM.x+TERM.w-7;x+=4)rect(g,'#5f5674',x,167,2,2);
 rect(g,'#f1511b',TERM.x+6,178,6,3);rect(g,'#16a34a',TERM.x+15,178,6,3);rect(g,'#7c3aed',TERM.x+24,178,6,3);
 // Floor: diamond plate, safety edge and the green pedestrian walkway.
 rect(g,'#24212c',0,FLOOR,WORLD,VH-FLOOR);
 for(let y=FLOOR+4;y<VH;y+=4)for(let x=((y/4)%2)*4;x<WORLD;x+=8)rect(g,'#34303f',x,y,2,1);
 for(let x=0;x<WORLD;x++)rect(g,((x>>2)%2)?'#f2c230':'#1b1a22',x,FLOOR,1,2);
 for(const v of VENTS){rect(g,'#121016',v-10,FLOOR,20,3);for(let x=v-9;x<v+10;x+=3)rect(g,'#3a3446',x,FLOOR,1,3)}
 for(let x=0;x<WORLD;x+=10)rect(g,'#16a34a',x,FLOOR+7,6,1);
})();

// ───────────────────────── Game state ─────────────────────────
const TIPS=['Use sempre o EPI completo: capacete, óculos, luvas e botina.','Nunca fique sob carga suspensa. Mantenha distância da rota da ponte.','Respeite o isolamento das áreas quentes do forno.','Viu uma condição insegura? Pare e comunique. Você tem o direito de recusa.','Sua família espera você em casa. Trabalhe com segurança.','Antes de operar a ponte, confira o gancho, a trava e as cintas.','Caminhe pela faixa verde de pedestres sempre que possível.'];
let state='title',paused='play',frame=0,camX=0,shake=0,best=store.get('rb1game.best',0),hero=store.get('rb1game.hero','a');
if(hero!=='a'&&hero!=='b')hero='a';
let P,rolls,blocks,coins,items,parts,embers,toasts,log,crane,stats,inspect,boardOpen,boardTimer,doneData,emberTimer,cradle,tipTimer,tipIndex,danger;
const SHIFT=()=>{const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return h>=23||h<7?'TN':h<15?'TM':'TT'};
const nowHM=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date());
const statusOf=d=>d<=5?'green':d<=10?'yellow':'red';
const STATUS={green:['EM DIA','#22c55e'],yellow:['ATENÇÃO','#facc15'],red:['PRIORIDADE','#ef4444']};
const fmt=v=>v.toLocaleString('pt-BR');
const heroName=()=>hero==='b'?'Rafaela':'Rolando';
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}

function reset(){
 // Exactly two rolls start in priority, so the cooling cradle (two slots) always has room.
 const days=shuffle([12+Math.random()*10|0,15+Math.random()*12|0,6+Math.random()*4|0,Math.random()*5|0,1+Math.random()*4|0]);
 rolls=ROLL_X.map((x,i)=>({x,i,days:days[i],diam:780+(Math.random()*90|0),inspected:false,status:statusOf(days[i]),removed:false,replaced:false,ang:Math.random()*6,variant:i?'hot':'steel'}));
 P={x:12,y:FLOOR-15,w:10,h:15,vx:0,vy:0,face:1,ground:true,coyote:0,jumpBuf:0,anim:0,board:false,epi:false,remote:false,inv:0,hearts:3,lastSafe:12,gateMsg:0};
 blocks=BLOCKS_AT.map(([x,y],i)=>({x,y,used:false,bump:0,kind:i%2?'helmet':'coins'}));
 coins=COINS_AT.map(([x,y])=>({x,y,got:false,t:Math.random()*6}));
 items=[];parts=[];embers=[];toasts=[];log=[];cradle=[undefined,undefined];
 crane={x:300,vx:0,hook:0,load:null,swing:0,target:300,moving:false};
 stats={score:0,time:0,coins:0,epi:0,inspections:0,precise:0,swaps:0,hits:0,violations:0,aligned:0};
 inspect=null;boardOpen=false;boardTimer=0;doneData=null;emberTimer=120;tipTimer=900;tipIndex=0;danger=0;
 for(const k in pressed)pressed[k]=0;
}
const ventPhase=i=>(frame+i*67)%260;
reset();

function toast(text,color='#fff',t=170){toasts.push({text,color,t,max:t});if(toasts.length>3)toasts.shift()}
function burst(x,y,colors,n=12,speed=1.6,grav=.08,life=40){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=Math.random()*speed;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,g:grav,life:life*(.6+Math.random()*.6),max:life,c:colors[i%colors.length],s:Math.random()<.3?2:1})}}
function addScore(v,x,y){stats.score=Math.max(0,stats.score+v);if(x!==undefined)parts.push({x,y,vx:0,vy:-.5,g:0,life:50,max:50,text:(v>0?'+':'')+v,c:v>0?'#ffd23f':'#ef4444'})}
function writeLog(title,line,color){log.push({title,line,color,shown:0});boardTimer=260;AU.sfx('write')}

function beginShift(){reset();state='brief';AU.init();AU.sfx('select')}
function startPlay(){state='play';AU.startMusic();toast('Vista o EPI no armário antes de entrar na área','#60a5fa',260)}

// ───────────────────────── Objective & interactions ─────────────────────────
const pending=()=>rolls.find(r=>r.inspected&&r.status==='red'&&!r.replaced);
function objective(){
 const ins=rolls.filter(r=>r.inspected).length,p=pending(),empty=rolls.find(r=>r.removed);
 if(!P.epi)return'Vista o EPI completo no armário';
 if(!P.board)return'Pegue a prancheta na bancada';
 if(p){
  if(!P.remote)return'Pegue o controle remoto da ponte rolante';
  if(state!=='crane')return'Opere a ponte rolante (E) · fique fora da rota da carga';
  if(crane.load?.kind==='old')return'Pouse o rolo usado no berço de resfriamento';
  if(crane.load?.kind==='new')return empty?`Instale o rolo novo na posição ${empty.i}`:'Remova o rolo usado antes ou devolva o novo ao estoque';
  if(empty)return'Pegue um rolo novo no estoque com a ponte';
  return`Remova o rolo usado da posição ${p.i} com a ponte`;
 }
 if(ins<5)return`Inspecione os rolos sob o forno (${ins}/5)`;
 return'Registre os dados no terminal RB1 Roll →';
}
function nearby(){
 const cx=P.x+P.w/2;
 if(!P.epi&&cx>LOCKER.x-6&&cx<LOCKER.x+LOCKER.w+6)return{label:'Vestir EPI',fn:()=>{P.epi=true;stats.epi++;AU.sfx('gear');burst(P.x+5,P.y+4,['#f1511b','#bfe9ff','#d9a441'],16,1.4);toast('EPI completo: capacete, óculos, luvas e botina. Agora sim!','#60a5fa',220)}};
 if(!P.board&&Math.abs(cx-(TABLE.x+24))<20)return{label:'Pegar prancheta',fn:()=>{P.board=true;AU.sfx('power');toast('Prancheta na mão! Inspecione os 5 rolos.','#ffd23f');writeLog(`TURNO ${SHIFT()} · ${heroName().toUpperCase()}`,`Início da ronda · ${nowHM()} · EPI ok`,'#7c3aed')}};
 if(!P.remote&&P.board&&Math.abs(cx-REMOTE_POST)<12)return{label:'Pegar controle remoto',fn:()=>{if(!pending()){toast('A ponte só é usada quando houver rolo em prioridade.','#e4e4e7');AU.sfx('bad');return}P.remote=true;AU.sfx('power');toast('Controle remoto da ponte na mão. Confira o gancho e a trava!','#facc15',220)}};
 for(const r of rolls){
  if(Math.abs(cx-r.x)>16)continue;
  if(!P.board)return{label:'Precisa da prancheta',fn:()=>{toast('Pegue a prancheta na bancada primeiro','#ffd23f');AU.sfx('bad')}};
  if(r.removed)return P.remote?{label:'Operar ponte rolante',fn:enterCrane}:{label:'Posição vazia',fn:()=>{toast('Instale um rolo novo com a ponte rolante','#86a7ba');AU.sfx('select')}};
  if(!r.inspected)return{label:'Inspecionar rolo '+r.i,fn:()=>openInspect(r)};
  if(r.status==='red'&&!r.replaced&&P.remote)return{label:'Operar ponte rolante',fn:enterCrane};
  if(r.status==='red'&&!r.replaced)return{label:'Rolo em prioridade',fn:()=>{toast('Pegue o controle remoto da ponte, ao lado do estoque','#ef4444');AU.sfx('bad')}};
  return{label:`Rolo ${r.i} · ${r.days} dias`,fn:()=>{toast(`Rolo ${r.i}: ${STATUS[r.status][0].toLowerCase()} · ${r.days} dias`,STATUS[r.status][1]);AU.sfx('select')}};
 }
 if(cx>TERM.x-6){
  const done=rolls.every(r=>r.inspected&&(r.status!=='red'||r.replaced));
  return{label:done?'Registrar no RB1 Roll':'Terminal RB1 Roll',fn:()=>{if(!done){toast('Conclua as inspeções e as trocas antes','#e4e4e7');AU.sfx('bad');return}finish()}};
 }
 if(P.remote&&pending())return{label:'Operar ponte rolante',fn:enterCrane};
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
   addScore({precise:150,ok:80,poor:30}[s.quality]);
   stats.inspections++;if(s.quality==='precise')stats.precise++;
   AU.sfx(s.quality==='precise'?'good':s.quality==='ok'?'ok':'bad');
  }
 }else if(s.t>120||(s.t>30&&(take('act')||take('jump')))){
  const r=s.r;r.inspected=true;
  const [label,color]=STATUS[r.status];
  writeLog(`POS ${r.i} · ${r.days} DIAS`,`${label} · Ø ${r.diam} · P ${fmt(Math.round(Math.PI*r.diam))} mm`,color);
  toast(r.status==='red'?`Rolo ${r.i} precisa de troca! Use a ponte rolante.`:`Rolo ${r.i} registrado: ${label.toLowerCase()}`,color,200);
  inspect=null;state='play';
 }
}

// ───────────────────────── Remote-controlled overhead crane ─────────────────────────
function enterCrane(){
 state='crane';P.vx=0;AU.sfx('beep');for(const k of ['jump','down','act','exit'])pressed[k]=0;
 toast('Ponte ativa · ← → move · ↑ ↓ gancho · E engata/solta · Q sai','#facc15',240);
}
function craneTargets(){
 const L=crane.load;
 if(!L)return[...rolls.filter(r=>!r.removed&&r.inspected&&r.status==='red'&&!r.replaced).map(r=>({x:r.x,y:ROLL_Y,kind:'pickOld',r})),...RACK_SLOTS.map(x=>({x,y:RACK_Y,kind:'pickNew'}))];
 if(L.kind==='old')return CRADLE_SLOTS.map((x,slot)=>({x,y:CRADLE_Y,kind:'dropOld',slot})).filter(t=>cradle[t.slot]===undefined);
 return[...rolls.filter(r=>r.removed).map(r=>({x:r.x,y:ROLL_Y,kind:'dropNew',r})),...RACK_SLOTS.map(x=>({x,y:RACK_Y,kind:'returnNew'}))];
}
function nearestTarget(){
 let best=null,bd=1e9;
 for(const t of craneTargets()){const d=Math.abs(t.x-crane.x)+Math.abs(t.y-loadY(crane.hook))*.5;if(d<bd){bd=d;best=t}}
 return best;
}
function updateCrane(){
 stats.time++;
 if(take('pause')){paused='crane';state='pause';return}
 if(take('board'))boardOpen=!boardOpen;
 // Trolley travel with inertia; the load swings when the trolley accelerates or brakes.
 const acc=keys.left?-.1:keys.right?.1:0,prev=crane.vx;
 crane.vx=Math.max(-2.2,Math.min(2.2,crane.vx+acc));if(!acc)crane.vx*=.9;if(Math.abs(crane.vx)<.03)crane.vx=0;
 crane.x=Math.max(CRANE_MIN,Math.min(CRANE_MAX,crane.x+crane.vx));
 crane.swing=(crane.swing+(prev-crane.vx)*.12)*.93;
 const hoist=keys.jump?-1.4:keys.down?1.4:0;
 crane.hook=Math.max(0,Math.min(HOOK_MAX,crane.hook+hoist));
 crane.moving=Math.abs(crane.vx)>.05||hoist!==0;
 if(crane.moving&&frame%10===0)AU.sfx('motor');
 if(crane.moving&&crane.load&&frame%40===0)AU.sfx('beep');
 crane.target=crane.x;
 take('jump');take('down');
 // Golden rule: never stand under a suspended load.
 const under=crane.load&&Math.abs(crane.x+crane.swing*10-(P.x+P.w/2))<15;
 if(under){
  danger++;
  if(danger===1){AU.sfx('alarm');toast('PERIGO: nunca fique sob carga suspensa!','#ef4444',180)}
  if(danger%30===0)AU.sfx('alarm');
  if(danger===75){stats.violations++;addScore(-150,P.x+5,P.y-10);toast('Infração de segurança registrada. Afaste a carga do operador.','#ef4444',220)}
 }else danger=0;
 if(take('act'))craneAction();
 if(take('exit')){
  if(crane.load){toast('Nunca abandone carga suspensa: pouse a carga antes de sair.','#ef4444');AU.sfx('bad')}
  else{state='play';danger=0;AU.sfx('select')}
 }
}
function craneAction(){
 const t=nearestTarget(),ly=loadY(crane.hook);
 const ok=t&&Math.abs(t.x-crane.x)<=5&&Math.abs(t.y-ly)<=5;
 if(!ok){
  if(crane.load)toast('Pouse a carga só sobre o local correto: alinhe e abaixe devagar.','#facc15');
  else{
   const r=rolls.find(r=>Math.abs(r.x-crane.x)<=6&&Math.abs(ROLL_Y-ly)<=6&&!r.removed);
   if(r&&!r.inspected)toast('Inspecione o rolo antes de qualquer intervenção.','#facc15');
   else if(r&&(r.status!=='red'||r.replaced))toast('Este rolo está em condição de uso. Não remova.','#22c55e');
   else toast('Alinhe o gancho sobre a carga e abaixe até engatar.','#facc15');
  }
  AU.sfx('bad');return;
 }
 if(Math.abs(t.x-crane.x)+Math.abs(t.y-ly)<=2){stats.aligned++;addScore(50,crane.x,ly-20)}
 AU.sfx('clank');shake=3;crane.swing*=.3;
 if(t.kind==='pickOld'){t.r.removed=true;crane.load={kind:'old',variant:'used',r:t.r};burst(t.r.x,ROLL_Y,['#ff9b3d','#ffe2a2'],14,1.6);toast(`Rolo usado da posição ${t.r.i} engatado. Leve ao berço de resfriamento.`,'#ff9b3d')}
 else if(t.kind==='pickNew'){crane.load={kind:'new',variant:'fresh'};toast('Rolo novo engatado. Instale na posição vazia.','#86a7ba')}
 else if(t.kind==='returnNew'){crane.load=null;toast('Rolo novo devolvido ao estoque.','#86a7ba')}
 else if(t.kind==='dropOld'){const r=crane.load.r;cradle[t.slot]=r.i;crane.load=null;burst(t.x,CRADLE_Y,['#9aa0ae','#d4a48a'],10,1.2);writeLog(`ROLO USADO · POS ${r.i}`,'Retirado para o berço de resfriamento','#ff9b3d');toast('Rolo usado no berço. Agora pegue um rolo novo no estoque.','#ff9b3d')}
 else if(t.kind==='dropNew'){
  const r=t.r;crane.load=null;r.removed=false;r.variant='fresh';r.days=0;r.status='green';r.replaced=true;
  stats.swaps++;addScore(300,r.x,ROLL_Y-30);AU.sfx('power');shake=5;
  burst(r.x,ROLL_Y,['#ffffff','#86e1ff','#ffd23f'],24,2.2,.05,50);
  writeLog(`TROCA · POS ${r.i}`,`Turno ${SHIFT()} · ${nowHM()} · Ø ${r.diam} mm`,'#86e1ff');
  toast(`Troca do rolo ${r.i} concluída com segurança!`,'#22c55e',200);
  if(!pending()){P.remote=false;state='play';danger=0;toast('Ponte estacionada e controle devolvido. Bom trabalho!','#22c55e',200)}
 }
}

function finish(){
 const secs=Math.floor(stats.time/60),bonus=Math.max(0,3000-secs*10);
 addScore(bonus);
 const safety=Math.max(0,100-stats.hits*10-stats.violations*25);
 let rank=stats.score>=5600?'S':stats.score>=4500?'A':stats.score>=3200?'B':'C';
 if(safety<70&&(rank==='S'||rank==='A'))rank='B';
 doneData={secs,bonus,rank,safety};
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
 if(P.hearts<=0){P.hearts=3;addScore(-100);P.x=P.lastSafe;P.y=FLOOR-P.h;P.vx=0;P.vy=0;toast('Acidente evitado por pouco! Sua vida vale mais que qualquer produção.','#ef4444',260)}
 else toast('Cuidado! O EPI te protegeu. Desvie das fagulhas e do vapor.','#ef4444');
}
function overlap(a,bx,by,bw,bh){return a.x<bx+bw&&a.x+a.w>bx&&a.y<by+bh&&a.y+a.h>by}
function physics(control){
 const max=1.75,acc=P.ground?.32:.22;
 if(control&&keys.left){P.vx=Math.max(-max,P.vx-acc);P.face=-1}
 else if(control&&keys.right){P.vx=Math.min(max,P.vx+acc);P.face=1}
 else P.vx*=P.ground?.72:.92;
 if(Math.abs(P.vx)<.05)P.vx=0;
 if(control&&take('jump'))P.jumpBuf=7;
 if(P.jumpBuf>0)P.jumpBuf--;
 if(P.ground)P.coyote=6;else if(P.coyote>0)P.coyote--;
 if(control&&P.jumpBuf&&P.coyote){P.vy=-4.75;P.jumpBuf=0;P.coyote=0;P.ground=false;AU.sfx('jump')}
 P.vy+=.24;if(!(control&&keys.jump)&&P.vy<-1.4)P.vy+=.3;if(P.vy>5)P.vy=5;
 P.x+=P.vx;
 for(const k of blocks){if(overlap(P,k.x,k.y,16,16)){if(P.vx>0)P.x=k.x-P.w;else if(P.vx<0)P.x=k.x+16;P.vx=0}}
 // Safety gate: no entry to the furnace area without EPI.
 if(!P.epi&&P.x+P.w>GATE_X-3){P.x=GATE_X-3-P.w;P.vx=0;if(!P.gateMsg){P.gateMsg=150;AU.sfx('bad');toast('Área de risco: uso obrigatório de EPI. Vista-o no armário.','#60a5fa',200)}}
 if(P.gateMsg>0)P.gateMsg--;
 P.x=Math.max(0,Math.min(WORLD-P.w,P.x));
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
}
function updatePlay(){
 stats.time++;
 if(take('pause')){paused='play';state='pause';return}
 if(take('board'))boardOpen=!boardOpen;
 take('exit');take('down');
 physics(true);
 const near=nearby();
 if(take('act')&&near)near.fn();
 for(const c of coins){c.t+=.08;if(!c.got&&overlap(P,c.x-4,c.y-3,8,8)){c.got=true;stats.coins++;addScore(10);AU.sfx('coin');burst(c.x,c.y,['#ffd23f','#fff'],6,1)}}
 for(const it of items){
  it.t++;if(it.t<18)it.y-=.9;
  if(!it.got&&it.t>8&&overlap(P,it.x-5,it.y-3,10,6)){
   it.got=true;if(P.hearts<3)P.hearts++;stats.epi++;addScore(100,it.x,it.y);AU.sfx('power');toast('Capacete reserva: +1 proteção. EPI salva vidas!','#f1511b');
  }
 }
 items=items.filter(it=>!it.got);
 if(P.epi&&--tipTimer<=0){tipTimer=1500;toast('Dica de segurança: '+TIPS[tipIndex++%TIPS.length],'#60a5fa',300)}
}
function updateHazards(){
 if(--emberTimer<=0){emberTimer=55+Math.random()*50|0;const x=FURN.x+30+Math.random()*(FURN.w-60);embers.push({x,y:FURN.y+18,vx:(Math.random()-.5)*.3,vy:0,warn:45})}
 for(const e of embers){
  if(e.warn>0){e.warn--;continue}
  e.vy=Math.min(2.4,e.vy+.06);e.x+=e.vx;e.y+=e.vy;
  if(Math.random()<.4)parts.push({x:e.x,y:e.y,vx:0,vy:-.2,g:0,life:12,max:12,c:'#ff9b3d',s:1});
  if(overlap(P,e.x-2,e.y-2,4,4)){hurt(e.x);e.dead=true}
  if(e.y>FLOOR-2){e.dead=true;burst(e.x,FLOOR-1,['#ff9b3d','#ffe2a2'],5,1,.1,18)}
 }
 embers=embers.filter(e=>!e.dead);
 VENTS.forEach((v,i)=>{
  const ph=ventPhase(i);
  if(ph===180&&Math.abs(v-camX-VW/2)<VW)AU.sfx('steam');
  if(ph>=180&&ph<250&&overlap(P,v-7,FLOOR-48,14,48))hurt(v);
 });
}
function hitBlock(k){
 AU.sfx('bump');k.bump=8;
 if(k.used)return;k.used=true;
 if(k.kind==='helmet')items.push({x:k.x+8,y:k.y-2,t:0});
 else{for(let i=0;i<3;i++)setTimeout(()=>{stats.coins++;addScore(10,k.x+8,k.y-10-i*6);AU.sfx('coin')},i*90);burst(k.x+8,k.y,['#ffd23f'],8,1.4)}
}
function updateCommon(){
 frame++;
 if(state!=='crane'){crane.x+=(crane.target-crane.x)*.02;crane.swing*=.95;if(state==='play'&&frame%400===0&&!crane.load&&!P.remote)crane.target=CRANE_MIN+Math.random()*(CRANE_MAX-CRANE_MIN)}
 for(const r of rolls)if(!r.removed)r.ang+=.045;
 for(const p of parts){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.life--}
 parts=parts.filter(p=>p.life>0);
 for(const t of toasts)t.t--;toasts=toasts.filter(t=>t.t>0);
 if(boardTimer>0)boardTimer--;
 for(const l of log)if(l.shown<200)l.shown+=1.2;
 for(const k of blocks)if(k.bump>0)k.bump--;
 if(shake>0)shake*=.85;if(shake<.3)shake=0;
 if(frame%9===0)for(const x of CHIMNEYS)parts.push({x:x+(Math.random()-.5)*6,y:18,vx:.15+Math.random()*.15,vy:-.25,g:0,life:90,max:90,c:'#5a5468',s:2,smoke:true});
 let target;
 if(state==='title'||state==='brief')target=600+Math.sin(frame/260)*420;
 else if(state==='crane')target=crane.x-VW/2;
 else target=P.x+P.w/2-VW/2+P.face*24;
 target=Math.max(0,Math.min(WORLD-VW,target));
 camX+=(target-camX)*(state==='title'||state==='brief'?.03:.12);
}

// ───────────────────────── World render (pixel layer) ─────────────────────────
function renderWorld(){
 const cx=Math.round(camX+(shake?(Math.random()-.5)*shake:0)),cy=shake?Math.round((Math.random()-.5)*shake*.6):0;
 b.setTransform(1,0,0,1,0,0);
 b.drawImage(far,Math.round(-cx*.45),0);
 b.setTransform(1,0,0,1,-cx,cy);
 b.drawImage(mid,cx-4,0,VW+8,VH,cx-4,0,VW+8,VH);
 // Furnace interior: glow and pixel flames, clipped to the window.
 const g=b.createLinearGradient(0,WIN.y,0,WIN.y+WIN.h);g.addColorStop(0,'#160c0c');g.addColorStop(.55,'#3a140d');g.addColorStop(1,'#a8380f');
 const t=frame/60,fy=WIN.y+WIN.h;
 b.save();b.beginPath();b.rect(WIN.x,WIN.y,WIN.w,WIN.h);b.clip();
 b.fillStyle=g;b.fillRect(WIN.x,WIN.y,WIN.w,WIN.h);
 for(let x=WIN.x;x<WIN.x+WIN.w;x+=2){
  if(x<cx-4||x>cx+VW+4)continue;
  const base=(x-WIN.x)%24,dist=Math.min(base,24-base);
  const n=Math.sin(x*.09+t*3.1)*.5+Math.sin(x*.023-t*1.7)*.35+Math.sin(x*.21+t*7)*.15;
  const hgt=Math.max(3,26+n*8-dist*1.4);
  for(let y=0;y<hgt;y+=2){const k=y/hgt;if(k>.8&&((x*7+y*3+frame)>>2)%3===0)continue;b.fillStyle=k<.2?'#fff4c2':k<.42?'#ffc94a':k<.7?'#ff8a2a':'#d9461b';b.fillRect(x,fy-y-6,2,2)}
 }
 for(let x=WIN.x+12;x<WIN.x+WIN.w;x+=24){if(PILLARS.some(p=>Math.abs(p-x)<8))continue;rect(b,'#3a3348',x-4,fy-4,8,4);rect(b,'#ffe2a2',x-2,fy-5,4,1)}
 for(const x of PILLARS){rect(b,'#2e2938',x-4,WIN.y,8,WIN.h);rect(b,'#433b52',x-4,WIN.y,1,WIN.h);rect(b,'#1d1925',x+3,WIN.y,1,WIN.h)}
 b.restore();
 // Rack stock (always replenished), remote on its post, clipboard on the table.
 for(const [x,y] of [[RACK_SLOTS[0],RACK_Y],[RACK_SLOTS[1],RACK_Y],[RACK.x+33,171]])drawRoll(b,x,y,'fresh',0);
 if(!P.remote&&state!=='crane'){b.drawImage(REMOTE,REMOTE_POST-3,130);if(pending()&&P.board&&(frame>>4)%2)rect(b,'#ffd23f',REMOTE_POST,124,2,2)}
 if(!P.board){b.drawImage(CLIP,TABLE.x+20,TABLE.y-10);if(P.epi&&(frame>>4)%2)rect(b,'#ffd23f',TABLE.x+24,TABLE.y-16,2,2)}
 if(!P.epi&&state!=='title'&&state!=='brief'&&(frame>>4)%2)rect(b,'#60a5fa',LOCKER.x+14,102,2,2);
 cradle.forEach((ri,i)=>{if(ri!==undefined)drawRoll(b,CRADLE_SLOTS[i],CRADLE_Y,'used',0)});
 // Strip over the rolls (moving marks).
 rect(b,'#dcdae4',380,STRIP_Y,1380,2);rect(b,'#8f8aa0',380,STRIP_Y+2,1380,1);
 for(let x=380+((frame*1.2)%16);x<1760;x+=16)rect(b,'#6b6680',Math.floor(x),STRIP_Y,3,1);
 // Rolls, plates and status LEDs.
 for(const r of rolls){
  if(!r.removed)drawRoll(b,r.x,ROLL_Y,r.variant,r.ang);
  else if((frame>>3)%2){b.strokeStyle='#86e1ff';b.setLineDash([2,2]);b.strokeRect(r.x-R+.5,ROLL_Y-R+.5,R*2,R*2);b.setLineDash([])}
  const px=r.x-8,py=ROLL_Y+R+5;
  rect(b,'#1b1a22',px,py,16,9);rect(b,'#3a3446',px,py,16,1);
  digit(String(r.i),px+3,py+2,'#e4e4e7');
  const led=r.removed?'#86e1ff':r.inspected?STATUS[r.status][1]:((frame>>4)%2?'#6b6680':'#3a3446');
  rect(b,led,px+10,py+3,3,3);if(r.inspected){b.globalAlpha=.35;rect(b,led,px+9,py+2,5,5);b.globalAlpha=1}
 }
 // Terminal screen (live chart).
 for(let i=0;i<9;i++){const h=4+((Math.sin(frame/30+i)*.5+.5)*14|0);rect(b,i%3===2?'#f1511b':'#22c55e',TERM.x+9+i*4,159-h,2,h)}
 if(rolls.every(r=>r.inspected&&(r.status!=='red'||r.replaced))&&(frame>>4)%2)rect(b,'#ffd23f',TERM.x+TERM.w/2-1,120,3,3);
 // Exclusion zone under a suspended load.
 const cxr=Math.round(crane.x),sw=Math.round(crane.swing*10),hx=cxr+sw,hy=HOOK_TOP+Math.round(crane.hook);
 if(crane.load){const ly=loadY(crane.hook);b.globalAlpha=.3+.15*Math.sin(frame/5);for(let x=hx-15;x<hx+15;x+=4)rect(b,'#ef4444',x,FLOOR-1,2,2);b.globalAlpha=.08;rect(b,'#ef4444',hx-15,ly+R,30,Math.max(0,FLOOR-ly-R));b.globalAlpha=1}
 // Crane trolley, beacon, cable, hook block and slings.
 rect(b,'#4a4258',cxr-14,6,28,12);rect(b,'#f2c230',cxr-14,6,28,2);for(let x=cxr-14;x<cxr+14;x+=6)rect(b,'#1b1a22',x,6,3,2);
 rect(b,'#2a2534',cxr-12,17,5,2);rect(b,'#2a2534',cxr+7,17,5,2);
 const lit=(crane.moving||state==='crane')&&(frame>>3)%2;
 rect(b,lit?'#facc15':'#6b5a1a',cxr-2,3,4,3);if(lit){b.globalAlpha=.25;rect(b,'#facc15',cxr-5,1,10,7);b.globalAlpha=1}
 b.strokeStyle='#9a96a8';b.lineWidth=1;b.beginPath();b.moveTo(cxr+.5,18);b.lineTo(hx+.5,hy);b.stroke();
 rect(b,'#f2c230',hx-4,hy,9,4);rect(b,'#1b1a22',hx-4,hy+1,3,1);rect(b,'#c9c5d6',hx-1,hy+4,3,3);rect(b,'#c9c5d6',hx+1,hy+6,2,1);
 if(crane.load){const ly=loadY(crane.hook);b.strokeStyle='#f2c230';b.beginPath();b.moveTo(hx,hy+6);b.lineTo(hx-9,ly-6);b.moveTo(hx+1,hy+6);b.lineTo(hx+10,ly-6);b.stroke();drawRoll(b,hx,ly,crane.load.variant,frame*.01)}
 // Alignment guide while operating.
 if(state==='crane'){const tg=nearestTarget();if(tg&&(frame>>3)%2){const ok=Math.abs(tg.x-crane.x)<=5&&Math.abs(tg.y-loadY(crane.hook))<=5;b.strokeStyle=ok?'#22c55e':'#facc15';b.setLineDash([2,2]);b.strokeRect(tg.x-R-2.5,tg.y-R-2.5,R*2+5,R*2+5);b.setLineDash([])}}
 // Blocks.
 for(const k of blocks){
  const y=k.y-(k.bump>0?Math.sin(k.bump/8*Math.PI)*4:0)|0;
  if(k.used){rect(b,'#3a3446',k.x,y,16,16);rect(b,'#57526a',k.x+1,y+1,14,14);for(const [i,j] of [[3,3],[11,3],[3,11],[11,11]])rect(b,'#3a3446',k.x+i,y+j,2,2)}
  else{
   rect(b,'#7a2a0c',k.x,y,16,16);rect(b,'#f1511b',k.x+1,y+1,14,14);rect(b,'#ff9466',k.x+1,y+1,14,1);rect(b,'#ff9466',k.x+1,y+1,1,14);rect(b,'#b33a0f',k.x+1,y+14,14,1);
   for(const [i,j] of [[3,3],[12,3],[3,12],[12,12]])rect(b,'#7a2a0c',k.x+i,y+j,1,1);
   const sh=(frame>>3)%8<4?'#ffffff':'#ffe2a2';
   [[6,4],[7,4],[8,4],[5,5],[9,5],[9,6],[7,7],[8,7],[7,8],[7,10]].forEach(([i,j])=>rect(b,sh,k.x+i,y+j,1,1));
  }
 }
 for(const c of coins){if(c.got)continue;const w=Math.max(1,Math.round(8*Math.abs(Math.cos(c.t))));b.drawImage(NUT,0,0,8,6,Math.round(c.x-w/2),Math.round(c.y-3+Math.sin(c.t*.7)),w,6)}
 for(const it of items)b.drawImage(HELMET,Math.round(it.x-5),Math.round(it.y-4));
 // Steam vents.
 VENTS.forEach((v,i)=>{
  const ph=ventPhase(i);
  if(ph>=140&&ph<180&&frame%4===0)parts.push({x:v+(Math.random()-.5)*10,y:FLOOR-2,vx:0,vy:-.3,g:0,life:20,max:20,c:'#c9c5d6',s:1});
  if(ph>=180&&ph<250){const k=Math.min(1,(ph-180)/10)*Math.min(1,(250-ph)/12);for(let n=0;n<5;n++){const y=FLOOR-Math.random()*48*k;parts.push({x:v+(Math.random()-.5)*12,y,vx:(Math.random()-.5)*.4,vy:-1.2,g:0,life:16,max:16,c:Math.random()<.5?'#e8e6f0':'#a9a5b8',s:2})}}
 });
 for(const e of embers){if(e.warn>0){if((e.warn>>2)%2)rect(b,'#ffd23f',Math.round(e.x)-1,FLOOR-3,3,1);rect(b,'#ff9b3d',Math.round(e.x)-1,e.y,3,2)}else{rect(b,'#ffe2a2',Math.round(e.x)-1,Math.round(e.y)-1,3,3);rect(b,'#ff6a1a',Math.round(e.x)-2,Math.round(e.y),5,1)}}
 for(const p of parts){if(p.text)continue;b.globalAlpha=p.smoke?Math.min(.5,p.life/p.max):Math.min(1,p.life/(p.max*.5));rect(b,p.c,Math.round(p.x),Math.round(p.y),p.s||1,p.s||1)}
 b.globalAlpha=1;
 // Hero.
 if(state!=='title'&&state!=='brief'){
  const moving=Math.abs(P.vx)>.2;
  const key=hero+(P.epi?1:0)+(!P.ground?'jump':moving?((P.anim|0)%2?'walkA':'walkB'):'idle');
  const fr=HERO[key],blink=P.inv>0&&(P.inv>>2)%2;
  const img=blink?(P.face>0?fr.fr:fr.fl):(P.face>0?fr.r:fr.l);
  rect(b,'rgba(0,0,0,.35)',Math.round(P.x),FLOOR,P.w,1);
  b.drawImage(img,Math.round(P.x-1),Math.round(P.y-1));
  if(state==='crane'||P.remote)b.drawImage(REMOTE,Math.round(P.face>0?P.x+8:P.x-4),Math.round(P.y+5));
  else if(P.board)b.drawImage(CLIP,0,0,10,10,Math.round(P.face>0?P.x+7:P.x-6),Math.round(P.y+7),6,6);
  if(state==='crane'&&danger&&(frame>>2)%2){rect(b,'#ef4444',Math.round(P.x)+3,Math.round(P.y)-9,3,6);rect(b,'#ef4444',Math.round(P.x)+3,Math.round(P.y)-2,3,2)}
 }
 b.globalAlpha=.16+Math.sin(frame/7)*.03;b.fillStyle='#ff7a2a';b.fillRect(FURN.x,FLOOR-2,FURN.w,4);b.globalAlpha=.07;b.fillRect(FURN.x,FLOOR+2,FURN.w,10);b.globalAlpha=1;
 b.setTransform(1,0,0,1,0,0);
 const vg=b.createRadialGradient(VW/2,VH/2,VH*.4,VW/2,VH/2,VH*.95);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.45)');b.fillStyle=vg;b.fillRect(0,0,VW,VH);
}

// ───────────────────────── UI render (crisp layer) ─────────────────────────
const PX='"Press Start 2P",monospace',SANS='Inter,system-ui,sans-serif';
function U(){ctx.setTransform(DPR*S,0,0,DPR*S,DPR*OX,DPR*OY)}
function txt(s,x,y,size,color,align='left',font=PX,weight='',max){ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';max?ctx.fillText(s,x,y,max):ctx.fillText(s,x,y)}
function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke()}}
function button(label,x,y,w,h,fn,primary){buttons.push({x,y,w,h,fn});rr(x,y,w,h,4,primary?'#f1511b':'rgba(255,255,255,.08)',primary?null:'rgba(255,255,255,.25)');txt(label,x+w/2,y+h/2-3.5,7,'#fff','center')}
function shadowText(s,x,y,size,color,align='left'){txt(s,x+1,y+1,size,'rgba(0,0,0,.6)',align);txt(s,x,y,size,color,align)}
function corner(withPause){
 const list=[];
 if(withPause)list.push(['pause',()=>{if(state==='play'||state==='crane'){paused=state;state='pause'}else if(state==='pause')state=paused}]);
 list.push(['sound',()=>{AU.init();toggleMute()}]);
 let x=VW-10-list.length*15;
 for(const [kind,fn] of list){
  buttons.push({x,y:9,w:13,h:13,fn});
  rr(x,9,13,13,3,'rgba(255,255,255,.08)','rgba(255,255,255,.2)');
  ctx.fillStyle='#e4e4e7';ctx.strokeStyle='#e4e4e7';ctx.lineWidth=1;ctx.lineCap='round';
  const cx=x+6.5,cy=15.5;
  if(kind==='pause'){ctx.fillRect(cx-2.5,cy-3,1.8,6);ctx.fillRect(cx+.7,cy-3,1.8,6)}
  else{ctx.beginPath();ctx.moveTo(cx-4,cy-1.5);ctx.lineTo(cx-2,cy-1.5);ctx.lineTo(cx+.5,cy-3.5);ctx.lineTo(cx+.5,cy+3.5);ctx.lineTo(cx-2,cy+1.5);ctx.lineTo(cx-4,cy+1.5);ctx.fill();
   if(AU.muted){ctx.beginPath();ctx.moveTo(cx+2,cy-2);ctx.lineTo(cx+4.5,cy+2);ctx.moveTo(cx+4.5,cy-2);ctx.lineTo(cx+2,cy+2);ctx.stroke()}
   else{ctx.beginPath();ctx.arc(cx+.5,cy,2.6,-.8,.8);ctx.stroke();ctx.beginPath();ctx.arc(cx+.5,cy,4.4,-.8,.8);ctx.stroke()}}
  x+=15;
 }
}
function hud(){
 rr(4,4,VW-8,24,5,'rgba(10,10,12,.72)','rgba(255,255,255,.08)');
 ctx.imageSmoothingEnabled=false;
 for(let i=0;i<3;i++){ctx.globalAlpha=i<P.hearts?1:.22;ctx.drawImage(HELMET,10+i*13,9,10,5);ctx.globalAlpha=1}
 txt(P.epi?'EPI OK':'SEM EPI',10,18,4.2,P.epi?'#60a5fa':'#ef4444');
 txt('PONTOS',54,8,4.5,'#9a9aa2');txt(String(stats.score).padStart(5,'0'),54,15,7,'#ffd23f');
 const secs=Math.floor(stats.time/60);txt('TEMPO',104,8,4.5,'#9a9aa2');txt(`${String(secs/60|0).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`,104,15,7,'#fff');
 txt('TURNO',146,8,4.5,'#9a9aa2');txt(SHIFT(),146,15,7,'#a78bfa');
 ctx.drawImage(NUT,178,15,8,6);txt('x'+stats.coins,189,15,6,'#fff');
 txt('MISSÃO',212,8,4.5,'#9a9aa2');txt(objective(),212,15.5,6.2,'#fff','left',SANS,700,VW-118-212);
 rolls.forEach((r,i)=>{const x=VW-105+i*10,c=r.removed?'#86e1ff':r.inspected?STATUS[r.status][1]:'#3a3446';ctx.beginPath();ctx.arc(x,16,3.8,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();txt(String(i),x,13.6,4.5,r.inspected||r.removed?'#0a0a0a':'#9a9aa2','center')});
 corner(true);
}
function prompt(){
 const n=nearby();if(!n||state!=='play')return;
 const x=Math.max(30,Math.min(VW-30,P.x+P.w/2-Math.round(camX))),y=P.y-14;
 ctx.font=`700 6px ${SANS}`;const w=ctx.measureText(n.label).width+22;
 rr(x-w/2,y-11,w,12,3,'rgba(10,10,12,.85)','rgba(255,255,255,.2)');
 rr(x-w/2+3,y-9,8,8,2,'#f1511b');txt('E',x-w/2+7,y-7.2,4.5,'#fff','center');
 txt(n.label,x-w/2+14,y-8.6,6,'#fff','left',SANS,700);
}
function toastsUI(){
 const base=state==='crane'?VH-76:VH-30;
 toasts.forEach((t,i)=>{
  const a=Math.min(1,t.t/20,(t.max-t.t)/10);ctx.globalAlpha=a;
  ctx.font=`700 7px ${SANS}`;const w=Math.min(VW-20,ctx.measureText(t.text).width+20);
  const y=base-(toasts.length-1-i)*15;
  rr(VW/2-w/2,y,w,13,4,'rgba(10,10,12,.9)','rgba(255,255,255,.12)');
  ctx.beginPath();ctx.arc(VW/2-w/2+7,y+6.5,2,0,Math.PI*2);ctx.fillStyle=t.color;ctx.fill();
  txt(t.text,VW/2-w/2+12,y+3,7,'#fff','left',SANS,700,w-18);ctx.globalAlpha=1;
 });
 for(const p of parts){if(!p.text)continue;ctx.globalAlpha=Math.min(1,p.life/25);shadowText(p.text,p.x-Math.round(camX),p.y,6,p.c,'center');ctx.globalAlpha=1}
}
function board(){
 const show=boardOpen||boardTimer>0;if(!show||!P.board||state==='crane')return;
 const slide=boardOpen?1:Math.min(1,boardTimer/20,(260-boardTimer)/12+.0001);
 const w=136,x=VW-w-8+(1-Math.min(1,slide))*150,y=34,h=150;
 rr(x,y,w,h,6,'#8a5a2b');rr(x+1,y+1,w-2,h-2,5,null,'#5e3b1a');
 rr(x+6,y+10,w-12,h-16,2,'#f6f3ea');
 rr(x+w/2-16,y-2,32,10,3,'#c3c8d0','#6b7280');
 txt('PRANCHETA · RONDA',x+12,y+15,4.6,'#7c3aed');
 ctx.strokeStyle='#e7e2d3';ctx.lineWidth=.5;for(let ly=y+28;ly<y+h-22;ly+=13){ctx.beginPath();ctx.moveTo(x+10,ly+10);ctx.lineTo(x+w-10,ly+10);ctx.stroke()}
 txt('Tecla C · abrir/fechar',x+w/2,y+h-11,4.6,'#f3e9d8','center',SANS,600);
 log.slice(-7).forEach((l,i)=>{
  const ly=y+26+i*14.5;
  const t1=l.title.slice(0,Math.ceil(l.shown*1.2)),t2=l.line.slice(0,Math.max(0,Math.ceil(l.shown*1.2-l.title.length)));
  ctx.beginPath();ctx.arc(x+12,ly+3,1.6,0,Math.PI*2);ctx.fillStyle=l.color;ctx.fill();
  txt(t1,x+16,ly,5.6,'#22223a','left',SANS,700,w-26);
  txt(t2,x+16,ly+6.5,4.8,'#5b5b70','left',SANS,500,w-26);
 });
}
function panel(x,y,w,h){rr(x,y,w,h,8,'rgba(14,14,18,.96)','rgba(255,255,255,.12)')}
function remoteUI(){
 // Remote-control pendant with live readouts.
 const x=8,y=VH-60,w=170,h=54;
 panel(x,y,w,h);
 rr(x+6,y+6,32,42,5,'#f2c230');rr(x+9,y+9,26,36,3,'#1b1a22');
 const pads=[['←',x+12,y+12,keys.left],['→',x+24,y+12,keys.right],['↑',x+12,y+23,keys.jump],['↓',x+24,y+23,keys.down]];
 for(const [l,bx,by,on] of pads){rr(bx,by,9,9,2,on?'#22c55e':'#3a3446');txt(l,bx+4.5,by+1.8,5,'#fff','center',SANS,700)}
 rr(x+12,y+35,9,6,2,'#ef4444');rr(x+24,y+35,9,6,2,'#22c55e');
 txt('PONTE ROLANTE · CONTROLE REMOTO',x+44,y+7,4,'#facc15');
 const L=crane.load,tg=nearestTarget();
 txt('Carga: '+(L?(L.kind==='old'?'rolo usado (quente)':'rolo novo'):'nenhuma'),x+44,y+15,6,'#fff','left',SANS,700);
 txt(`Gancho ${Math.round(crane.hook/HOOK_MAX*100)}% · E engata/solta · Q sai`,x+44,y+24,5,'#9a9aa2','left',SANS,500);
 if(tg){
  const dx=Math.round(tg.x-crane.x),dy=Math.round(tg.y-loadY(crane.hook)),ok=Math.abs(dx)<=5&&Math.abs(dy)<=5;
  const label=ok?'ALINHADO · pressione E':`Alinhar: ${dx>0?'→':'←'} ${Math.abs(dx)}   ${dy>0?'↓':'↑'} ${Math.abs(dy)}`;
  rr(x+44,y+34,w-50,13,3,ok?'rgba(34,197,94,.18)':'rgba(250,204,21,.12)',ok?'#22c55e':'#facc15');
  txt(label,x+44+(w-50)/2,y+37.5,5.6,ok?'#22c55e':'#facc15','center',SANS,700);
 }
 if(danger&&(frame>>3)%2){rr(VW/2-96,34,192,16,4,'#ef4444');txt('PERIGO · OPERADOR SOB CARGA SUSPENSA',VW/2,39,4.8,'#fff','center')}
}
function inspectUI(){
 const s=inspect,r=s.r;
 ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,VW,VH);
 const x=60,y=34,w=280,h=160;panel(x,y,w,h);
 txt('INSPEÇÃO',x+14,y+12,5,'#a78bfa');txt(`Rolo ${r.i} · ${r.i?'Forno, posição '+r.i:'Externo'}`,x+14,y+21,9,'#fff','left',SANS,800);
 ctx.imageSmoothingEnabled=false;
 const bx=x+60,by=y+92;
 ctx.save();ctx.translate(bx,by);ctx.rotate(r.ang);ctx.drawImage(BIG[r.variant],-BIGR,-BIGR);ctx.restore();
 ctx.fillStyle=ROLL_PAL[r.variant][0];for(let k=0;k<6;k++){const a=r.ang+k*Math.PI/3;for(let t=6;t<BIGR-3;t+=1.4)ctx.fillRect(bx+Math.cos(a)*t-.6,by+Math.sin(a)*t-.6,1.2,1.2)}
 const sw=Math.sin(frame/12)*BIGR;ctx.fillStyle='rgba(124,58,237,.25)';ctx.fillRect(bx-BIGR-4,by+sw-1,BIGR*2+8,2);
 const gx=x+120,gw=144;
 if(s.phase==='aim'){
  txt('Pare o cursor no verde para uma',gx,y+44,6.5,'#e4e4e7','left',SANS,600);
  txt('leitura precisa de desgaste.',gx,y+53,6.5,'#e4e4e7','left',SANS,600);
  const by2=y+74;
  [[0,.3,'#ef4444'],[.3,.42,'#facc15'],[.42,.58,'#22c55e'],[.58,.7,'#facc15'],[.7,1,'#ef4444']].forEach(([a,c,col])=>{ctx.fillStyle=col;ctx.globalAlpha=.85;ctx.fillRect(gx+a*gw,by2,(c-a)*gw,12)});ctx.globalAlpha=1;
  rr(gx,by2,gw,12,2,null,'rgba(255,255,255,.4)');
  const cxp=gx+s.pos*gw;ctx.fillStyle='#fff';ctx.fillRect(cxp-1,by2-4,2,20);ctx.beginPath();ctx.moveTo(cxp-4,by2-6);ctx.lineTo(cxp+4,by2-6);ctx.lineTo(cxp,by2-1);ctx.fill();
  rr(gx,y+102,gw,16,4,'#f1511b');txt('E / ESPAÇO / TOQUE · PARAR',gx+gw/2,y+107,4.8,'#fff','center');
  txt('Inspeção com EPI e a distância segura das partes quentes.',gx+gw/2,y+126,5,'#9a9aa2','center',SANS,500,gw);
 }else{
  const q={precise:['LEITURA PRECISA','#22c55e','+150'],ok:['LEITURA ACEITÁVEL','#facc15','+80'],poor:['LEITURA IMPRECISA','#ef4444','+30']}[s.quality];
  txt(q[0],gx,y+42,6,q[1]);txt(q[2]+' pontos',gx+gw,y+43,6,'#ffd23f','right',SANS,700);
  const [label,col]=STATUS[r.status];
  [['Tempo de uso',r.days+' dias'],['Diâmetro','Ø '+r.diam+' mm'],['Perímetro',fmt(Math.round(Math.PI*r.diam))+' mm']].forEach(([k,v],i)=>{const yy=y+58+i*13;txt(k,gx,yy,6.5,'#9a9aa2','left',SANS,500);txt(v,gx+gw,yy,6.5,'#fff','right',SANS,700);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(gx,yy+10,gw,.5)});
  rr(gx,y+100,gw,18,4,col+'33',col);txt('STATUS: '+label,gx+gw/2,y+106,5.6,col,'center');
  txt('anotando na prancheta…',gx+gw/2,y+124,5.6,'#9a9aa2','center',SANS,500);
 }
}
function heroCard(style,x,y,selected){
 rr(x,y,62,62,6,selected?'rgba(241,81,27,.18)':'rgba(255,255,255,.05)',selected?'#f1511b':'rgba(255,255,255,.15)');
 ctx.imageSmoothingEnabled=false;
 const f=HERO[style+'1'+(selected&&(frame>>3)%2?'walkA':'idle')];ctx.drawImage(f.r,x+19,y+6,24,32);
 txt(style==='b'?'Rafaela':'Rolando',x+31,y+42,7,'#fff','center',SANS,800);
 txt(style==='b'?'Técnica · RB1':'Técnico · RB1',x+31,y+51,5,'#9a9aa2','center',SANS,500);
 buttons.push({x,y,w:62,h:62,fn:()=>{if(hero===style)beginShift();else{hero=style;store.set('rb1game.hero',hero);AU.sfx('select')}}});
}
function titleUI(){
 ctx.fillStyle='rgba(6,6,10,.62)';ctx.fillRect(0,0,VW,VH);
 corner(false);
 txt('RB1 ROLL · APRESENTA',VW/2,18,5.5,'#a78bfa','center');
 shadowText('A MISSÃO DO FORNO',VW/2,32,13,'#fff','center');
 ctx.fillStyle='#f1511b';ctx.fillRect(VW/2+109,42,4,4);
 txt('Inspecione os rolos, troque os que estão em prioridade com a ponte rolante e volte para casa em segurança.',VW/2,52,6.2,'#d4d4d8','center',SANS,500,VW-40);
 txt('ESCOLHA SEU PERSONAGEM',VW/2,66,4.8,'#9a9aa2','center');
 heroCard('a',VW/2-68,76,hero==='a');heroCard('b',VW/2+6,76,hero==='b');
 txt('← → escolher · uniforme Aperam',VW/2,142,5.4,'#9a9aa2','center',SANS,500);
 if((frame>>5)%2===0)txt('PRESSIONE ENTER OU TOQUE NO PERSONAGEM',VW/2,154,5.4,'#ffd23f','center');
 const ctl=[['← →','andar'],['↑ / ESPAÇO','pular'],['E','agir'],['C','prancheta'],['P','pausa'],['M','som']];
 let cx=VW/2-ctl.length*30;
 ctl.forEach(([k,v])=>{rr(cx,170,56,18,4,'rgba(255,255,255,.06)','rgba(255,255,255,.14)');txt(k,cx+28,174,4.6,'#fff','center');txt(v,cx+28,181,5,'#9a9aa2','center',SANS,500);cx+=60});
 txt('Ponte rolante: ← → mover · ↑ ↓ gancho · E engatar/soltar · Q sair',VW/2,194,5.2,'#9a9aa2','center',SANS,500);
 if(best)txt('RECORDE: '+best,VW/2,207,4.6,'#6b6b74','center');
}
function briefUI(){
 ctx.fillStyle='rgba(6,6,10,.72)';ctx.fillRect(0,0,VW,VH);
 const x=56,y=14,w=288,h=198;panel(x,y,w,h);
 rr(x+14,y+12,22,22,5,'#16a34a');ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x+19,y+23);ctx.lineTo(x+23,y+27);ctx.lineTo(x+31,y+18);ctx.stroke();
 txt('DIÁLOGO DE SEGURANÇA',x+42,y+13,4.8,'#22c55e');
 txt(`Bom turno, ${heroName()}! Antes de começar:`,x+42,y+22,8,'#fff','left',SANS,800,w-56);
 const rules=[['#2563eb','EPI completo, sempre','Capacete, óculos, luvas e botina. Sem EPI, sem acesso à área do forno.'],['#ef4444','Nunca sob carga suspensa','Ao operar a ponte rolante, fique fora da rota e da área marcada em vermelho.'],['#f1511b','Respeite as áreas quentes','Fagulhas e vapor: observe os avisos e mantenha distância segura.'],['#facc15','Pare e comunique','Condição insegura? Você tem o direito de recusa. Nenhuma tarefa vale um acidente.']];
 rules.forEach(([c,t,d],i)=>{const yy=y+42+i*28;rr(x+14,yy,w-28,24,4,'rgba(255,255,255,.04)','rgba(255,255,255,.08)');rr(x+19,yy+5,14,14,4,c);txt(String(i+1),x+26,yy+8.5,5.5,'#fff','center');txt(t,x+40,yy+4,6.6,'#fff','left',SANS,800);txt(d,x+40,yy+13,5.2,'#a1a1aa','left',SANS,500,w-62)});
 txt('Sua vida e a dos colegas vêm antes de qualquer meta.',x+w/2,y+158,6,'#e4e4e7','center',SANS,700);
 button('ENTENDI · COMEÇAR O TURNO',x+w/2-84,y+172,168,17,startPlay,true);
}
function pauseUI(){
 ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,VW,VH);
 panel(VW/2-90,52,180,124);
 txt('PAUSA',VW/2,64,10,'#fff','center');
 txt(TIPS[(frame/600|0)%TIPS.length],VW/2,80,5.2,'#9a9aa2','center',SANS,500,164);
 button('CONTINUAR',VW/2-70,98,140,16,()=>{state=paused},true);
 button('RECOMEÇAR',VW/2-70,118,140,16,()=>beginShift());
 button(AU.muted?'LIGAR SOM':'DESLIGAR SOM',VW/2-70,138,140,16,()=>{AU.init();toggleMute()});
}
function doneUI(){
 ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,VW,VH);
 const x=36,y=10,w=328,h=205;panel(x,y,w,h);
 const safe=doneData.safety>=90;
 txt('MISSÃO CUMPRIDA',x+16,y+12,5.5,'#22c55e');
 txt('Turno registrado no RB1 Roll',x+16,y+21,10,'#fff','left',SANS,800);
 rr(x+w-58,y+10,42,42,8,'#f1511b');txt(doneData.rank,x+w-37,y+19,20,'#fff','center');txt('NOTA',x+w-37,y+43,4.5,'#ffe2a2','center');
 if(stats.score>=best)txt('RECORDE!',x+w-37,y+56,4.6,'#ffd23f','center');
 const st=[['Pontuação',fmt(stats.score)],['Tempo',`${doneData.secs/60|0}min ${doneData.secs%60}s`],['Segurança',doneData.safety+'%'],['Inspeções precisas',`${stats.precise}/${stats.inspections}`],['Trocas com a ponte',String(stats.swaps)],['Infrações',String(stats.violations)]];
 st.forEach(([k,v],i)=>{const cx=x+16+(i%3)*84,cy=y+40+(i/3|0)*22;txt(k,cx,cy,5.4,'#9a9aa2','left',SANS,500);txt(v,cx,cy+7.5,8,k==='Segurança'?(safe?'#22c55e':'#facc15'):k==='Infrações'&&stats.violations?'#ef4444':'#fff','left',SANS,800)});
 const ty=y+88;txt('CONDIÇÃO FINAL DOS ROLOS',x+16,ty,4.8,'#a78bfa');
 rolls.forEach((r,i)=>{const cx=x+16+i*60,cy=ty+9;const [label,col]=STATUS[r.status];rr(cx,cy,56,34,4,'rgba(255,255,255,.04)','rgba(255,255,255,.1)');ctx.beginPath();ctx.arc(cx+9,cy+9,5,0,Math.PI*2);ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.stroke();txt(String(r.i),cx+9,cy+6.5,5,col,'center');txt(r.days+' d',cx+50,cy+6,6.5,'#fff','right',SANS,800);txt(label,cx+6,cy+18,4.2,col);txt(r.replaced?'rolo trocado':'mantido',cx+6,cy+25,5,'#9a9aa2','left',SANS,500)});
 rr(x+16,y+136,w-32,26,5,safe?'rgba(34,197,94,.12)':'rgba(250,204,21,.1)',safe?'#22c55e':'#facc15');
 txt(safe?'Missão cumprida com segurança. Obrigado por cuidar de você e da equipe!':'Missão cumprida, mas com riscos. Na próxima, segurança em primeiro lugar!',x+w/2,y+141,6.4,safe?'#bbf7d0':'#fde68a','center',SANS,700,w-44);
 txt('Volte para casa todos os dias. Sua família espera você.',x+w/2,y+151,5.4,'#d4d4d8','center',SANS,500,w-44);
 button('JOGAR DE NOVO',x+16,y+h-30,130,18,()=>beginShift());
 button('ACESSAR O PAINEL →',x+w-166,y+h-30,150,18,enterPanel,true);
}
function enterPanel(){if(embedded)parent.postMessage({type:'rb1:enter'},'*');else location.href='/#painel'}

// ───────────────────────── Loop ─────────────────────────
let last=performance.now(),acc=0;
function step(){
 if(state==='title'){
  if(take('left')||take('right')){hero=hero==='a'?'b':'a';store.set('rb1game.hero',hero);AU.sfx('select')}
  if(take('act')||take('jump'))beginShift();
 }
 else if(state==='brief'){if(take('act')||take('jump'))startPlay()}
 else if(state==='play'){updatePlay();updateHazards()}
 else if(state==='crane'){updateCrane();if(state==='crane'||state==='play'){physics(false);updateHazards()}}
 else if(state==='inspect')updateInspect();
 else if(state==='pause'){if(take('pause')||take('act'))state=paused;if(take('restart'))beginShift()}
 else if(state==='done'){if(take('restart'))beginShift();if(take('act'))enterPanel()}
 if((state==='play'||state==='crane')&&take('restart'))beginShift();
 updateCommon();
}
function loop(now){
 acc+=Math.min(100,now-last);last=now;
 while(acc>=1000/60){acc-=1000/60;step()}
 renderWorld();
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,cvs.width,cvs.height);
 ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(buf,OX,OY,VW*S,VH*S);
 U();buttons=[];
 if(state==='title')titleUI();
 else if(state==='brief')briefUI();
 else{
  hud();prompt();board();
  if(state==='crane')remoteUI();
  toastsUI();
  if(state==='inspect')inspectUI();
  if(state==='pause')pauseUI();
  if(state==='done')doneUI();
 }
 requestAnimationFrame(loop);
}
// Read-only hook for automated checks.
window.__rb1={get state(){return state},get P(){return P},get rolls(){return rolls},get stats(){return stats},get crane(){return crane},get cradle(){return cradle}};
(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>requestAnimationFrame(loop));
})();
