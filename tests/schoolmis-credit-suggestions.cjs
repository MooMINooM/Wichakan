const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('src/lib/schoolmis-credit-suggestions.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const target={};vm.runInNewContext(code,{exports:target});
const {creditSuggestion}=target;
const versions=[
 {id:'v2568',version_label:'2568',effective_year_be:2568},
 {id:'v2569',version_label:'2569',effective_year_be:2569}
];
const subjects=[
 {subject_code:'ท22201',grade_level:'ม.2',name_th:'ภาษาไทยเพิ่มเติม 3',learning_hours:20,hour_basis:'term',curriculum_version_id:'v2569'},
 {subject_code:'ศ21104',grade_level:'ม.1',name_th:'ดนตรี-นาฏศิลป์',learning_hours:20,hour_basis:'term',curriculum_version_id:'v2569'},
 {subject_code:'ค21101',grade_level:'ม.1',name_th:'คณิตศาสตร์',learning_hours:60,hour_basis:'term',curriculum_version_id:'v2569'},
 {subject_code:'ค21101',grade_level:'ม.1',name_th:'คณิตศาสตร์',learning_hours:40,hour_basis:'term',curriculum_version_id:'v2568'},
 {subject_code:'ว14201',grade_level:'ป.4',name_th:'คอมพิวเตอร์',learning_hours:40,hour_basis:'year',curriculum_version_id:'v2569'}
];
let c=creditSuggestion({year:2568,level:'ม.2',term:1,subject_code:'ท22201',name:'การพูด'},subjects,versions);
assert.equal(c.credit,0.5);assert.equal(c.sameName,false);
assert.equal(c.historicalVersion,false,'A later curriculum does not certify past credits');
assert.equal(c.effectiveYear,2569);
c=creditSuggestion({year:2567,level:'ม.1',term:2,subject_code:'ศ21104',name:'ดนตรี-นาฎศิลป์'},subjects,versions);
assert.equal(c.sameName,true,'Minor spelling differences should not be an actual curriculum mismatch');
assert.equal(c.historicalVersion,false);
c=creditSuggestion({year:2568,level:'ม.1',term:1,subject_code:'ค21101',name:'คณิตศาสตร์'},subjects,versions);
assert.equal(c.credit,1,'Existing historical curriculum version takes precedence over newer subject hours');
assert.equal(c.historicalVersion,true);
c=creditSuggestion({year:2567,level:'ม.1',term:1,subject_code:'ค21101',name:'คณิตศาสตร์'},subjects,versions);
assert.equal(c.credit,1);assert.equal(c.historicalVersion,false);
c=creditSuggestion({year:2569,level:'ป.4',term:0,subject_code:'ว14201',name:'คอมพิวเตอร์'},subjects,versions);
assert.equal(c.credit,1);assert.equal(c.historicalVersion,true);
assert.equal(creditSuggestion({year:2567,level:'ม.1',term:1,subject_code:'ง21999',name:'คอมพิวเตอร์'},subjects,versions),null);
console.log('PASS: SchoolMIS unit suggestions from existing course hours, year precedence and title mismatch safety.');
