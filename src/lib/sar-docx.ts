// Minimal, dependency-free DOCX (OOXML) generator for SAR reports.
// ZIP entries use the STORE method and CRC32; Word and LibreOffice can open the result.
export type SarDocxTopic={code:string;title:string;standard_no:number};
export type SarDocxDetail={code:string;parent_code:string;description:string};
export type SarDocxReport={
 year:number;school:string;
 targets:{section_code:string;target_percent:number}[];
 success_targets?:{indicator_code:string;target_percent:number}[];
 reviews:{code:string;narrative:string;strength:string;improvement:string;action_plan:string}[];
 measurements:{code:string;numerator:number|null;denominator:number|null;manually_observed_percent:number|null}[];
 context:{category:string;title:string;narrative:string;source_note:string}[];
 national_tests:{test_kind:string;grade_level:string;component:string;participants:number|null;school_average:number|null;area_average:number|null;national_average:number|null}[];
 evidence:{kind:string;title:string;activity_year_be:number;target_codes:string[]}[];
 teacher_summary:{item_code:string;n:number;mean_rating:number}[];
 academic_summary?:{rows:{level:string;term:number;subject_code:string;expected:number;recorded:number;grade3plus:number;pct_of_recorded:number|null}[]};
 roster?:{students:{level:string;male:number;female:number;unknown:number;total:number}[];teaching_load:{teacher_id:string;term_no:number;total_periods:number}[]};
 staff_profiles?:{display_name?:string|null;employment_type:string;position_title:string;qualification:string;major:string;academic_rank:string}[];
};
const xml=(value:unknown)=>String(value??'—').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const text=(content:unknown)=>'<w:r><w:t xml:space="preserve">'+xml(content)+'</w:t></w:r>';
const para=(content:unknown,style?:string)=>'<w:p>'+(style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':'')+text(content)+'</w:p>';
const table=(headers:string[],rows:(string|number|null|undefined)[][])=>{
 const cell=(x:unknown)=>'<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>'+para(x)+'</w:tc>';
 return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="3"/><w:insideV w:val="single" w:sz="3"/></w:tblBorders></w:tblPr>'+
 '<w:tr>'+headers.map(cell).join('')+'</w:tr>'+rows.map(r=>'<w:tr>'+r.map(cell).join('')+'</w:tr>').join('')+'</w:tbl>';
};
function getReportXml(report:SarDocxReport,topics:SarDocxTopic[],details:SarDocxDetail[],version:number|null){
 const tar=new Map(report.targets.map(x=>[x.section_code,x.target_percent]));
 const fine=new Map((report.success_targets??[]).map(x=>[x.indicator_code,x.target_percent]));
 const measured=new Map(report.measurements.map(x=>[x.code,x]));
 const review=new Map(report.reviews.map(x=>[x.code,x]));
 const percentage=(code:string)=>{
  const v=measured.get(code);
  if(!v)return 'ไม่มีข้อมูล';
  if(v.denominator!==null&&v.denominator>0&&v.numerator!==null)return (100*v.numerator/v.denominator).toFixed(2)+'%';
  return v.manually_observed_percent==null?'ไม่มีข้อมูล':v.manually_observed_percent+'%';
 };
 const parts:string[]=[];
 parts.push(para('รายงานการประเมินตนเองของสถานศึกษา (SAR)','Title'),para(report.school,'Subtitle'),
  para('ระดับการศึกษาขั้นพื้นฐาน ปีการศึกษา '+report.year),
  para(version?'ฉบับรับรองรุ่นที่ '+version:'ฉบับร่างสำหรับตรวจสอบ ไม่ใช่รายงานที่ได้รับอนุมัติ'));
 parts.push(para('ส่วนที่ 1 ข้อมูลทั่วไปของสถานศึกษา','Heading1'));
 for(const c of report.context){
  parts.push(para(c.title||c.category,'Heading2'),para(c.narrative));
  if(c.source_note)parts.push(para('แหล่งข้อมูล: '+c.source_note));
 }
 if(report.staff_profiles?.length)parts.push(para('ข้อมูลคุณวุฒิและวิทยฐานะบุคลากร','Heading2'),
  table(['ชื่อ','ตำแหน่ง','วุฒิ','สาขา','วิทยฐานะ'],report.staff_profiles.map(s=>[s.display_name??'—',s.position_title,s.qualification,s.major,s.academic_rank])));
 if(report.roster?.students?.length)parts.push(para('จำนวนนักเรียนรายระดับชั้น','Heading2'),
  table(['ชั้น','ชาย','หญิง','รอตรวจสอบ','รวม'],report.roster.students.map(x=>[x.level,x.male,x.female,x.unknown,x.total])));
 if(report.national_tests.length)parts.push(para('ผล RT / NT / O-NET','Heading2'),
  table(['แบบทดสอบ','ชั้น','วิชา/ด้าน','จำนวนผู้เข้าสอบ','เฉลี่ยโรงเรียน','เฉลี่ยเขต','เฉลี่ยประเทศ'],
  report.national_tests.map(x=>[x.test_kind,x.grade_level,x.component,x.participants,x.school_average,x.area_average,x.national_average])));
 if(report.academic_summary?.rows?.length)parts.push(para('ผลการเรียนระดับ 3 ขึ้นไปจากข้อมูลที่มีเกรดสมบูรณ์','Heading2'),
  table(['ชั้น','ภาคเรียน','รหัสวิชา','มีผลเกรด','รายการที่คาดว่าต้องมี','เกรด 3 ขึ้นไป','ร้อยละของที่มี'],
  report.academic_summary.rows.map(x=>[x.level,x.term,x.subject_code,x.recorded,x.expected,x.grade3plus,x.pct_of_recorded])));
 parts.push(para('ส่วนที่ 2 ผลการประเมินตามมาตรฐาน','Heading1'));
 for(const no of [1,2,3]){
  const group=topics.filter(x=>x.standard_no===no);
  parts.push(para('มาตรฐานที่ '+no+' '+(group.find(x=>x.code===String(no))?.title??''),'Heading2'),
   table(['ข้อ','ประเด็นพิจารณา','เป้าหมาย','ผลประเมิน'],group.map(t=>[t.code,t.title,tar.has(t.code)?tar.get(t.code)+'%':'—',percentage(t.code)])));
  for(const t of group){
   const sub=details.filter(x=>x.parent_code===t.code);
   if(sub.length)parts.push(para('ตัวชี้วัดความสำเร็จรายข้อ '+t.code,'Heading3'),
    table(['ข้อ','รายละเอียด','ค่าเป้าหมาย'],sub.map(x=>[x.code,x.description,fine.has(x.code)?fine.get(x.code)+'%':'—'])));
   const r=review.get(t.code);
   if(r?.narrative)parts.push(para(t.code+' '+t.title,'Heading3'),para(r.narrative));
   if(r?.strength)parts.push(para('จุดเด่น: '+r.strength));
   if(r?.improvement)parts.push(para('จุดควรพัฒนา: '+r.improvement));
   if(r?.action_plan)parts.push(para('แนวทางพัฒนา: '+r.action_plan));
  }
 }
 if(report.teacher_summary.length)parts.push(para('ผลประเมินครูมาตรฐานที่ 2–3 (คะแนนดิบ 1–5)','Heading2'),
  para('ข้อมูลนี้เป็นค่าเฉลี่ยคะแนนดิบประกอบการพิจารณา ไม่ใช่การแปลงผลเป็นร้อยละอัตโนมัติ'),
  table(['ข้อ','จำนวนผู้ส่งประเมิน','เฉลี่ยคะแนนดิบ'],report.teacher_summary.map(x=>[x.item_code,x.n,x.mean_rating])));
 parts.push(para('ส่วนที่ 3 สรุปแผนพัฒนาคุณภาพ','Heading1'));
 for(const t of topics){
  const r=review.get(t.code);
  if(r?.action_plan)parts.push(para(t.code+' '+t.title,'Heading3'),para(r.action_plan));
 }
 parts.push(para('ส่วนที่ 4 ภาคผนวกหลักฐานที่ได้รับการรับรอง','Heading1'));
 if(report.evidence.length)parts.push(table(['ปี','ประเภท','ชื่อหลักฐาน','เชื่อมประเด็น'],report.evidence.map(x=>[x.activity_year_be,x.kind,x.title,x.target_codes.join(', ')])));
 else parts.push(para('ไม่มีหลักฐานที่ผ่านการรับรอง'));
 parts.push(para('หมายเหตุ: ข้อมูลที่ยังไม่พบหลักฐานจะไม่ถูกประเมินเป็น 0 โดยอัตโนมัติ'));
 const body=parts.join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
 '<w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="900" w:bottom="1000" w:left="900" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>';
}
function crc32(bytes:Uint8Array):number{
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function concat(...parts:Uint8Array[]):Uint8Array{
 const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let at=0;
 for(const part of parts){out.set(part,at);at+=part.length;}return out;
}
function zip(files:{name:string;data:string}[]):Uint8Array{
 const encoder=new TextEncoder();const local:Uint8Array[]=[],central:Uint8Array[]=[];
 let offset=0;
 for(const file of files){
  const name=encoder.encode(file.name),body=encoder.encode(file.data),crc=crc32(body);
  const lh=new Uint8Array(30),l=new DataView(lh.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);
  l.setUint16(8,0,true);l.setUint32(14,crc,true);l.setUint32(18,body.length,true);l.setUint32(22,body.length,true);l.setUint16(26,name.length,true);
  local.push(lh,name,body);
  const ch=new Uint8Array(46),c=new DataView(ch.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
  c.setUint16(10,0,true);c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,body.length,true);
  c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
  central.push(ch,name);
  offset+=lh.length+name.length+body.length;
 }
 const centralLength=central.reduce((n,x)=>n+x.length,0);
 const end=new Uint8Array(22),e=new DataView(end.buffer);
 e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
 e.setUint32(12,centralLength,true);e.setUint32(16,offset,true);
 return concat(...local,...central,end);
}
export function createSarDocx(report:SarDocxReport,topics:SarDocxTopic[],details:SarDocxDetail[],version:number|null):Uint8Array{
 const contents='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
 '<Default Extension="xml" ContentType="application/xml"/>'+
 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
 '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
 const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
 const documentRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
 '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Sarabun" w:eastAsia="Sarabun" w:cs="Sarabun"/><w:sz w:val="28"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="42"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>'+
 '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>';
 return zip([{name:'[Content_Types].xml',data:contents},{name:'_rels/.rels',data:rels},
  {name:'word/document.xml',data:getReportXml(report,topics,details,version)},
  {name:'word/_rels/document.xml.rels',data:documentRels},{name:'word/styles.xml',data:styles}]);
}
