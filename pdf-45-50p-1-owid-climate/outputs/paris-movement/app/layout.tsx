import type { Metadata } from 'next';
import './globals.css';
import {SiteHeader,SiteFooter} from '@/components/site/site-chrome';
import Animate from '@/components/site/animate';
import Jump from '@/components/site/jump';
export const metadata: Metadata = {title:'Visual Climate, the public record of Paris Agreement filings',description:'The public record of what each country actually filed under the Paris Agreement. Every figure is traced to the document it was read from, and every blank carries the reason it is blank.',icons:{icon:'/favicon.svg'},other:{'theme-color':'#f5f3ed'},openGraph:{title:'Visual Climate, the public record of Paris Agreement filings',description:'The public record of what each country actually filed under the Paris Agreement.',type:'website'}};
// One family for voice, reading and figures; a mono only for hashes and IDs.
// Every stack falls back to a local face.
const FONTS='https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300..700&family=Fragment+Mono&display=swap';
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href={FONTS}/></head><body><SiteHeader/>{children}<SiteFooter/><Animate/><Jump/></body></html>}
