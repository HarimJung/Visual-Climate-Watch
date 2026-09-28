import type {Metadata} from 'next';
import {loadView} from '@/lib/record';
import type {Census} from '@/lib/unknown';
import CopyFormat from '@/components/about/copy-format';

// Who is behind the record, so a journalist or a fund can cite it. The contact
// address and this record's own licence are not decided yet; they render as
// marked placeholders, never as an invented address. CAT is quoted only in the
// sentences docs/VERIFICATION.md §3 read from CAT's own pages on 2026-09-12.
export const metadata:Metadata={
 title:'Who makes this record · Visual Climate',
 description:'Visual Climate Org, a Canadian nonprofit in Toronto. How to cite a country record, how to report an error, and what this record is not.',
};

const FORMAT='Visual Climate. [Country]: climate record. Run [id], built [date]. Payload SHA-256 [hash]. [URL] (accessed [date]).';
const CAT='https://climateactiontracker.org';

export default async function Page(){
 const census=await loadView<Census>('census');
 return <main className="record about" id="main">
  <div className="rec-shell">
   <h1 className="rec-title">Who makes this record</h1>
   <p className="rec-lede">For every Party: the figures we read from its own filings, the document and hash behind each, and a stated reason for every figure we could not read.</p>

   <div className="ab-rows">
    <section aria-labelledby="who">
     <h2 id="who">Who</h2>
     <div><p>Visual Climate Org, a Canadian nonprofit in Toronto, builds and publishes this record.</p></div>
    </section>

    <section id="cite" aria-labelledby="cite-h">
     <h2 id="cite-h">How to cite</h2>
     <div>
      <p>Cite the country record you used, in this format:</p>
      <div className="rec-cite">
       <p>{FORMAT.split('SHA-256')[0]}<span className="ab-nowrap">SHA-256</span>{FORMAT.split('SHA-256')[1]}</p>
       <div className="rec-actions"><CopyFormat text={FORMAT}/></div>
      </div>
      <p className="rec-note">Every country record fills this in for you under Copy citation, for example <a href="/country/KHM">Cambodia</a>. The run ID and the hash identify the exact version you read.</p>
     </div>
    </section>

    <section id="corrections" aria-labelledby="corrections-h">
     <h2 id="corrections-h">Found an error in your country’s record?</h2>
     <div>
      <p>Send us the filing and the page the figure is on. We correct a record only from a filed document, never from an estimate.</p>
      <p className="ab-tbd">Contact address to be announced.</p>
     </div>
    </section>

    <section aria-labelledby="not-h">
     <h2 id="not-h">What this is not</h2>
     <div>
      <ul className="ab-list">
       <li><b>No ratings or rankings.</b> This record rates none of {census?`its ${census.countries} countries and territories`:'the countries it covers'}. Climate Action Tracker says it “tracks 34 countries and the EU covering around 85% of global emissions” and that “we rate each individual country’s pledge”.</li>
       <li><b>No estimated values.</b> Where a figure could not be read, the record leaves it blank and states why. Climate Action Tracker fills gaps by its published method, for example: “For non-CO2 agriculture emissions, we extend the last five years’ trend.”</li>
      </ul>
      <p className="rec-note">Quoted from Climate Action Tracker’s <a href={`${CAT}/about/`} target="_blank" rel="noreferrer">about page</a>, <a href={`${CAT}/methodology/cat-rating-methodology/`} target="_blank" rel="noreferrer">rating methodology</a> and <a href={`${CAT}/methodology/estimating-national-emissions/`} target="_blank" rel="noreferrer">emissions methodology</a>, read 2026-09-12.</p>
     </div>
    </section>

    <section aria-labelledby="licences-h">
     <h2 id="licences-h">Licences</h2>
     <div>
      <p>Each source keeps its own licence. The list is on <a href="/method#licences">How we read</a>.</p>
      <p className="ab-tbd">Licence for this record’s own text and data to be announced.</p>
     </div>
    </section>
   </div>
  </div>
 </main>;
}
