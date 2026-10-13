import {test} from 'node:test';import {strict as assert} from 'node:assert';import {parseDailyOHLCV,loadTeslaPrices,TSLA_PRICE_SOURCE} from './tesla-data.js';
const csv='Date,Open,High,Low,Close,Volume\n'+Array.from({length:31},(_,i)=>`2026-01-${String(i+1).padStart(2,'0')},1,2,1,${100+i},1000`).join('\n');
test('valid price series parses and sorts',()=>{const rows=parseDailyOHLCV(csv);assert.equal(rows.length,31);assert.equal(rows[0].close,100);});
test('rejects missing provider header',()=>assert.throws(()=>parseDailyOHLCV('not financial data')));
test('fixed URL, as-of date and source attribution',async()=>{const result=await loadTeslaPrices({fetchImpl:async(url)=>{assert.equal(url,TSLA_PRICE_SOURCE);return{ok:true,text:async()=>csv}}});assert.equal(result.points,31);assert.equal(result.asOf,'2026-01-31');assert.equal(result.ticker,'TSLA')});
test('fails closed when provider unavailable',async()=>await assert.rejects(loadTeslaPrices({fetchImpl:async()=>({ok:false,status:403})}),/403/));
