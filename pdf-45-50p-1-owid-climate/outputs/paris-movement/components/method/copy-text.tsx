'use client';
import {useState} from 'react';
import {Check,Copy} from 'lucide-react';

/** Copies one API address, with this site's origin in front, so it pastes as a working URL. */
export default function CopyText({path}:{path:string}){
 const [msg,setMsg]=useState('');
 const copy=()=>navigator.clipboard.writeText(location.origin+path)
  .then(()=>setMsg('Copied'),()=>setMsg('Select the address to copy it'));
 return <button type="button" className="mc-copy" onClick={copy} onBlur={()=>setMsg('')} aria-label={`Copy ${path}`}>
  {msg==='Copied'?<Check size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}
  <span aria-live="polite">{msg||'Copy'}</span>
 </button>;
}
