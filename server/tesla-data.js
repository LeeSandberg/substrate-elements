// Fixed Tesla symbol only; data providers may restrict automated access.
// Price values are unadjusted daily closes, never described as exchange-certified.
export const TSLA_PRICE_SOURCE='https://stooq.com/q/d/l/?s=tsla.us&i=d';
const ALPHA_URL='https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=TSLA&outputsize=compact';
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
 return normalizeRows(rows,maxRows);
}
function normalizeRows(rows,maxRows){
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 const unique=rows.filter((r,i)=>i===0||r.date!==rows[i-1].date);
 if(unique.length<30)throw Error('Historical-price provider returned too few valid daily observations');
 return unique.slice(-maxRows);
}
export function parseAlphaVantage(json){
 const series=json?.['Time Series (Daily)'];
 if(!series||typeof series!=='object')throw Error('Alpha Vantage returned no daily time series (check API key, quota, or plan)');
 return normalizeRows(Object.entries(series).map(([date,values])=>({date,close:Number(values?.['4. close'])})).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(x.close)&&x.close>0),750);
}
function response(rows,source,sourceUrl){
 return {ticker:'TSLA',company:'Tesla, Inc.',source,sourceUrl,asOf:rows.at(-1).date,firstDate:rows[0].date,points:rows.length,prices:rows.map(x=>x.close),dates:rows.map(x=>x.date),adjustments:'Unadjusted daily closes; dividends/splits not modeled; provider values not independently verified'};
}
export async function loadTeslaPrices({fetchImpl=fetch,env=process.env}={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  // Try the documented Stooq URL first; HTTP 403 is common and is not a fatal application error.
  let stooqError='unavailable';
  try{
   const r=await fetchImpl(TSLA_PRICE_SOURCE,{headers:{Accept:'text/csv','User-Agent':'Substrate-Elements-Research-Demo/0.4'},signal:controller.signal});
   if(!r.ok)throw Error('HTTP '+r.status);
   const csv=await r.text();
   if(csv.length>4000000)throw Error('Response exceeded size limit');
   return response(parseDailyOHLCV(csv),'Stooq daily historical CSV',TSLA_PRICE_SOURCE);
  }catch(e){stooqError=String(e.message||e)}
  if(!env.ALPHA_VANTAGE_API_KEY)throw Error('Stooq '+stooqError+'; set ALPHA_VANTAGE_API_KEY for authenticated fallback, or import CSV');
  const url=ALPHA_URL+'&apikey='+encodeURIComponent(env.ALPHA_VANTAGE_API_KEY);
  const r=await fetchImpl(url,{headers:{Accept:'application/json'},signal:controller.signal});
  if(!r.ok)throw Error('Alpha Vantage HTTP '+r.status+' after Stooq '+stooqError);
  const data=await r.json();
  const rows=parseAlphaVantage(data);
  return response(rows,'Alpha Vantage TIME_SERIES_DAILY (API key; unadjusted close)',ALPHA_URL);
 }finally{clearTimeout(timeout)}
}
