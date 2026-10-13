import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createRun,emit,safeDemoAnswer,validatePlan} from './engine.js';
import {runModelAgent} from './provider.js';
import {configured,checkSubstrate,recordToSubstrate,createCapsule,verifyCapsule,quarantineCapsule,inspectWorkspace,proposeChallenge} from './mcp.js';

const runs=new Map(),listeners=new Map();
const incidentSessions=new Map();
const INCIDENT_FIXTURE=Object.freeze({id:'incident-1042',title:'Production API outage after deployment',evidence:[{id:'db',source:'fixture://incident-1042/db-monitoring',observation:'PostgreSQL health checks succeeded during the outage; application logs contain timeouts.'},{id:'auth',source:'fixture://incident-1042/auth-audit',observation:'An authorization policy changed immediately before requests began receiving HTTP 403 responses.'}],note:'Synthetic, labeled incident fixtures; NOT real production logs.'});
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
    if(req.method==='GET'&&url.pathname==='/api/health')return respond(res,200,{ok:true,mode:process.env.RUNNER_MODE||'demo',substrate:configured()});
    if(req.method==='GET'&&url.pathname==='/api/substrate/health')return respond(res,200,await checkSubstrate());
    if(req.method==='GET'&&url.pathname==='/api/investigation/fixture')return respond(res,200,INCIDENT_FIXTURE);
    if(req.method==='POST'&&url.pathname==='/api/investigation/start'){
      if(!reviewKey||!authorized(req))return respond(res,403,{error:'Set REVIEW_API_KEY and authenticate to run the investigation'});
      if(!configured())return respond(res,503,{error:'Substrate MCP is not configured; this demo cannot simulate evidence recording'});
      const health=await checkSubstrate();
      if(!health.connected)return respond(res,503,{error:'Substrate MCP disconnected: '+(health.error||'unknown')});
      const id=randomUUID();
      const first=await recordToSubstrate({incidentId:INCIDENT_FIXTURE.id,fixture:true,source:INCIDENT_FIXTURE.evidence[0].source,observation:INCIDENT_FIXTURE.evidence[0].observation,claim:'Database is root cause — unverified hypothesis'});
      if(!first.recorded||!first.evidenceId)return respond(res,502,{error:'No confirmed Substrate evidence ID from first recording'});
      const session={id,stage:'initial',evidence:[{fixtureId:'db',...first}],challenge:null,capsule:null,createdAt:new Date().toISOString()};
      incidentSessions.set(id,session);return respond(res,201,session);
    }
    if(req.method==='POST'&&p[0]==='api'&&p[1]==='investigation'&&p[2]&&p[3]==='challenge'){
      if(!reviewKey||!authorized(req))return respond(res,403,{error:'Reviewer credential required'});
      const session=incidentSessions.get(p[2]);if(!session)return respond(res,404,{error:'Investigation not found'});
      if(session.stage!=='initial')return respond(res,409,{error:'Challenge already submitted'});
      const second=await recordToSubstrate({incidentId:INCIDENT_FIXTURE.id,fixture:true,source:INCIDENT_FIXTURE.evidence[1].source,observation:INCIDENT_FIXTURE.evidence[1].observation,claim:'Authentication policy change is an alternative hypothesis'});
      if(!second.recorded||!second.evidenceId)return respond(res,502,{error:'No confirmed counter-evidence ID'});
      session.evidence.push({fixtureId:'auth',...second});
      const result=await proposeChallenge(session.evidence[0].evidenceId,second.evidenceId,'Database root-cause claim is contested by healthy DB probes and HTTP 403 authorization evidence. Synthetic teaching fixture.');
      session.challenge={status:'submitted-not-approved',result};session.stage='challenged';
      return respond(res,200,session);
    }
    if(req.method==='POST'&&p[0]==='api'&&p[1]==='investigation'&&p[2]&&p[3]==='capsule'){
      if(!reviewKey||!authorized(req))return respond(res,403,{error:'Reviewer credential required'});
      const session=incidentSessions.get(p[2]);if(!session)return respond(res,404,{error:'Investigation not found'});
      const result=await createCapsule('Investigation '+INCIDENT_FIXTURE.id+' synthetic evidence');
      session.capsule=result;return respond(res,200,{capsule:result,note:'Workspace capsule may include other workspace evidence; inspect scope and policy'});
    }
    if(req.method==='GET'&&p[0]==='api'&&p[1]==='investigation'&&p[2]&&p[3]==='handoff'){
      if(!reviewKey||!authorized(req))return respond(res,403,{error:'Reviewer credential required'});
      const session=incidentSessions.get(p[2]);if(!session)return respond(res,404,{error:'Investigation not found'});
      // A new MCP call reads the shared workspace; no previous agent conversation is supplied.
      const observed=await inspectWorkspace();
      return respond(res,200,{sessionId:session.id,reconstructedFrom:'Fresh Substrate MCP observation, not the prior agent context',observed,agentReplaced:false,note:'This verifies shared-state retrieval; an independently launched replacement AI agent is not yet wired.'});
    }

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
