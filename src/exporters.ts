// Relatórios do histórico de trocas em PDF e Excel, no padrão visual do RB1 Roll.
// As bibliotecas são carregadas sob demanda para não pesar no carregamento do painel.

export type ExportEvent={roll_id:number;operator:string;shift:string;occurred:string;reason:string;diameter:number|null;notes:string};
export type ExportRoll={id:number;name:string;location:string;diameter:number|null;installed:string|null;days:number|null;status:string};
export type ExportMeta={filters:string[];rolls:ExportRoll[]};

const TZ='America/Sao_Paulo';
const C={ink:'0A0A0A',text2:'52525B',text3:'9A9AA2',border:'E7E7E4',zebra:'FAFAF9',violet:'7C3AED',accent:'F1511B',green:'16A34A',yellow:'CA8A04',red:'DC2626',unknown:'8A8A93'};
const statusColor:Record<string,string>={green:C.green,yellow:C.yellow,red:C.red,unknown:C.unknown};
const statusTint:Record<string,string>={green:'E7F6EC',yellow:'FEF6DC',red:'FDECEC',unknown:'F1F1F3'};
const statusLabel:Record<string,string>={green:'Em dia',yellow:'Atenção',red:'Prioridade',unknown:'Sem registro'};
const shiftName:Record<string,string>={TN:'Turno da Noite',TM:'Turno da Manhã',TT:'Turno da Tarde'};
const day=(s:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s));
const hour=(s:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const stamp=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,dateStyle:'short',timeStyle:'short'}).format(new Date());
const fileStamp=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date()).replace(' ','_').replace(':','');
const fmtNum=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const rgb=(hex:string):[number,number,number]=>[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
// Wall-clock date in Brasília as a naive Date, so Excel shows the same local time the operator saw.
const localDate=(s:string)=>{const p=new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(s));return new Date(p.replace(' ','T')+'Z')};

function summary(events:ExportEvent[]){
 const by=(f:(e:ExportEvent)=>string)=>{const m=new Map<string,number>();for(const e of events)m.set(f(e),(m.get(f(e))||0)+1);return [...m.entries()].sort((a,b)=>b[1]-a[1])};
 return {shift:['TN','TM','TT'].map(s=>[s,events.filter(e=>e.shift===s).length] as [string,number]),roll:by(e=>'Rolo '+e.roll_id).sort((a,b)=>a[0].localeCompare(b[0])),reason:by(e=>e.reason)};
}

function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export async function exportPdf(events:ExportEvent[],meta:ExportMeta){
 const [{jsPDF},{autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 const W=doc.internal.pageSize.getWidth(),M=14;
 const s=summary(events);

 // Header: brand, eyebrow, title with accent period, filters.
 // Logo: same 24-unit mark as the app (strip over a roll, orange axle), drawn in white on an ink tile.
 const L=9,k=L/24,lx=M,ly=11.5,u=(x:number,y:number):[number,number]=>[lx+x*k,ly+y*k];
 doc.setFillColor(...rgb(C.ink));doc.roundedRect(lx,ly,L,L,2,2,'F');
 doc.setLineCap('round');doc.setDrawColor(255,255,255);doc.setLineWidth(2*k);doc.line(...u(2.8,5.2),...u(21.2,5.2));
 doc.setLineWidth(2.4*k);doc.circle(...u(12,13.6),7.2*k,'S');
 // Quarter arc (rotation cue) as a cubic Bézier from 12 o'clock to 3 o'clock.
 const c=7.2*.5523;doc.setDrawColor(...rgb(C.accent));doc.lines([[c*k,0,7.2*k,(7.2-c)*k,7.2*k,7.2*k]],...u(12,6.4),[1,1],'S');
 doc.setFillColor(255,255,255);doc.circle(...u(12,13.6),1.9*k,'F');doc.setLineCap('butt');
 doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.setTextColor(...rgb(C.ink));doc.text('RB1 ROLL',M+12,15.6);
 doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...rgb(C.text3));doc.text('Condição dos rolos · Aperam',M+12,19.2);
 doc.setFont('courier','normal');doc.setFontSize(7.5);doc.text('GERADO EM '+stamp(),W-M,15.6,{align:'right'});
 doc.setFillColor(...rgb(C.violet));doc.circle(M+1,31,1,'F');
 doc.setFont('courier','normal');doc.setFontSize(8);doc.setTextColor(...rgb(C.text2));doc.text('RASTREABILIDADE · FORNO DE RECOZIMENTO',M+4,32);
 doc.setFont('helvetica','bold');doc.setFontSize(22);doc.setTextColor(...rgb(C.ink));doc.text('Histórico de trocas',M,42);
 const tw=doc.getTextWidth('Histórico de trocas');doc.setFillColor(...rgb(C.accent));doc.rect(M+tw+1,40.4,1.6,1.6,'F');
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...rgb(C.text2));
 doc.text('Filtros: '+(meta.filters.length?meta.filters.join('  ·  '):'nenhum (todos os registros)'),M,48.5,{maxWidth:W-2*M});

 // KPI strip.
 const kpis:[string,string,string][]=[['Trocas no relatório',String(events.length),C.violet],...s.shift.map(([k,v])=>[shiftName[k]+' ('+k+')',String(v),C.ink] as [string,string,string]),['Posições envolvidas',String(s.roll.length),C.ink]];
 const kx=M,ky=54,kw=(W-2*M)/kpis.length,kh=19;
 doc.setDrawColor(...rgb(C.border));doc.setLineWidth(.25);doc.roundedRect(kx,ky,W-2*M,kh,2.5,2.5,'S');
 kpis.forEach(([label,value,color],i)=>{
  const x=kx+i*kw;if(i)doc.line(x,ky,x,ky+kh);
  doc.setFillColor(...rgb(i===0?C.violet:C.border));doc.rect(x+5,ky,7,.9,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(...rgb(C.ink));doc.text(label,x+5,ky+6.5);
  doc.setFont('courier','bold');doc.setFontSize(15);doc.setTextColor(...rgb(color));doc.text(value.padStart(2,'0'),x+5,ky+14.5);
 });

 autoTable(doc,{
  startY:ky+kh+7,margin:{left:M,right:M,top:16,bottom:16},
  head:[['Data','Hora','Turno','Posição','Operador','Ø (mm)','Perímetro (mm)','Motivo','Observações']],
  body:events.map(e=>[day(e.occurred),hour(e.occurred),e.shift,'Rolo '+e.roll_id,e.operator,e.diameter?fmtNum(e.diameter):'—',e.diameter?fmtNum(Math.round(Math.PI*e.diameter)):'—',e.reason,e.notes||'']),
  styles:{font:'helvetica',fontSize:7.8,textColor:rgb(C.ink),cellPadding:{top:2.4,bottom:2.4,left:2.6,right:2.6},lineColor:rgb(C.border),lineWidth:{bottom:.2},valign:'middle'},
  headStyles:{fillColor:rgb(C.ink),textColor:255,fontStyle:'bold',fontSize:7.2},
  alternateRowStyles:{fillColor:rgb(C.zebra)},
  columnStyles:{0:{cellWidth:21},1:{cellWidth:13},2:{cellWidth:13,fontStyle:'bold'},3:{cellWidth:17},5:{cellWidth:17,halign:'right',font:'courier'},6:{cellWidth:25,halign:'right',font:'courier'},8:{cellWidth:78,textColor:rgb(C.text2)}},
  didParseCell:d=>{if(d.section==='body'&&d.column.index===2){const k=String(d.cell.raw);d.cell.styles.textColor=rgb(k==='TN'?C.violet:k==='TM'?C.accent:C.ink)}},
 });
 if(!events.length){const y=(doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+8;doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...rgb(C.text3));doc.text('Nenhuma troca encontrada com os filtros selecionados.',W/2,y,{align:'center'})}

 // Current condition of each position.
 let y=(doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+(events.length?12:18);
 if(y>doc.internal.pageSize.getHeight()-60){doc.addPage();y=22}
 doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...rgb(C.ink));doc.text('Condição atual por posição',M,y);
 autoTable(doc,{
  startY:y+3,margin:{left:M,right:M,bottom:16},
  head:[['Posição','Local','Status','Dias em uso','Ø (mm)','Perímetro (mm)','Última troca']],
  body:meta.rolls.map(r=>[r.name,r.location,statusLabel[r.status]||r.status,r.days===null?'—':String(r.days),r.diameter?fmtNum(r.diameter):'—',r.diameter?fmtNum(Math.round(Math.PI*r.diameter)):'—',r.installed?day(r.installed)+' '+hour(r.installed):'—']),
  styles:{font:'helvetica',fontSize:7.8,textColor:rgb(C.ink),cellPadding:2.4,lineColor:rgb(C.border),lineWidth:{bottom:.2}},
  headStyles:{fillColor:rgb(C.ink),textColor:255,fontStyle:'bold',fontSize:7.2},
  alternateRowStyles:{fillColor:rgb(C.zebra)},
  didParseCell:d=>{if(d.section==='body'&&d.column.index===2){d.cell.styles.textColor=rgb(statusColor[meta.rolls[d.row.index].status]||C.ink);d.cell.styles.fontStyle='bold'}},
 });

 // Footer on every page.
 const pages=doc.getNumberOfPages(),H=doc.internal.pageSize.getHeight();
 for(let i=1;i<=pages;i++){
  doc.setPage(i);doc.setDrawColor(...rgb(C.border));doc.setLineWidth(.25);doc.line(M,H-10,W-M,H-10);
  doc.setFont('courier','normal');doc.setFontSize(7);doc.setTextColor(...rgb(C.text3));
  doc.text('RB1 Roll · Histórico de trocas',M,H-6);doc.text(`Página ${i} de ${pages}`,W-M,H-6,{align:'right'});
 }
 download(doc.output('blob'),`rb1-roll-historico_${fileStamp()}.pdf`);
}

export async function exportExcel(events:ExportEvent[],meta:ExportMeta){
 const {default:ExcelJS}=await import('exceljs');
 const wb=new ExcelJS.Workbook();wb.creator='RB1 Roll';wb.created=new Date();
 const font={name:'Calibri',size:10,color:{argb:'FF'+C.ink}};
 const thin={style:'thin' as const,color:{argb:'FF'+C.border}};
 const s=summary(events);
 const print={fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,orientation:'portrait' as 'portrait'|'landscape'};
 const filterNote=()=>'Filtros: '+(meta.filters.length?meta.filters.join('  ·  '):'nenhum (todos os registros)');

 function heading(ws:import('exceljs').Worksheet,title:string,cols:number,note=filterNote()){
  ws.mergeCells(1,1,1,cols);ws.getCell(1,1).value='RB1 ROLL  ·  CONDIÇÃO DOS ROLOS  ·  APERAM';
  ws.getCell(1,1).font={name:'Consolas',size:9,color:{argb:'FF'+C.violet},bold:true};
  ws.mergeCells(2,1,2,cols);ws.getCell(2,1).value={richText:[{text:title,font:{name:'Calibri',size:20,bold:true,color:{argb:'FF'+C.ink}}},{text:'.',font:{name:'Calibri',size:20,bold:true,color:{argb:'FF'+C.accent}}}]};
  ws.getRow(2).height=30;
  ws.mergeCells(3,1,3,cols);ws.getCell(3,1).value=note+'     |     Gerado em '+stamp();
  ws.getCell(3,1).font={...font,size:9,color:{argb:'FF'+C.text2}};
  ws.getRow(4).height=6;
  for(let c=1;c<=cols;c++)ws.getCell(4,c).border={bottom:{style:'medium',color:{argb:'FF'+C.accent}}};
 }
 function header(row:import('exceljs').Row){
  row.height=22;
  row.eachCell(c=>{c.font={name:'Calibri',size:10,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+C.ink}};c.alignment={vertical:'middle',horizontal:'left',indent:1}});
 }
 function body(row:import('exceljs').Row,i:number){
  row.height=20;
  row.eachCell({includeEmpty:true},c=>{c.font={...font,...(c.font||{})};c.border={bottom:thin};c.alignment={vertical:'middle',wrapText:true,indent:1,...(c.alignment||{})};if(i%2)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+C.zebra}}});
 }

 // Sheet 1: filtered replacements.
 const ws=wb.addWorksheet('Trocas',{views:[{state:'frozen',ySplit:6,showGridLines:false}],pageSetup:{...print,orientation:'landscape'}});
 ws.columns=[{width:13},{width:8},{width:9},{width:11},{width:20},{width:22},{width:11},{width:15},{width:26},{width:48}];
 heading(ws,'Histórico de trocas',10);
 const h=ws.getRow(6);h.values=['Data','Hora','Turno','Posição','Local','Operador','Ø (mm)','Perímetro (mm)','Motivo','Observações'];header(h);
 events.forEach((e,i)=>{
  const r=ws.addRow([localDate(e.occurred),hour(e.occurred),e.shift,'Rolo '+e.roll_id,meta.rolls.find(x=>x.id===e.roll_id)?.location||'',e.operator,e.diameter??'—',e.diameter?Math.round(Math.PI*e.diameter):'—',e.reason,e.notes||'']);
  r.getCell(1).numFmt='dd/mm/yyyy';r.getCell(1).alignment={horizontal:'left'};
  r.getCell(3).font={...font,bold:true,color:{argb:'FF'+(e.shift==='TN'?C.violet:e.shift==='TM'?C.accent:C.ink)}};
  for(const c of [7,8])r.getCell(c).alignment={horizontal:'right'};r.getCell(8).numFmt='#,##0';
  r.getCell(10).font={...font,color:{argb:'FF'+C.text2}};
  body(r,i);
 });
 if(events.length)ws.autoFilter={from:{row:6,column:1},to:{row:6+events.length,column:10}};
 else{const r=ws.addRow(['Nenhuma troca encontrada com os filtros selecionados.']);ws.mergeCells(r.number,1,r.number,10);r.getCell(1).font={...font,italic:true,color:{argb:'FF'+C.text3}}}

 // Sheet 2: summary of the same filtered data.
 const sm=wb.addWorksheet('Resumo',{views:[{showGridLines:false}],pageSetup:print});
 sm.columns=[{width:30},{width:14},{width:14}];
 heading(sm,'Resumo do relatório',3);
 let row=6;
 const block=(title:string,data:[string,number][])=>{
  const t=sm.getRow(row);t.values=[title,'Trocas','% do total'];header(t);row++;
  data.forEach(([k,v],i)=>{const r=sm.getRow(row++);r.values=[k,v,events.length?v/events.length:0];r.getCell(3).numFmt='0%';r.getCell(2).alignment={horizontal:'right'};r.getCell(3).alignment={horizontal:'right'};body(r,i)});
  if(!data.length){const r=sm.getRow(row++);r.values=['Sem dados no período'];r.getCell(1).font={...font,italic:true,color:{argb:'FF'+C.text3}}}
  row++;
 };
 const total=sm.getRow(row++);total.values=['Total de trocas',events.length];total.getCell(1).font={...font,bold:true};total.getCell(2).font={name:'Consolas',size:14,bold:true,color:{argb:'FF'+C.violet}};total.height=24;row++;
 block('Por turno',s.shift.map(([k,v])=>[`${k} · ${shiftName[k]}`,v]));
 block('Por posição',s.roll);
 block('Por motivo',s.reason);

 // Sheet 3: current condition (not filtered — snapshot at export time).
 const cs=wb.addWorksheet('Condição atual',{views:[{showGridLines:false}],pageSetup:{...print,orientation:'landscape'}});
 cs.columns=[{width:12},{width:22},{width:16},{width:13},{width:11},{width:16},{width:20}];
 heading(cs,'Condição atual por posição',7,'Situação de todas as posições no momento da exportação (não depende dos filtros)');
 const ch=cs.getRow(6);ch.values=['Posição','Local','Status','Dias em uso','Ø (mm)','Perímetro (mm)','Última troca'];header(ch);
 meta.rolls.forEach((r,i)=>{
  const x=cs.addRow([r.name,r.location,statusLabel[r.status]||r.status,r.days??'—',r.diameter??'—',r.diameter?Math.round(Math.PI*r.diameter):'—',r.installed?localDate(r.installed):'—']);
  x.getCell(3).font={...font,bold:true,color:{argb:'FF'+(statusColor[r.status]||C.ink)}};
  x.getCell(7).numFmt='dd/mm/yyyy hh:mm';
  for(const c of [4,5,6,7])x.getCell(c).alignment={horizontal:'center'};x.getCell(6).numFmt='#,##0';
  body(x,i);
  x.getCell(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+(statusTint[r.status]||statusTint.unknown)}};
 });

 const buf=await wb.xlsx.writeBuffer();
 download(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`rb1-roll-historico_${fileStamp()}.xlsx`);
}
