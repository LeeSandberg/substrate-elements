import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {recordingStatus} from './mcp.js';

test('confirmed record retains provenance identifiers without claiming proof',()=>{
 const r=recordingStatus({tool_result:{id:'tr_test'},evidence:{id:'e_test'}});
 assert.deepEqual(r,{recorded:true,mode:'recorded',toolResult:'tr_test',evidenceId:'e_test',verified:false});
});
test('missing MCP tool result never counts as recorded',()=>{
 const r=recordingStatus({evidence:{id:'e_orphan'}});
 assert.equal(r.recorded,false);assert.equal(r.mode,'missing-record-id');assert.equal(r.evidenceId,null);
});
test('null response fails closed',()=>assert.equal(recordingStatus(null).recorded,false));
