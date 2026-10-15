const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('supabase/functions/manage-staff/handler.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('exports','module',compiled)(mod.exports,mod);
const {createStaffHandler}=mod.exports;
const school='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222',actor='33333333-3333-4333-8333-333333333333';
function fixture(overrides={}){
 const state={valid:true,admin:true,memberships:[{school_id:school,role:'teacher'}],profileError:false,emailError:false,...overrides};
 const writes=[];let serviceCalls=0;
 const chain=result=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>result,then:(r,j)=>Promise.resolve(result).then(r,j)};return q;};
 const userDb={auth:{getUser:async()=>({data:{user:state.valid?{id:actor,user_metadata:{role:'school_admin'}}:null},error:state.valid?null:{message:'bad token'}})},from:()=>chain({data:state.admin?{user_id:actor}:null,error:null})};
 const service={auth:{admin:{getUserById:async()=>({data:{user:{id:target,email:'teacher@example.com'}},error:null}),updateUserById:async(id,data)=>{writes.push({type:'auth',id,data});return {error:state.emailError?{message:'duplicate email'}:null};}}},from:table=>table==='school_memberships'?chain({data:state.memberships,error:null}):{...chain({data:{display_name:'ครูทดสอบ'},error:null}),upsert:async(data)=>{writes.push({type:'profile',data});return {error:state.profileError?{message:'failed'}:null};}}};
 const handler=createStaffHandler({userClient:()=>userDb,adminClient:()=>{serviceCalls++;return service;},origins:['https://moominoom.github.io']});
 const call=(body={},options={})=>handler(new Request('https://example.com/manage-staff',{method:options.method??'POST',headers:{...(options.auth===false?{}:{Authorization:'Bearer verified'}),Origin:options.origin??'https://moominoom.github.io'},...(options.method==='OPTIONS'||options.method==='GET'?{}:{body:JSON.stringify({action:'reset-password',school_id:school,user_id:target,...body})})}));
 return {state,writes,call,serviceCalls:()=>serviceCalls};
}
(async()=>{
 let f=fixture();assert.equal((await f.call({}, {auth:false})).status,401);assert.equal(f.serviceCalls(),0);
 f=fixture({valid:false});assert.equal((await f.call({password:'FakePass123'})).status,401);assert.equal(f.serviceCalls(),0);
 f=fixture({admin:false});assert.equal((await f.call({password:'FakePass123',actor_id:actor,role:'school_admin'})).status,403);assert.equal(f.serviceCalls(),0,'Forged metadata/body roles never authorize');
 f=fixture({memberships:[{school_id:'another-school',role:'teacher'}]});assert.equal((await f.call({password:'FakePass123'})).status,403);assert.equal(f.writes.length,0);
 f=fixture({memberships:[{school_id:school,role:'teacher'},{school_id:school,role:'school_admin'}]});assert.equal((await f.call({password:'FakePass123'})).status,403);
 f=fixture({memberships:[{school_id:school,role:'teacher'},{school_id:'other-school',role:'teacher'}]});assert.equal((await f.call({password:'FakePass123'})).status,409);assert.equal(f.writes.length,0,'No shared identity takeover');
 f=fixture();assert.equal((await f.call({password:'short'})).status,400);assert.equal((await f.call({password:'ก'.repeat(30)})).status,400);assert.equal(f.writes.length,0);
 const response=await f.call({password:'FakePass123',user_metadata:{role:'school_admin'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true});assert.deepEqual(f.writes,[{type:'auth',id:target,data:{password:'FakePass123'}}]);
 f=fixture();assert.equal((await f.call({action:'get-account'})).status,200);assert.equal(f.writes.length,0);
 f=fixture();assert.equal((await f.call({action:'update-profile',display_name:' ครูชื่อใหม่ ',email:'new@example.com',app_metadata:{role:'school_admin'}})).status,200);assert.deepEqual(f.writes,[{type:'auth',id:target,data:{email:'new@example.com'}},{type:'profile',data:{user_id:target,display_name:'ครูชื่อใหม่'}}]);
 f=fixture();assert.equal((await f.call({action:'update-profile',display_name:'ครูชื่อใหม่',email:'teacher@example.com'})).status,200);assert.equal(f.writes.length,1,'Unchanged email does not modify Auth');
 f=fixture({emailError:true});assert.equal((await f.call({action:'update-profile',display_name:'ครูชื่อใหม่',email:'duplicate@example.com'})).status,400);assert.equal(f.writes.length,1,'Email failure leaves profile unchanged');
 f=fixture({profileError:true});const partial=await f.call({action:'update-profile',display_name:'ครูชื่อใหม่',email:'new@example.com'});assert.equal(partial.status,500);assert.equal((await partial.json()).partial,true,'Report partial Auth/profile updates for retry');
 f=fixture();assert.equal((await f.call({password:'FakePass123'},{origin:'https://evil.example'})).status,403);assert.equal(f.serviceCalls(),0);assert.equal((await f.call({}, {method:'OPTIONS',auth:false})).status,204);assert.equal((await f.call({}, {method:'GET'})).status,405);
 f=fixture();assert.equal((await f.call({action:'grant-admin'})).status,400);assert.equal(f.writes.length,0);
 console.log('PASS: verified auth, live admin role, cross-school/protected-account denial, password validation, identity preservation, name/email updates, partial failures and CORS.');
})().catch(e=>{console.error(e);process.exitCode=1;});
