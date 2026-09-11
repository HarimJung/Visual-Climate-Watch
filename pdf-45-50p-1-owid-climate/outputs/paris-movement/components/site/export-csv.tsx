'use client';
import {Download} from 'lucide-react';

/**
 * The view you are looking at, as a file. Every screen here is an argument
 * about numbers, and an argument you cannot take away and check is a poster.
 * The rows are the same objects the page rendered, so the download cannot
 * disagree with the screen.
 */
export default function ExportCsv({rows,name,label='Export view · CSV'}:{rows:Record<string,unknown>[];name:string;label?:string}){
 const save=()=>{
  if(!rows.length)return;
  const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const cell=(v:unknown)=>{
   const s=v==null?'':String(v);
   // A reason sentence carries commas and quotes; RFC 4180 or the file is a lie.
   return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  };
  const csv=[cols.join(','),...rows.map(r=>cols.map(c=>cell(r[c])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;a.download=`${name}.csv`;a.click();
  URL.revokeObjectURL(url);
 };
 return <button className="btn-ghost" onClick={save} type="button"><Download size={13}/>{label}</button>;
}
