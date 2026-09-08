import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Visual Climate — The Paris Movement',description:'Explore the structure of climate promises, conditions, delivery, and evidence in an interactive 3D instrument.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body>{children}</body></html>}
