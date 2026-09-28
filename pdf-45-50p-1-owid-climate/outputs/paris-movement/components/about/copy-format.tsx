'use client';
import {useState} from 'react';
import {Copy} from 'lucide-react';

// navigator.clipboard is undefined outside a secure context; the promise wrap turns that into the failure message.
export default function CopyFormat({text}:{text:string}){
 const [msg,setMsg]=useState('');
 return <>
  <button type="button" className="rec-act" onClick={()=>{Promise.resolve().then(()=>navigator.clipboard.writeText(text))
   .then(()=>setMsg('Format copied'),()=>setMsg('Could not copy. Select the text above instead.'))}}><Copy size={15}/>Copy the format</button>
  <span className="rec-act-msg" role="status">{msg}</span>
 </>;
}
