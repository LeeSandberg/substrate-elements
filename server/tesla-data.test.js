import {test} from 'node:test';import {strict as assert} from 'node:assert';import {parseDailyOHLCV,parseAlphaVantage,loadTeslaPrices,TSLA_PRICE_SOURCE} from './tesla-data.js';
const csv='Date,Open,High,Low,Close,Volume\n'+Array.from({length:31},(_,i)=>`2026-01-${String(i+1).padStart(2,'0')},1,2,1,${100+i},1000`).join('\n');
test('valid price series parses and sorts',()=>{const rows=parseDailyOHLCV(csv);assert.equal(rows.length,31);assert.equal(rows[0].close,100);});
test('rejects missing provider header',()=>assert.throws(()=>parseDailyOHLCV('not financial data')));
test('fixed URL, as-of date and source attribution',async()=>{const result=await loadTeslaPrices({fetchImpl:async(url)=>{assert.equal(url,TSLA_PRICE_SOURCE);return{ok:true,text:async()=>csv}}});assert.equal(result.points,31);assert.equal(result.asOf,'2026-01-31');assert.equal(result.ticker,'TSLA')});

test('403 explains missing authenticated provider',async()=>await assert.rejects(loadTeslaPrices({fetchImpl:async()=>({ok:false,status:403}),env:{}}),/ALPHA_VANTAGE_API_KEY/));
test('authenticated fallback returns dated Tesla prices',async()=>{
 const daily=Object.fromEntries(Array.from({length:31},(_,i)=>['2026-01-'+String(i+1).padStart(2,'0'),{'4. close':String(100+i)}]));
 let calls=0;
 const result=await loadTeslaPrices({env:{ALPHA_VANTAGE_API_KEY:'test-key'},fetchImpl:async url=>{calls++;if(calls===1)return{ok:false,status:403};assert.match(url,/apikey=test-key/);return{ok:true,json:async()=>({'Time Series (Daily)':daily})}}});
 assert.equal(result.points,31);assert.match(result.source,/Alpha Vantage/);
});
test('Alpha Vantage quota failure does not fabricate prices',()=>assert.throws(()=>parseAlphaVantage({Note:'quota exceeded'}),/no daily time series/));
