import type { Metadata } from 'next';
import './globals.css';
import {SiteHeader,SiteFooter} from '@/components/site/site-chrome';
export const metadata: Metadata = {title:'Visual Climate, The Paris Movement',description:'Explore the structure of climate promises, conditions, delivery, and evidence in an interactive 3D instrument.',icons:{icon:'/favicon.svg'},openGraph:{title:'Visual Climate, The Paris Movement',description:'One calibre, every country: how a climate promise is built from its documents.',type:'website'}};
// Instrument Serif for the readings, Geist for the interface, Geist Mono for
// anything the engine measured. Every stack falls back to a local face.
const FONTS='https://fonts.googleapis.com/css2?family=Geist:wght@300..900&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap';
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href={FONTS}/></head><body><SiteHeader/>{children}<SiteFooter/></body></html>}
