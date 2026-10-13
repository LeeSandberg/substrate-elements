import http from 'node:http';
import {loadTeslaPrices} from './tesla-data.js';
import {visibleEvents,RESEARCH_INPUTS} from './tesla-events.js';
import {createRun,emit,safeDemoAnswer,validatePlan} from './engine.js';
import {runModelAgent} from './provider.js';
import {configured,checkSubstrate,recordToSubstrate,createCapsule,verifyCapsule,quarantineCapsule,inspectWorkspace} from './mcp.js';

const runs=new Map(),listeners=new Map();
const reviewKey=process.env.REVIEW_API_KEY;
const safe=(e)=>String(e?.message||e).slice(0,400);
function respond(res,status,object){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(object))}
async function readBody(req){let s='';for await(const part of req){s+=part;if(s.length>131072)throw Error('Request too large')}return JSON.parse(s||'{}')}
function publish(run,type,data={}){const e=emit(run,type,data);for(const r of listeners.get(run.id)||[])r.write('data: '+JSON.stringify(e)+'\n\n');return e}
function flattened(steps,parentId=null){return steps.flatMap(s=>[{...s,parentId},...(s.children?flattened(s.children,s.id):[])])}
function authorized(req){return !reviewKey||req.headers['x-review-key']===reviewKey}
async function runAgent(step,context){
  if(process.env.RUNNER_MODE==='openai-compatible')return runModelAgent(step,context);
  if(process.env.RUNNER_MODE!=='webhook')return safeDemoAnswer(step,context);
  if(!process.env.AGENT_RUNNER_URL)throw Error('AGENT_RUNNER_URL required');
  const url=new URL(process.env.AGENT_RUNNER_URL);
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('HTTPS required for external agent runner');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.AGENT_RUNNER_BEARER?{Authorization:'Bearer '+process.env.AGENT_RUNNER_BEARER}:{})},signal:controller.signal,body:JSON.stringify({step:{id:step.id,role:step.role,prompt:step.prompt},context})});
    if(!r.ok)throw Error('Runner HTTP '+r.status);
    const output=await r.json();
    if(typeof output.answer!=='string'||output.answer.length>20000||!Array.isArray(output.evidence))throw Error('Invalid runner response');
    return {answer:output.answer,verified:false,evidence:output.evidence.slice(0,20).map(x=>({kind:String(x.kind||'external').slice(0,80),source:String(x.source||'').slice(0,600),summary:String(x.summary||'').slice(0,1500)}))};
  }finally{clearTimeout(timeout)}
}
async function execute(run){
  if(run.status!=='running')return;
  while(run.cursor<run.queue.length){
    const step=run.queue[run.cursor++];
    if(step.type==='review'){run.status='awaiting_review';run.pendingReview={id:step.id,label:step.label};publish(run,'review_required',{stepId:step.id,label:step.label});return}
    publish(run,'agent_started',{stepId:step.id,role:step.role,parentId:step.parentId});
    try{
      const output=await runAgent(step,run.results.slice(-8));
      const synthetic=!['openai-compatible','webhook'].includes(process.env.RUNNER_MODE);
      let recording={recorded:false,mode:'not-configured',verified:false};
      if(configured()){try{recording=await recordToSubstrate({stepId:step.id,role:step.role,answer:output.answer,synthetic,runId:run.id})}catch(e){recording={recorded:false,mode:'error',verified:false,error:safe(e)}}}
      const result={stepId:step.id,role:step.role,answer:output.answer,synthetic,evidence:output.evidence||[],recording};
      run.results.push(result);publish(run,'agent_completed',result);
    }catch(e){run.status='failed';publish(run,'agent_failed',{stepId:step.id,error:safe(e)});return}
  }
  run.status='completed';publish(run,'completed',{answer:run.results.at(-1)?.answer||''});
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');const p=url.pathname.split('/').filter(Boolean);
    if(req.method==='GET'&&url.pathname==='/api/market/tesla-events'){const asOf=url.searchParams.get('asOf')||'2026-10-13';return respond(res,200,{asOf,events:visibleEvents(asOf),researchInputs:RESEARCH_INPUTS,note:'Curated sourced company events only; macro and geopolitical feeds are not connected.'})}
    if(req.method==='GET'&&url.pathname==='/api/market/tesla-history'){try{return respond(res,200,await loadTeslaPrices())}catch(e){return respond(res,502,{error:'Tesla price data unavailable: '+safe(e)})}}
    if(req.method==='GET'&&url.pathname==='/api/health')return respond(res,200,{ok:true,mode:process.env.RUNNER_MODE||'demo',substrate:configured()});
    if(req.method==='GET'&&url.pathname==='/api/substrate/health')return respond(res,200,await checkSubstrate());
    if(req.method==='POST'&&url.pathname==='/api/runs'){
      const plan=validatePlan(await readBody(req));const run=createRun(plan);run.queue=flattened(plan.steps);run.cursor=0;runs.set(run.id,run);
      setImmediate(()=>execute(run));return respond(res,201,{id:run.id,status:run.status});
    }
    if(p[0]!=='api'||p[1]!=='runs'||!runs.has(p[2]))return respond(res,404,{error:'Not found'});
    const run=runs.get(p[2]);
    if(req.method==='GET'&&p.length===3)return respond(res,200,run);
    if(req.method==='GET'&&p[3]==='export')return respond(res,200,{format:'substrate-elements-trace/0.3',runId:run.id,status:run.status,events:run.events,provenance:'Application-side events; not verified Substrate audit history'});
    if(req.method==='GET'&&p[3]==='events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      res.write('data: '+JSON.stringify({type:'snapshot',events:run.events,status:run.status})+'\n\n');
      let set=listeners.get(run.id);if(!set){set=new Set();listeners.set(run.id,set)}set.add(res);req.on('close',()=>set.delete(res));return;
    }
    if(req.method==='POST'&&p[3]==='review'){
      if(!authorized(req))return respond(res,403,{error:'Reviewer authorization required'});
      if(run.status!=='awaiting_review')return respond(res,409,{error:'No review pending'});
      const body=await readBody(req);if(typeof body.approve!=='boolean')return respond(res,400,{error:'approve boolean required'});
      publish(run,'human_review',{stepId:run.pendingReview.id,decision:body.approve?'approved':'rejected',authentication:reviewKey?'shared-secret':'demo-unverified',note:String(body.note||'').slice(0,1000)});
      run.pendingReview=null;run.status=body.approve?'running':'rejected';
      if(body.approve)setImmediate(()=>execute(run));return respond(res,200,{status:run.status});
    }
    if(req.method==='POST'&&(p[3]==='approve'||p[3]==='reject')){
      if(!authorized(req))return respond(res,403,{error:'Reviewer authorization required'});
      if(run.status!=='awaiting_review')return respond(res,409,{error:'No review pending'});
      const b=await readBody(req);publish(run,'human_review',{stepId:run.pendingReview.id,decision:p[3],note:String(b.note||'').slice(0,1000),authentication:reviewKey?'shared-secret':'demo-unverified'});
      run.pendingReview=null;run.status=p[3]==='approve'?'running':'rejected';if(run.status==='running')setImmediate(()=>execute(run));
      return respond(res,200,run);
    }
    if(req.method==='POST'&&p[3]==='capsule'&&p.length===4){
      if(!configured())return respond(res,503,{error:'MCP not configured'});
      const result=await createCapsule('Agent run '+run.id+' outputs');run.capsule_id=result.capsule_id;
      publish(run,'capsule_created',{capsuleId:result.capsule_id});return respond(res,200,result);
    }
    if(req.method==='GET'&&p[3]==='capsule'&&p[4]==='verify')return respond(res,200,await verifyCapsule(run.capsule_id));
    if(req.method==='POST'&&p[3]==='capsule'&&p[4]==='import'){
      if(!authorized(req))return respond(res,403,{error:'Reviewer authorization required'});
      const b=await readBody(req);return respond(res,200,await quarantineCapsule(b.capsule));
    }
    if(req.method==='GET'&&p[3]==='observe')return respond(res,200,await inspectWorkspace());
    return respond(res,404,{error:'Not found'});
  }catch(e){respond(res,400,{error:safe(e)})}
});
server.listen(Number(process.env.PORT||8789),'127.0.0.1',()=>console.log('Substrate Elements backend ready'));
