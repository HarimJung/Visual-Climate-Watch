'use client';
import {Printer} from 'lucide-react';

// The print stylesheet in app/styles/teach-about.css turns the page into the participants' task sheet.
export default function PrintButton(){
 return <button type="button" className="rec-act" onClick={()=>print()}><Printer size={15}/>Print the task sheet</button>;
}
