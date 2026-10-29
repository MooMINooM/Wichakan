const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const mod={};
const js=ts.transpileModule(fs.readFileSync('src/lib/sar-docx.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(js,{exports:mod,TextEncoder,Uint8Array,DataView,Math,Map,Set,String,Number});
const report={
 year:2568,school:'โรงเรียนบ้านภูพระโนนผักหวาน',targets:[{section_code:'1',target_percent:80}],
 success_targets:[{indicator_code:'1.1.1.1',target_percent:60}],
 reviews:[{code:'1',narrative:'ตรวจหลักฐานแล้ว',strength:'มีกระบวนการ',improvement:'ควรพัฒนา',action_plan:'แผนปรับปรุง'}],
 measurements:[{code:'1',numerator:8,denominator:10,manually_observed_percent:null}],
 context:[{category:'school_profile',title:'ข้อมูลโรงเรียน',narrative:'ข้อมูลจริง',source_note:'ทะเบียน'}],
 national_tests:[],evidence:[{kind:'training',title:'อบรมครู',activity_year_be:2568,target_codes:['1']}],
 teacher_summary:[],staff_profiles:[],
 roster:{students:[],teaching_load:[]},academic_summary:{rows:[]}
};
const out=mod.createSarDocx(report,[{code:'1',title:'คุณภาพผู้เรียน',standard_no:1}],[{code:'1.1.1.1',parent_code:'1.1.1',description:'อ่านเขียนภาษาไทย'}],null);
assert(out instanceof Uint8Array);
const view=new DataView(out.buffer,out.byteOffset,out.byteLength);
assert.equal(view.getUint32(0,true),0x04034b50,'valid local ZIP header');
let offset=0,files=new Map(),decode=new TextDecoder();
while(offset+30<out.length && view.getUint32(offset,true)===0x04034b50){
 const compressed=view.getUint32(offset+18,true),nameSize=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
 const name=decode.decode(out.subarray(offset+30,offset+30+nameSize));
 const start=offset+30+nameSize+extra;
 files.set(name,decode.decode(out.subarray(start,start+compressed)));
 offset=start+compressed;
}
for(const name of ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels'])assert(files.has(name),'missing Word document part '+name);
assert(files.get('word/document.xml').includes('โรงเรียนบ้านภูพระโนนผักหวาน'),'Thai text in DOCX');
assert(files.get('word/document.xml').includes('ตรวจหลักฐานแล้ว'),'reviews in DOCX');
assert(files.get('word/document.xml').includes('80.00%'),'percent from actual data');
console.log('PASS: valid OOXML DOCX package, Word parts, Thai text, SAR outcomes and narrative');
