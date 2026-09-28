import type {Metadata} from 'next';
export const metadata:Metadata={title:'Page not found · Visual Climate'};

// Short, and two ways out: the country search, where most wrong addresses were
// headed, and home.
export default function NotFound(){
 return <main className="record" id="main">
  <div className="rec-shell">
   <h1 className="rec-title">There is no page at this address<span className="rec-stop">.</span></h1>
   <p className="rec-lede">A country record lives at its three-letter code, like <code>/country/KHM</code>. Search by name instead.</p>
   <nav className="claim-ways" aria-label="Where to go instead">
    <a className="way primary" href="/countries">Find a country</a>
    <a className="way" href="/">Home</a>
   </nav>
  </div>
 </main>;
}
