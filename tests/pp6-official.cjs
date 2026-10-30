const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(file,deps={}) {
 const mod={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
 }).outputText,{exports:mod,require:key=>deps[key]??require(key)});
 return mod;
}
const score=load('src/lib/teacher-scores.ts');
const grades=load('src/lib/pp6-grades.ts',{'./teacher-scores':score});
const official=load('src/lib/pp6-official.ts',{'./teacher-scores':score});
const s=(id,code,name,hours,category='basic')=>({id,subject_code:code,name_th:name,learning_hours:hours,category});
const c=(subjectId,score,state='complete',grade='4')=>({subjectId,score,state,grade});
const primary=[
 s('health','พ11101','สุขศึกษา',40),
 s('pe','พ11102','พลศึกษา',40,'additional'),
 s('art','ศ11101','ศิลปะ',40),
 s('music','ศ11102','ดนตรี',40,'additional'),
 s('math','ค11101','คณิตศาสตร์',160)
];
let subjects=official.officialPp6Subjects(primary,'ป.1');
assert.deepEqual(Array.from(subjects,x=>x.id),['health','art','math']);
assert.equal(subjects[0].name_th,'สุขศึกษาและพลศึกษา 1');
assert.equal(subjects[1].name_th,'ศิลปะ ดนตรี นาฏศิลป์ 1');
assert.equal(subjects[0].learning_hours,80);
assert.equal(subjects[0].category,'basic');
let cells=official.officialPp6Cells(primary,[c('health',78),c('pe',92),c('art',80),c('music',100),c('math',80)],'ป.1',2);
assert.equal(cells[0].score,85);assert.equal(cells[0].grade,'4');
assert.equal(cells[1].score,90);assert.equal(cells[1].grade,'4');
assert.equal(grades.provisionalGpa(subjects,cells,'ป.1',2),'4.00');
cells=official.officialPp6Cells(primary,[c('health',74),c('pe',75),c('art',70),c('music',80),c('math',80)],'ป.1',2);
assert.equal(cells[0].score,74.5);assert.equal(cells[0].grade,'3','grade after averaging raw marks, no rounding to 75');
assert.equal(cells[1].grade,'3.5');
cells=official.officialPp6Cells(primary,[c('health',80),c('pe',79),c('art',80),c('music',80),c('math',80)],'ป.1',2);
assert.equal(cells[0].grade,'3.5','79.5 is not 80');
cells=official.officialPp6Cells(primary,[c('health',78),c('pe',null,'missing','—'),c('art',80),c('music',80),c('math',80)],'ป.1',2);
assert.equal(cells[0].state,'missing');assert.equal(cells[0].grade,'—');
assert.equal(grades.provisionalGpa(subjects,cells,'ป.1',2),null);
cells=official.officialPp6Cells(primary,[c('health',78),c('pe',null,'special','ร'),c('art',80),c('music',80),c('math',80)],'ป.1',2);
assert.equal(cells[0].state,'special');assert.equal(cells[0].grade,'ร');
cells=official.officialPp6Cells(primary,[c('health',40,'inprogress','ระหว่างปี'),c('pe',45,'inprogress','ระหว่างปี')],'ป.1',1);
assert.equal(cells[0].state,'inprogress');assert.equal(cells[0].score,42.5);
assert.equal(grades.provisionalGpa(subjects,cells,'ป.1',1),null);
const missingPartner=official.officialPp6Subjects([primary[0],primary[2],primary[3]],'ป.1');
assert.equal(missingPartner[0].learning_hours,0);
const missingCell=official.officialPp6Cells([primary[0]], [c('health',88)],'ป.1',2)[0];
assert.equal(missingCell.state,'missing','Never certify a single half of a primary subject');
const secondary=[
 s('computer1','ง21201','คอมพิวเตอร์',20,'additional'),
 s('computer2','ง21202','คอมพิวเตอร์',20,'additional'),
 s('computerOther','ว21103','วิทยาการคำนวณ',20),
 s('healthM','พ21101','สุขศึกษา',20),
 s('artsM','ศ21101','ทัศนศิลป์',20)
];
const ss=official.officialPp6Subjects(secondary,'ม.1');
assert.deepEqual(Array.from(ss,x=>x.id),['computerOther','healthM','artsM']);
const cc=official.officialPp6Cells(secondary,secondary.map(x=>c(x.id,90)),'ม.1',2);
assert.deepEqual(Array.from(cc,x=>x.subjectId),['computerOther','healthM','artsM']);
console.log('PASS: Official PP6 primary merged scores, missing/special results, correct thresholds, credits & secondary computer omission.');
