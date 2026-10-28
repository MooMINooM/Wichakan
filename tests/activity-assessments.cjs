const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {activityGroups,activityPeriod,activitySummary}=require('../src/lib/activity-assessments.ts');
const rooms=[{id:'p',academic_year_id:'y',level_code:'ป.5'},{id:'m',academic_year_id:'y',level_code:'ม.1'}],terms=[{id:'t1',academic_year_id:'y',term_no:1},{id:'t2',academic_year_id:'y',term_no:2},{id:'old',academic_year_id:'old-year',term_no:1}];
const sc=(id,room,term,kind='club',teacher=null)=>({id,school_id:'school',classroom_id:room,term_id:term,activity_type:kind,teacher_user_id:teacher});
const schedules=[sc('p1','p','t1'),sc('p2','p','t2'),sc('p-duplicate','p','t1'),sc('m1','m','t1','guidance','owner'),sc('computing','p','t1','computing'),sc('wrong-year','p','old','guidance')];
let groups=activityGroups(schedules,rooms,terms);assert.equal(groups.length,3);assert.equal(groups.filter(g=>g.classroom_id==='p').length,1);assert.deepEqual(groups.filter(g=>g.classroom_id==='m').map(g=>g.period_no),[1,2]);assert.equal(activityPeriod('ป.1',2),0);assert.equal(activityPeriod('ม.1',2),2);
// Current-term assignments override fallback from the same school year.
assert.equal(activityGroups(schedules,rooms,terms,{userId:'owner',admin:false,homeroomRoomIds:new Set()}).length,2);
groups=activityGroups([...schedules,sc('m2','m','t2','guidance','new-owner')],rooms,terms,{userId:'owner',admin:false,homeroomRoomIds:new Set()});assert.deepEqual(groups.map(g=>g.period_no),[1]);
// Ownership is resolved for the whole reporting group, not the activity name.
const viewer=(userId,homerooms=[])=>({userId,admin:false,homeroomRoomIds:new Set(homerooms)});
for(const kind of ['sss','guidance','ethics','club','scout']){
 const configured=[sc('a','p','t1',kind,'owner'),sc('blank-slot','p','t2',kind)];
 assert.equal(activityGroups(configured,rooms,terms,viewer('owner')).length,1,'assigned teacher can assess '+kind);
 assert.equal(activityGroups(configured,rooms,terms,viewer('homeroom1',['p'])).length,0,'homeroom cannot override an assigned teacher');
 const unassigned=[sc('a','p','t1',kind)];
 for(const id of ['homeroom1','homeroom2']){const result=activityGroups(unassigned,rooms,terms,viewer(id,['p']));assert.equal(result.length,1);assert.equal(result[0].assessor,'homeroom');}
 assert.equal(activityGroups(unassigned,rooms,terms,viewer('other',['m'])).length,0,'another room teacher cannot assess');
 assert.equal(activityGroups(configured,rooms,terms,{...viewer('admin'),admin:true}).length,1);
}
assert.equal(activityGroups([sc('old-owner','m','t1','guidance','owner'),sc('new-term','m','t2','guidance')],rooms,terms,viewer('homeroom',['m'])).map(g=>g.period_no).join(','),'2','an unassigned explicit semester uses homeroom, not the old semester owner');
const grades=[{student_id:'s',activity_type:'club',period_no:0,result:'pass'},{student_id:'s',activity_type:'scout',period_no:0,result:'pass'},{student_id:'s',activity_type:'club',period_no:1,result:'fail'},{student_id:'s',activity_type:'club',period_no:2,result:'pass'}];
assert.equal(activitySummary(['club','scout'],grades,'s',0),'ผ่าน');assert.equal(activitySummary(['club','scout','guidance'],grades,'s',0),null);assert.equal(activitySummary(['club'],grades,'s',1),'ไม่ผ่าน');assert.equal(activitySummary(['club'],grades,'s',2),'ผ่าน');assert.equal(activitySummary(['club'],grades,'other',0),null);assert.equal(activitySummary([],grades,'s',0),null);assert.equal(activitySummary(['club'],[{...grades[0],result:'pending'}],'s',0),null);assert.equal(activitySummary(['club'],[{...grades[0],result:null}],'s',0),null);
console.log('PASS: annual deduplication, two semester results, assignment fallback/override, scope and conservative PP6 activity totals.');
