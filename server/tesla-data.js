// Fixed-symbol research data adapter. No arbitrary URL or ticker from the browser.
export const TSLA_PRICE_SOURCE='https://stooq.com/q/d/l/?s=tsla.us&i=d';
export function parseDailyOHLCV(csv,{maxRows=750}={}){
 const lines=String(csv).trim().split(/\r?\n/);
 if(!/^Date,Open,High,Low,Close,Volume\r?$/i.test(lines[0]?.trim()))throw Error('Unexpected historical-price CSV header');
 const rows=[];
 for(const line of lines.slice(1)){
  const cells=line.split(',');
  if(cells.length!==6)continue;
  const date=cells[0],close=Number(cells[4]);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(close)||close<=0)continue;
  rows.push({date,close});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 const unique=rows.filter((r,i)=>i===0||r.date!==rows[i-1].date);
 if(unique.length<30)throw Error('Historical-price provider returned too few valid daily observations');
 return unique.slice(-maxRows);
}
export async function loadTeslaPrices({fetchImpl=fetch}={}){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetchImpl(TSLA_PRICE_SOURCE,{headers:{'Accept':'text/csv','User-Agent':'Substrate-Elements-Research-Demo/0.4'},signal:controller.signal});
  if(!response.ok)throw Error('Historical data provider HTTP '+response.status);
  const csv=await response.text();
  if(csv.length>4000000)throw Error('Provider response exceeded size limit');
  const rows=parseDailyOHLCV(csv);
  return {ticker:'TSLA',company:'Tesla, Inc.',source:'Stooq historical daily CSV (third-party, not exchange-certified)',sourceUrl:TSLA_PRICE_SOURCE,asOf:rows.at(-1).date,firstDate:rows[0].date,points:rows.length,prices:rows.map(x=>x.close),dates:rows.map(x=>x.date),adjustments:'Provider price adjustments and corporate-action handling not independently verified'};
 }finally{clearTimeout(timeout)}
}
