import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export function configured(){return Boolean(process.env.SUBSTRATE_MCP_URL&&process.env.SUBSTRATE_MCP_BEARER&&process.env.SUBSTRATE_WORKSPACE_ID)}
export function recordingStatus(result){
  const toolResult=result?.tool_result?.id;
  const evidenceId=result?.evidence?.id;
  return toolResult
    ? {recorded:true,mode:'recorded',toolResult,evidenceId:evidenceId||null,verified:false}
    : {recorded:false,mode:'missing-record-id',toolResult:null,evidenceId:null,verified:false};
}
async function invoke(name,args){
  if(!configured())throw Error('MCP not configured');
  const url=new URL(process.env.SUBSTRATE_MCP_URL);
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('HTTPS required');
  const client=new Client({name:'substrate-elements',version:'0.4.0'});
  const transport=new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:'Bearer '+process.env.SUBSTRATE_MCP_BEARER}}});
  try{
    await client.connect(transport);
    const r=await client.callTool({name,arguments:{workspace_id:process.env.SUBSTRATE_WORKSPACE_ID,...args}});
    if(r.isError)throw Error('Substrate MCP tool error: '+name);
    if(r.structuredContent)return r.structuredContent.result??r.structuredContent;
    const raw=r.content?.find(x=>x.type==='text')?.text;
    if(!raw)throw Error('Empty Substrate MCP response');
    try{return JSON.parse(raw)}catch{throw Error('Invalid JSON Substrate MCP response')}
  }finally{await client.close()}
}
export async function checkSubstrate(){
  if(!configured())return {configured:false,connected:false,error:'not-configured'};
  try{await invoke('secure_observe',{});return {configured:true,connected:true,workspaceId:process.env.SUBSTRATE_WORKSPACE_ID}}
  catch(e){return {configured:true,connected:false,error:String(e.message).slice(0,180)}}
}
export async function recordToSubstrate(payload){
  if(!configured())return {recorded:false,mode:'not-configured',verified:false};
  const result=await invoke('record_tool_result',{tool_name:'substrate-elements.agent-run',payload,observation:'Application-reported agent output. Not independently verified.'});
  return recordingStatus(result);
}
export const createCapsule=subject=>invoke('create_evidence_capsule',{subject,policy:'accepted_and_observed'});
export const verifyCapsule=capsule_id=>invoke('verify_evidence_capsule',{capsule_id});
export const quarantineCapsule=capsule=>invoke('submit_capsule',{capsule});
export const inspectWorkspace=()=>invoke('secure_observe',{});

// A challenge is an untrusted proposal until separately reviewed by an authorized reviewer.
export const proposeChallenge=(target_id,counter_evidence_id,rationale)=>invoke('propose_evidence_challenge',{target_id,counter_evidence_id,rationale});
