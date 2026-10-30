const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('src/lib/school-readiness.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};new Function('exports','module',compiled)(mod.exports,mod);
const {summarizeLevels,curriculumCourses}=mod.exports;
const rooms=[{id:'a',academic_year_id:'year',level_code:'ป.1',room_code:'1'},{id:'b',academic_year_id:'year',level_code:'ป.1',room_code:'2'},{id:'old',academic_year_id:'old-year',level_code:'ม.1',room_code:'1'}];
const enrollments=[{student_id:'s1',classroom_id:'a',academic_year_id:'year',status:'active'},{student_id:'s2',classroom_id:'b',academic_year_id:'year',status:'completed'},{student_id:'s3',classroom_id:'b',academic_year_id:'year',status:'withdrawn'}];
const versions=[{id:'v-old',curriculum_id:'c',effective_year_be:2568},{id:'v',curriculum_id:'c',effective_year_be:2569},{id:'v-future',curriculum_id:'c',effective_year_be:2570}];
const subjects=[{id:'math',curriculum_version_id:'v',subject_code:'MATH',grade_level:'ป.1'},{id:'english',curriculum_version_id:'v',subject_code:'ENG',grade_level:'ป.1'},{id:'old-subject',curriculum_version_id:'v-old',subject_code:'OLD',grade_level:'ป.1'},{id:'future-subject',curriculum_version_id:'v-future',subject_code:'FUTURE',grade_level:'ป.1'},{id:'other-grade',curriculum_version_id:'v',subject_code:'M2',grade_level:'ม.2'}];
const offerings=[{id:'o1',classroom_id:'a',subject_id:'math',term_id:'term'},{id:'o2',classroom_id:'b',subject_id:'math',term_id:'term'},{id:'other-term',classroom_id:'a',subject_id:'english',term_id:'term2'}];
const assignedMath=[{course_offering_id:'o1'},{course_offering_id:'o2'}];
const summarize=(r=rooms,e=enrollments,o=offerings,a=assignedMath,y='year',t='term',s=subjects,v=versions,be=2569)=>summarizeLevels(r,e,o,a,y,t,s,v,be);
let [row]=summarize();
assert.equal(row.students,2);assert.equal(row.courses,2,'Registered curriculum subjects, not the one offered subject');
assert.equal(row.assigned,1);assert.equal(row.unassigned,1,'An unoffered curriculum subject still needs a teacher');assert.equal(row.expectedSlots,4);assert.equal(row.assignedSlots,2);assert.equal(row.status,'progress');
[row]=summarize(rooms,enrollments,offerings,[{course_offering_id:'o1'}]);assert.equal(row.assigned,0);assert.equal(row.unassigned,2,'One untaught room makes that subject incomplete');
const allOfferings=[...offerings,{id:'e1',classroom_id:'a',subject_id:'english',term_id:'term'},{id:'e2',classroom_id:'b',subject_id:'english',term_id:'term'}];
const allAssignments=allOfferings.map(o=>({course_offering_id:o.id}));
[row]=summarize(rooms,enrollments,allOfferings,allAssignments);assert.equal(row.assigned,2);assert.equal(row.unassigned,0);assert.equal(row.status,'ready');assert.equal(row.progress,100);
[row]=summarize(rooms,enrollments,allOfferings,[...allAssignments,...allAssignments]);assert.equal(row.assigned,2,'Co-teachers do not double count subjects');
[row]=summarize(rooms,enrollments.filter(e=>e.classroom_id==='a'),allOfferings,allAssignments);assert.equal(row.status,'progress','Missing students in a parallel room prevents ready status');
[row]=summarize(rooms,enrollments,allOfferings,allAssignments,'year','term2');assert.equal(row.courses,2,'Changing term does not change the curriculum catalog');assert.equal(row.assigned,0);assert.equal(row.unassigned,2);
[row]=summarize(rooms,enrollments,[],[]);assert.equal(row.courses,2);assert.equal(row.unassigned,2,'Zero offerings cannot hide missing curriculum teachers');
[row]=summarize(rooms,enrollments,allOfferings,allAssignments,'year','term',[],versions);assert.equal(row.courses,0);assert.equal(row.status,'progress','No curriculum must never appear complete');
[row]=summarize(rooms,[],[],[],'year','',[],[]);assert.equal(row.status,'empty');assert.equal(row.progress,0);
assert.deepEqual(summarize(rooms,enrollments,offerings,assignedMath,'missing-year'),[]);
assert.deepEqual(curriculumCourses(subjects,versions,2568,'ป.1'),[['old-subject']]);assert.deepEqual(curriculumCourses(subjects,versions,2570,'ป.1'),[['future-subject']]);assert.deepEqual(curriculumCourses(subjects,versions,2567,'ป.1'),[]);
const many=Array.from({length:200},(_,i)=>({id:'s'+i,curriculum_version_id:'v',subject_code:'S'+i,grade_level:'ป.1'}));
const manyOfferings=many.map(s=>({id:'o-'+s.id,classroom_id:'a',subject_id:s.id,term_id:'term'}));
const [almost]=summarize(rooms.filter(r=>r.id==='a'),enrollments,manyOfferings,manyOfferings.slice(0,-1).map(o=>({course_offering_id:o.id})),'year','term',many);assert.equal(almost.status,'progress');assert.equal(almost.progress,99);

// Secondary curriculum entries are semester-scoped: 19 courses each term, not 38 all year.
const secondaryRoom={id:'secondary-room',academic_year_id:'year',level_code:'ม.1',room_code:'1'};
const secondaryEnrollment={student_id:'sec-student',classroom_id:'secondary-room',academic_year_id:'year',status:'active'};
const secondarySubjects=Array.from({length:38},(_,i)=>({
 id:'sec-'+i,curriculum_version_id:'v',subject_code:'S'+i,grade_level:'ม.1',semester_no:i<19?1:2
}));
const secondaryTerm1Offerings=secondarySubjects.slice(0,19).map((s,i)=>({id:'sec-offer-'+i,classroom_id:'secondary-room',subject_id:s.id,term_id:'sec-term-1'}));
const secondaryTerm2Offerings=[{id:'sec-t2-offer',classroom_id:'secondary-room',subject_id:secondarySubjects[19].id,term_id:'sec-term-2'}];
const secondarySummarize=(term,termNo,offeringList,assignmentList)=>summarizeLevels(
 [secondaryRoom],[secondaryEnrollment],offeringList,assignmentList,'year',term,secondarySubjects,versions,2569,termNo
)[0];
const secondaryTerm1=secondarySummarize('sec-term-1',1,secondaryTerm1Offerings,
 secondaryTerm1Offerings.map(o=>({course_offering_id:o.id})));
assert.equal(secondaryTerm1.courses,19,'Only semester-1 curriculum subjects count in semester 1');
assert.equal(secondaryTerm1.assigned,19);
assert.equal(secondaryTerm1.unassigned,0,'Do not flag the 19 semester-2 subjects as teacher vacancies');
assert.equal(secondaryTerm1.status,'ready');
const secondaryTerm2=secondarySummarize('sec-term-2',2,secondaryTerm2Offerings,[]);
assert.equal(secondaryTerm2.courses,19);
assert.equal(secondaryTerm2.unassigned,19,'No term-2 teachers are assigned yet');
assert.equal(secondaryTerm2.assigned,0);
assert.equal(curriculumCourses(secondarySubjects,versions,2569,'ม.1',1).length,19);
assert.equal(curriculumCourses(secondarySubjects,versions,2569,'ม.1',2).length,19);
assert.equal(curriculumCourses(subjects,versions,2569,'ป.1',2).length,2,'Annual primary school courses count in both terms');
console.log('PASS: curriculum baseline, unoffered subjects, per-room teacher coverage, term isolation, active versions, grade filtering, no curriculum, co-teachers and rounding.');
