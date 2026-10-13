import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {validatePlan} from './engine.js';

test('plain HTML contains recursive agents and human review',()=>{
 const html=readFileSync(new URL('../examples/plain-html.html',import.meta.url),'utf8');
 for(const term of ['substrate-flow','agent-step','agent-prompt','human-review'])assert.ok(html.includes(term));
});
test('equivalent plan validates',()=>{
 const plan={steps:[{id:'a',type:'agent',role:'researcher',prompt:'Check',children:[{id:'b',type:'agent',role:'critic',prompt:'Challenge'}]},{id:'r',type:'review',label:'Approve'}]};
 assert.equal(validatePlan(plan),plan);
});
