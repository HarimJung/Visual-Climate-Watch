import { ArrowUpRight, BookOpen, Database, FileCheck2, Globe2, Menu, Search, ShieldCheck, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

const nav = [
  ["Explore", "/"], ["Data query", "/query"], ["Compare", "/compare"], ["Verify", "/verify"], ["Forecast", "/forecast"], ["Policy & finance", "/policy"], ["Sources", "/sources"], ["Integrations", "/integrations"], ["Learn", "/learn"]
] as const;

export default function EditorialShell({ children, eyebrow = "VISUAL CLIMATE · SOURCE-CITED CLIMATE INTELLIGENCE" }: { children: React.ReactNode; eyebrow?: string }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return <div className="editorial-app"><header className="editorial-header"><Link href="/" className="editorial-brand"><span className="brand-mark">VC</span><span>Visual Climate</span></Link><nav className="editorial-nav">{nav.slice(0, 4).map(([label, href]) => <Link key={href} href={href} className={location === href ? "active" : ""}>{label}</Link>)}</nav><div className="editorial-tools"><button className="utility-button"><Search size={15} /> Search</button><Link href="/account" className="utility-link">Account <ArrowUpRight size={13} /></Link><button onClick={() => setOpen(!open)} className="mobile-menu" aria-label="Open menu">{open ? <X size={19} /> : <Menu size={19} />}</button></div></header>{open && <div className="mobile-panel">{nav.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={location === href ? "active" : ""}>{label}</Link>)}</div>}<div className="editorial-layout"><aside className="editorial-rail"><div className="rail-label">ANALYSIS INDEX</div>{nav.map(([label, href], index) => <Link key={href} href={href} className={location === href ? "active" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{label}</Link>)}<div className="rail-method"><ShieldCheck size={16} /><strong>Evidence first</strong><p>Every value carries a source, condition, and comparability state.</p><Link href="/learn">Read the method <ArrowUpRight size={13} /></Link></div></aside><main className="editorial-main"><div className="editorial-eyebrow">{eyebrow}</div>{children}</main></div><footer className="editorial-footer"><span>Visual Climate · research workspace</span><span><Database size={13} /> 55 tracked sources</span><span><FileCheck2 size={13} /> provenance on</span><span><BookOpen size={13} /> learn as you explore</span></footer></div>;
}
