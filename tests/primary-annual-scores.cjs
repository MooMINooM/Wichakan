const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {scoreOffering}=require('../src/lib/teacher-scores.ts');
const {teacherOverview}=require('../src/lib/teacher-overview.ts');
const {pp5Score}=require('../src/lib/pp5.ts');
const {pp6Matrix}=require('../src/lib/pp6-grades.ts');
const book=require('./pp5-fixture.cjs')(),data=book.data,first=data.offerings[0];
const second={...first,id:'semester-two',term_id:'term-two'};
data.terms.push({id:'term-two',academic_year_id:'year',term_no:2});
// Load order must not choose the newly copied offering over the original ledger.
data.offerings.unshift(second);
assert.equal(scoreOffering(data,second).id,first.id);
assert.equal(scoreOffering(data,first).id,first.id);
const student=book.roster[0].id,record=data.scores.find(r=>r.student_id===student);
Object.assign(record,{term2_coursework:25,term2_midterm:8,term2_final:9,is_complete:true});
assert.equal(pp5Score(data,first,student).annualTotal,92);
assert.equal(pp5Score(data,second,student).annualTotal,92);
assert.deepEqual(pp5Score(data,second,student).scores,[25,8,9]);
assert.equal(pp5Score(data,second,student).complete,true);
assert.equal(teacherOverview(data,'year','term-two')[0].saved,1);
assert.equal(teacherOverview(data,'year','term-two')[0].expected,2);
assert.equal(teacherOverview(data,'year','term-two')[0].progress,50);
assert.equal(pp6Matrix(data.subjects,data.offerings,data.terms,data.scores,data.settings,student,'year',2,'ป.6')[0].grade,'4');
// Same subject in another classroom/year must never share a ledger.
const isolated=structuredClone(data);
isolated.offerings=[{...first,id:'other-room',classroom_id:'other-room'},second];
assert.equal(scoreOffering(isolated,second).id,second.id);
isolated.offerings=[{...first,id:'other-year',term_id:'old'},second];
isolated.terms.push({id:'old',academic_year_id:'old-year',term_no:1});
assert.equal(scoreOffering(isolated,second).id,second.id);
isolated.offerings=[second];
assert.equal(scoreOffering(isolated,second).id,second.id,'do not invent an inaccessible offering');
// Timetable and attendance still use the second-semester offering, unchanged.
assert.equal(second.term_id,'term-two');assert.equal(second.id,'semester-two');
// Secondary grades keep independent semester ledgers even if subject IDs match.
const secondary=structuredClone(data);secondary.rooms[0].level_code='ม.1';
assert.equal(scoreOffering(secondary,second).id,second.id);
assert.equal(pp5Score(secondary,second,student).total,null);
assert.equal(teacherOverview(secondary,'year','term-two')[0].saved,0);
console.log('PASS: primary semester 2 resolves the original annual ledger, PP5/PP6 and term progress agree, room/year/authorization isolation, secondary semester separation.');
