// Curated, source-dated examples — not an automated macro/news feed.
// availableAt represents public release date, not the economic period measured.
export const TESLA_EVENTS=[
 {id:'tsla-q2-deliveries-2026',category:'company',availableAt:'2026-07-02',title:'Tesla Q2 2026 deliveries and energy storage',description:'Tesla reported 480,126 vehicle deliveries and 13.5 GWh of storage deployments for Q2 2026.',source:'Tesla Investor Relations',url:'https://ir.tesla.com/press-release/tesla-second-quarter-2026-production-deliveries-and-deployments',signal:'Unclassified; a reported operating metric is not a trading signal'},
 {id:'tsla-q2-financials-2026',category:'company',availableAt:'2026-07-22',title:'Tesla Q2 2026 financial results release',description:'Tesla published its Q2 2026 financial results. Metrics are not automatically scored or fed to the forecast.',source:'Tesla Investor Relations',url:'https://ir.tesla.com/press-release/tesla-releases-second-quarter-2026-financial-results',signal:'Not modeled'}
];
export const RESEARCH_INPUTS=[
 {category:'macro',name:'Federal funds / policy interest rate',source:'Federal Reserve / FRED (ALFRED vintages)',status:'Planned: requires dated observations and releases'},
 {category:'macro',name:'CPI inflation and unemployment',source:'BLS / FRED',status:'Planned: avoid using future revisions in backtests'},
 {category:'macro',name:'USD, Treasury yields, energy prices',source:'FRED and official markets',status:'Planned: align observation timestamps'},
 {category:'industry',name:'EV registrations, competitors and battery input costs',source:'Manufacturer and government releases',status:'Planned'},
 {category:'policy',name:'Tariffs, tax credits and EV regulation',source:'Official regulations and dated announcements',status:'Planned'},
 {category:'geopolitics',name:'Wars, military escalation, sanctions and trade restrictions',source:'Official statements, dated sanctions registers, corroborated news; mark event and publication timestamps',status:'Planned: impact hypotheses must be tested, not presumed'},
 {category:'geopolitics',name:'Conflict-related shipping disruption, commodities and supply-chain exposure',source:'Shipping indices, energy prices and supplier disclosures',status:'Planned: distinguish indirect effects from observed Tesla exposure'},
 {category:'company',name:'Tesla filings, margins, cash flow, delivery revisions',source:'SEC / Tesla IR',status:'Planned: point-in-time extraction'},
 {category:'regional',name:'Tesla Shanghai: China demand, local EV competition, output, exports and China-US/EU tariffs',source:'Tesla disclosures, China auto industry statistics, government trade notices',status:'Planned: Shanghai factory and China market tracked separately'},
 {category:'regional',name:'Tesla Berlin-Brandenburg: European production, labor, energy costs, EU demand and factory disruptions',source:'Tesla disclosures, German/EU official releases, reliable local reporting',status:'Planned: Berlin factory tracked separately'}
];
export function visibleEvents(asOf){if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw Error('Date must be YYYY-MM-DD');return TESLA_EVENTS.filter(x=>x.availableAt<=asOf)}
