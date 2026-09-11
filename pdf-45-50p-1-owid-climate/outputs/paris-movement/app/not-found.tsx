import type {Metadata} from 'next';
export const metadata:Metadata={title:'No such record, Visual Climate'};

// A 404 in the product's own voice: a page it does not have is an unknown,
// not a fault in the reader, and it says where the known things are.
export default function NotFound(){
 return <main className="record" id="main">
  <div className="rec-shell">
   <p className="eyebrow">Nothing at this address</p>
   <h1 className="rec-title">This is a page the engine does not hold<span className="rec-stop">.</span></h1>
   <p className="rec-lede">A country is addressed by its ISO3 code, <code>/country/KEN</code>, and only the 218 the engine has built resolve. Nothing is substituted for one it has not.</p>
   <nav className="claim-ways" aria-label="Where to go instead">
    <a className="way primary" href="/countries">Browse the 218 records</a>
    <a className="way" href="/unknown">See what we do not know</a>
    <a className="way" href="/">The instrument</a>
   </nav>
  </div>
 </main>;
}
