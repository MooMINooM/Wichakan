const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,process:{env:{}},require:name=>name.endsWith('.css')?{}:deps[name]??require(name)});return exports;}
const summary=load('src/lib/pp6-print-summary.ts'),Report=load('src/components/pp6-report.tsx',{'@/lib/pp6-print-summary':summary,'@/lib/report-typography':load('src/lib/report-typography.ts')}).default;
const props={teacherName:'นายครูผู้พิมพ์ ใจดี',student:{id:'student',student_no:'1234',first_name_th:'กิตติ',last_name_th:'ใจดี'},room:{id:'room',level_code:'ป.1',room_code:'1',academic_year_id:'year'},year:2569,termNo:1,subjects:[],cells:[],gpa:null,rosterCount:1,assessment:{desirable_traits:null,reading_thinking_writing:null,learner_activities:null,comment:'ความคิดเห็นทดสอบ '.repeat(20)}};
for(const prefix of ['เด็กชาย','เด็กหญิง','นาย','นางสาว','ด.ช.',null,undefined]){
 const full=(prefix??'')+'กิตติ ใจดี',html=renderToStaticMarkup(React.createElement(Report,{...props,student:{...props.student,name_prefix_th:prefix}})).replace(/<!--.*?-->/g,'');
 assert(html.includes('ชื่อ - นามสกุล : '+full),'report name must include stored prefix');
 assert(html.includes('<title>ปพ.6 1234 '+full+'</title>'),'document title must include prefix');
 assert(html.includes('aria-label="แบบรายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล '+full+'"'),'accessible name must include prefix');
 assert(html.includes('1234　'+full+'</p>'),'comment continuation must include prefix');
 assert(html.includes('(นายครูผู้พิมพ์ ใจดี)'),'report signature must include the supplied printer name');
 assert(!html.includes('undefined'));assert(!html.includes('nullกิตติ'));
}
console.log('PASS: PP6 stored prefixes in report, title, accessible label and comment continuation; absent prefix stays blank.');
