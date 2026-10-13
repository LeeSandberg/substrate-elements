import {test} from 'node:test';import {strict as assert} from 'node:assert';import {visibleEvents,TESLA_EVENTS,RESEARCH_INPUTS} from './tesla-events.js';
test('pre-release backtest cannot access future company event',()=>assert.equal(visibleEvents('2026-07-01').length,0));
test('event is only visible as of its publication date',()=>{assert.equal(visibleEvents('2026-07-02').length,1);assert.equal(visibleEvents('2026-07-22').length,2)});
test('every event has a dated source and URL',()=>{for(const e of TESLA_EVENTS){assert.match(e.availableAt,/^\d{4}-\d{2}-\d{2}$/);assert.match(e.url,/^https:\/\//)}});
test('macro inputs are declared planned, not fictitiously connected',()=>assert.ok(RESEARCH_INPUTS.some(x=>x.category==='macro'&&x.status.startsWith('Planned'))));
