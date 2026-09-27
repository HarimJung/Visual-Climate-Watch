import type { Metadata } from 'next';
import './globals.css';
import {SiteHeader,SiteFooter} from '@/components/site/site-chrome';
import Animate from '@/components/site/animate';
import Jump from '@/components/site/jump';
export const metadata: Metadata = {title:'Visual Climate, The Paris Movement',description:'Explore the structure of climate promises, conditions, delivery, and evidence in an interactive 3D instrument.',icons:{icon:'/favicon.svg'},other:{'theme-color':'#f5f3ed'},openGraph:{title:'Visual Climate, The Paris Movement',description:'One calibre, every country: how a climate promise is built from its documents.',type:'website'}};
// Archivo for the voice, Atkinson Hyperlegible Next for the reading, Geist Mono
// for anything the engine measured. Every stack falls back to a local face.
const FONTS='https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=Atkinson+Hyperlegible+Next:wght@300..800&family=Geist+Mono:wght@400;500&display=swap';
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href={FONTS}/></head><body><SiteHeader/>{children}<SiteFooter/><Animate/><Jump/></body></html>}
