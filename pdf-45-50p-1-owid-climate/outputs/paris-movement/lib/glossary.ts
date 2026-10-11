// Plain .ts, no JSX, no runtime imports: tests/glossary.test.ts loads it under plain node.

/**
 * The words the studio prints that a reader may not carry in their head. Each
 * entry is the term spelled out and one fixed sentence (two at most) with the
 * meaning the UNFCCC gives it. Read by components/studio/term.tsx. No digits,
 * no judgement, no em dash: the test pins all three.
 */
export const GLOSSARY:Record<string,{term:string;def:string}>={
 'NDC':{term:'Nationally Determined Contribution',def:'The climate plan each Party submits under the Paris Agreement, with its emissions target and the actions it intends to take.'},
 'NDC 3.0':{term:'The third round of NDCs',def:'The Nationally Determined Contributions Parties submit after the first global stocktake, each meant to go further than the plan before it.'},
 'BTR':{term:'Biennial Transparency Report',def:'The report a Party submits every two years under the Paris Agreement, covering its emissions, its progress on its NDC and the support it gave or received.'},
 'CTF':{term:'Common tabular formats',def:'The standard tables in a transparency report that track progress on the NDC and the finance, technology and capacity building provided, needed and received.'},
 'CRT':{term:'Common reporting tables',def:'The standard tables in which a Party reports its greenhouse gas inventory under the Paris Agreement.'},
 'NIR':{term:'National inventory report',def:'The document that explains how a Party estimated its greenhouse gas emissions and removals, sent with its inventory tables.'},
 'REDD+':{term:'REDD+',def:'Reducing emissions from deforestation and forest degradation in developing countries, together with conservation, sustainable forest management and the growth of forest carbon stocks.'},
 'Article 6':{term:'Article 6 of the Paris Agreement',def:'The article that lets Parties cooperate on their targets, including by transferring emission reductions from one Party to another.'},
 'FOLU':{term:'Forestry and other land use',def:'Emissions and removals from forests and land, including land that changes from one use to another.'},
 'LULUCF':{term:'Land use, land-use change and forestry',def:'The inventory sector for emissions and removals from land, from changes in its use and from forests. LUCF is an older name for the same sector.'},
 'BAU':{term:'Business as usual',def:'A projection of emissions if no new policies were adopted. Some Parties state their target as a cut below this projection.'},
 'base year':{term:'Base year',def:'The past year a target is measured against: the cut is stated as a share of that year’s emissions.'},
 'economy-wide':{term:'Economy-wide target',def:'A target that covers emissions from every sector of the economy, not only selected sectors or gases.'},
 'conditional':{term:'Conditional',def:'A target the Party says it will reach only if a condition is met, usually support such as finance, technology or capacity building. Where a filing states both, the conditional figure is the whole cut with the condition met, not the part added on top.'},
 'unconditional':{term:'Unconditional',def:'A target the Party commits to reach with its own means, whatever support arrives.'},
 'net zero':{term:'Net zero',def:'The point at which the greenhouse gases a Party emits are balanced by the gases it removes from the atmosphere.'},
 'mitigation':{term:'Mitigation',def:'Action that cuts greenhouse gas emissions or increases their removal from the atmosphere.'},
 'adaptation':{term:'Adaptation',def:'Action that reduces harm from the effects of climate change, present or expected.'},
 'ND-GAIN':{term:'Notre Dame Global Adaptation Initiative index',def:'A university index of a country’s vulnerability to climate change and its readiness to adapt. It is not a UNFCCC measure.'},
 'GCF':{term:'Green Climate Fund',def:'The fund set up under the UNFCCC to pay for mitigation and adaptation in developing countries.'},
 'co-financing':{term:'Co-financing',def:'Money a project raises from other sources alongside the fund’s own approval.'},
 'SSP':{term:'Shared Socioeconomic Pathway',def:'A scenario of how population, economy and emissions may develop, paired with a level of warming pressure by the end of the century. Climate models are run against each one.'},
 'CMIP6':{term:'Coupled Model Intercomparison Project, sixth phase',def:'The shared set of climate model runs that the IPCC assesses.'},
 'anomaly':{term:'Temperature anomaly',def:'The difference between a temperature and its average over a reference period, called the baseline.'},
 'GWP100':{term:'Global warming potential over a hundred years',def:'The factor that converts a gas into carbon dioxide equivalent. The Paris Agreement’s reporting rules use it.'},
 'MtCO2e':{term:'Million tonnes of carbon dioxide equivalent',def:'Each gas is converted, by its global warming potential, into the amount of carbon dioxide that would warm as much.'},
 'inventory':{term:'Greenhouse gas inventory',def:'A Party’s account of its greenhouse gas emissions and removals, year by year and sector by sector, prepared with IPCC methods.'},
 'Party':{term:'Party',def:'A country or regional organisation that has joined the UNFCCC or the Paris Agreement.'},
 'registry':{term:'NDC registry',def:'The UNFCCC’s public registry where the NDCs Parties submit are posted.'},
 'mirror':{term:'Mirror',def:'A copy of a public document kept beside the record, so the same file can be checked later even if the original moves.'},
 'sha256':{term:'SHA-256 fingerprint',def:'A fingerprint computed from a file’s bytes. If one byte changes the fingerprint changes, so anyone can confirm the file is the one cited.'},
 'provenance':{term:'Provenance',def:'Where each figure came from: the file, its address, when it was retrieved and the fingerprint of its bytes.'},
};
