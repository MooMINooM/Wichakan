const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const mod={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/schoolmis-history.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText,{exports:mod,require});
const {parseSchoolmisCsv,buildSchoolmisPreview,normalizeStudentName,recognizeSchoolmisLevel}=mod;
assert.equal(recognizeSchoolmisLevel('คะแนน_ชั้นประถมศึกษาปีที่ 6  ห้อง 1.csv'),'ป.6');
assert.equal(recognizeSchoolmisLevel('คะแนน_ชั้นมัธยมศึกษาปีที่ 3  ห้อง 1.csv'),'ม.3');
assert.equal(normalizeStudentName('เด็กชาย ทดสอบ นักเรียน'),'ทดสอบนักเรียน');
assert.equal(normalizeStudentName('ด.ญ.ทดสอบ นักเรียน'),'ทดสอบนักเรียน');
assert.equal(JSON.stringify(parseSchoolmisCsv('#,รหัสนักเรียน,ชื่อ-สกุล\r\n1,0001,"นาย A, B"')[1]),JSON.stringify(['1','0001','นาย A, B']));
assert.throws(()=>parseSchoolmisCsv('"bad'),/อัญประกาศ/);
const phead=['#','รหัสนักเรียน','ชื่อ-สกุล'];
for(let g=1;g<=6;g++)for(let i=1;i<=12;i++)phead.push('ท1'+g+String(i).padStart(3,'0')+' ภาษาไทย '+g);
for(let g=1;g<=6;g++)for(let i=1;i<=4;i++)phead.push('ก1'+g+'9'+String(i).padStart(2,'0')+' '+['แนะแนว','ลูกเสือ','ชุมนุม','กิจกรรมเพื่อสังคม'][i-1]);
const pvals=phead.map((x,i)=>i===0?'1':i===1?'0001':i===2?'เด็กหญิง ทดสอบ นักเรียน':i===3?'0':i===15?'3.5':i===3+12*5?'4':'');
const pcsv=phead.join(',')+'\n'+pvals.join(',');
let p=buildSchoolmisPreview(pcsv,2569,'ป.6');
assert.equal(p.studentCount,1);
assert.equal(p.historicalGradeCount,1,'current-year grade must not import');
assert.equal(p.entries.find(e=>e.result_text==='3.5').academic_year_be,2565);
assert.equal(p.entries.find(e=>e.result_text==='3.5').level_code,'ป.2');
assert.equal(p.entries.find(e=>e.result_text==='3.5').term_no,0);
assert.equal(p.zeroSkipped,1);
assert(p.missingGradeCount>0,'Blank history is explicitly carried forward as pending');
assert(p.currentSkipped>0);
p=buildSchoolmisPreview(pcsv,2569,'ป.6',true);
assert.equal(p.historicalGradeCount,2);
assert(p.entries.some(e=>e.grade_value===0&&e.academic_year_be===2564));
const mhead=['#','รหัสนักเรียน','ชื่อ-สกุล'];
for(let g=1;g<=3;g++)for(let term=1;term<=2;term++){
 mhead.push('ท2'+g+'10'+term+' ภาษาไทย '+g);
 for(let k=1;k<=17;k++)mhead.push('ค2'+g+String(100+k).padStart(3,'0')+' คณิตศาสตร์ '+g);
}
for(let i=0;i<24;i++)mhead.push('ก2'+(Math.floor(i/8)+1)+'9'+String(i%8+1).padStart(2,'0')+' กิจกรรม');
const mvals=mhead.map((x,i)=>i===0?'1':i===1?'0001':i===2?'นาย ทดสอบ นักเรียน':i===3?'3.5':i===21?'4':i===39?'1':i===3+18*4?'4':'');
const m=buildSchoolmisPreview(mhead.join(',')+'\n'+mvals.join(','),2569,'ม.3');
assert.equal(m.historicalGradeCount,3);
assert.equal(m.entries.find(e=>e.result_text==='3.5').academic_year_be,2567);
assert.equal(m.entries.find(e=>e.result_text==='4'&&e.academic_year_be===2567).term_no,2);
assert.equal(m.entries.find(e=>e.result_text==='1').academic_year_be,2568);
assert(m.currentSkipped>0);
assert.throws(()=>buildSchoolmisPreview('x,y,z\n1,2,3',2569,'ป.6'),/SchoolMIS/);
console.log('schoolmis history parsing tests passed');
