import {useEffect,useMemo,useRef,useState} from 'react';
import type {ComponentType,KeyboardEvent} from 'react';
import {CornerDownLeft,Search} from 'lucide-react';

export type Command={id:string;group:string;label:string;hint?:string;icon:ComponentType<{size?:number}>;run:()=>void};

const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();

export function CommandPalette({commands,onClose}:{commands:Command[];onClose:()=>void}){
 const [query,setQuery]=useState('');
 const [active,setActive]=useState(0);
 const input=useRef<HTMLInputElement>(null);
 const list=useRef<HTMLDivElement>(null);
 const results=useMemo(()=>{const q=normalize(query.trim());return q?commands.filter(c=>normalize(c.label+' '+c.group+' '+(c.hint||'')).includes(q)):commands},[commands,query]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;input.current?.focus();return()=>previous?.focus()},[]);
 useEffect(()=>setActive(0),[query]);
 useEffect(()=>{list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'})},[active]);
 function run(c?:Command){if(!c)return;onClose();c.run()}
 function key(e:KeyboardEvent){
  if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(results.length-1,a+1))}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1))}
  else if(e.key==='Enter'){e.preventDefault();run(results[active])}
  else if(e.key==='Escape'){e.preventDefault();onClose()}
  else if(e.key==='Tab')e.preventDefault();
 }
 let lastGroup='';
 return <div className="palette-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos" onKeyDown={key}>
   <div className="palette-search"><Search size={17}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar telas, ações ou rolos…" aria-label="Buscar comando" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[active]?'cmd-'+results[active].id:undefined}/><kbd>Esc</kbd></div>
   <div className="palette-list" id="palette-list" role="listbox" ref={list}>
    {results.map((c,i)=>{const header=c.group!==lastGroup;lastGroup=c.group;const Icon=c.icon;return <div key={c.id}>
     {header&&<div className="palette-group">{c.group}</div>}
     <div id={'cmd-'+c.id} role="option" aria-selected={i===active} data-index={i} className={'palette-item'+(i===active?' active':'')} onMouseMove={()=>setActive(i)} onClick={()=>run(c)}>
      <span className="palette-icon"><Icon size={16}/></span><span className="palette-label">{c.label}</span>{c.hint&&<span className="palette-hint">{c.hint}</span>}{i===active&&<CornerDownLeft size={14} className="palette-enter"/>}
     </div>
    </div>})}
    {!results.length&&<div className="palette-empty">Nenhum resultado para “{query}”.</div>}
   </div>
   <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div>
  </div>
 </div>;
}
