const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {activityGroups,activityPeriod,activitySummary}=require('../src/lib/activity-assessments.ts');
const rooms=[{id:'p',academic_year_id:'y',level_code:'ป.5'},{id:'m',academic_year_id:'y',level_code:'ม.1'}],terms=[{id:'t1',academic_year_id:'y',term_no:1},{id:'t2',academic_year_id:'y',term_no:2},{id:'old',academic_year_id:'old-year',term_no:1}];
const sc=(id,room,term,kind='club',teacher=null)=>({id,school_id:'school',classroom_id:room,term_id:term,activity_type:kind,teacher_user_id:teacher});
const home=(room,teacher)=>({classroom_id:room,teacher_user_id:teacher});
const homes=[home('p','home1'),home('p','home2'),home('p','home3'),home('m','other-room-teacher')];
const viewer=userId=>({userId});
const schedules=[sc('p1','p','t1'),sc('p2','p','t2'),sc('p-duplicate','p','t1'),sc('m1','m','t1','guidance','owner'),sc('computing','p','t1','computing'),sc('wrong-year','p','old','guidance')];
let groups=activityGroups(schedules,rooms,terms);assert.equal(groups.length,3);assert.equal(groups.filter(g=>g.classroom_id==='p').length,1);assert.deepEqual(groups.filter(g=>g.classroom_id==='m').map(g=>g.period_no),[1,2]);
assert.equal(activityPeriod('ป.1',2),0);assert.equal(activityPeriod('ม.1',2),2);
for(const teacher of ['home1','home2','home3']){
 assert.deepEqual(activityGroups(schedules,rooms,terms,viewer(teacher),homes).map(g=>g.key),['p:club:0'],'all co-homerooms see the same record key');
}
assert.equal(activityGroups(schedules,rooms,terms,viewer('other-room-teacher'),homes).length,0,'not allowed outside assigned room');
assert.equal(activityGroups(schedules,rooms,terms,viewer('owner'),homes).length,2);
groups=activityGroups([...schedules,sc('m2','m','t2','guidance','new-owner')],rooms,terms,viewer('owner'),homes);assert.deepEqual(groups.map(g=>g.period_no),[1]);
for(const kind of ['sss','guidance','ethics']){
 const configured=[sc('a','p','t1',kind,'owner'),sc('b','p','t2',kind,'owner')];
 assert.equal(activityGroups(configured,rooms,terms,viewer('owner'),homes).length,1);
 for(const teacher of ['home1','home2','home3'])assert.equal(activityGroups(configured,rooms,terms,viewer(teacher),homes).length,0,'homeroom cannot override assigned teaching activity');
 assert.equal(activityGroups([sc('blank','p','t1',kind)],rooms,terms,viewer('home1'),homes).length,0,'no homeroom fallback for SSS/guidance/ethics');
}
for(const kind of ['club','scout']){
 const configured=[sc('a','p','t1',kind),sc('b','p','t2',kind)];
 for(const teacher of ['home1','home2','home3']){
  const result=activityGroups(configured,rooms,terms,viewer(teacher),homes);
  assert.equal(result.length,1);assert.equal(result[0].key,'p:'+kind+':0');
 }
 assert.equal(activityGroups(configured,rooms,terms,viewer('other'),homes).length,0);
 assert.equal(activityGroups(configured,rooms,terms,viewer('home1'),[]).length,0,'unassigned teacher cannot record');
}
assert.deepEqual(activityGroups([sc('old-owner','m','t1','guidance','owner'),sc('new-term','m','t2','guidance','new-owner')],rooms,terms,viewer('owner'),homes).map(g=>g.period_no),[1]);
const grades=[{student_id:'s',activity_type:'club',period_no:0,result:'pass'},{student_id:'s',activity_type:'scout',period_no:0,result:'pass'},{student_id:'s',activity_type:'club',period_no:1,result:'fail'},{student_id:'s',activity_type:'club',period_no:2,result:'pass'}];
assert.equal(activitySummary(['club','scout'],grades,'s',0),'ผ่าน');assert.equal(activitySummary(['club','scout','guidance'],grades,'s',0),null);assert.equal(activitySummary(['club'],grades,'s',1),'ไม่ผ่าน');assert.equal(activitySummary(['club'],grades,'s',2),'ผ่าน');assert.equal(activitySummary(['club'],grades,'other',0),null);assert.equal(activitySummary([],grades,'s',0),null);assert.equal(activitySummary(['club'],[{...grades[0],result:'pending'}],'s',0),null);
console.log('PASS: all classroom homeroom teachers share results, teacher-owned SSS/guidance, semester ownership and conservative summaries.');
