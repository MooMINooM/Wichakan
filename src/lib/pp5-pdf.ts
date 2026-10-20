import {PDFDocument,rgb,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {TRAITS,READING,QUALITY,eligibleForLesson,assessmentQuality,attendanceSessions,fullName,gender,pp5Score,pp5Readiness,weekOf,type Attendance,type CourseAssessment,type Target} from './pp5';
import type {TeacherWorkspace,TeacherOffering,TeacherStudent} from './use-teacher-workspace';
export type Pp5Book={data:TeacherWorkspace;offering:TeacherOffering;roster:TeacherStudent[];attendance:Attendance[];assessments:CourseAssessment[];targets:Target[];expected:number;schoolName:string;teacherName:string;homeroomNames:string[];learningHours:number;hourBasis:string;termStart:string|null};
export async function createPp5Pdf(book:Pp5Book){
 const {data,offering:o,roster,attendance,assessments,targets}=book;
 if(!pp5Readiness(data,o,roster,attendance,assessments,book.expected).ready)throw Error('ยังบันทึกข้อมูล ปพ.5 ไม่ครบ');
 if(!book.schoolName||!book.teacherName)throw Error('ข้อมูลโรงเรียนหรือครูผู้สอนไม่ครบ');
 const base=process.env.NEXT_PUBLIC_BASE_PATH||'',res=await fetch(base+'/fonts/NotoSansThai.ttf');if(!res.ok)throw Error('โหลดฟอนต์ PDF ไม่สำเร็จ');
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(await res.arrayBuffer(),{subset:true});
 pdf.setTitle('ปพ.5 '+data.subjects.find(s=>s.id===o.subject_id)?.name_th);pdf.setAuthor(book.teacherName);
 const subject=data.subjects.find(s=>s.id===o.subject_id)!,room=data.rooms.find(r=>r.id===o.classroom_id)!,term=data.terms.find(t=>t.id===o.term_id)!,year=data.years.find(y=>y.id===room.academic_year_id)!;
 const roomLabel=room.room_code.startsWith(room.level_code+'/')?room.room_code:room.level_code+'/'+room.room_code;
 const context=subject.subject_code+' '+subject.name_th+' | '+roomLabel+' | ภาคเรียน '+term.term_no+' ปี '+year.year_be;
 const black=rgb(.08,.08,.08),gray=rgb(.93,.94,.95);
 function text(p:PDFPage,value:string|number,x:number,top:number,size=11,max=1000,align:'left'|'center'|'right'='left'){
  const str=String(value);let fit=size;while(font.widthOfTextAtSize(str,fit)>max&&fit>8)fit-=.25;
  const w=font.widthOfTextAtSize(str,fit);p.drawText(str,{x:align==='center'?x-w/2:align==='right'?x-w:x,y:p.getHeight()-top-fit,font,size:fit,color:black});
 }
 function lines(value:string,width:number,size=11){const output:string[]=[];for(const paragraph of value.split('\n')){let line='';for(const char of Array.from(new Intl.Segmenter('th',{granularity:'grapheme'}).segment(paragraph),s=>s.segment)){if(font.widthOfTextAtSize(line+char,size)>width&&line){output.push(line);line=char;}else line+=char;}output.push(line);}return output;}
 function rect(p:PDFPage,x:number,top:number,w:number,h:number,fill=false){p.drawRectangle({x,y:p.getHeight()-top-h,width:w,height:h,borderWidth:.4,borderColor:rgb(.2,.2,.2),...(fill?{color:gray}:{})});}
 function page(title:string,landscape=true){const p=pdf.addPage(landscape?[841.89,595.28]:[595.28,841.89]);text(p,book.schoolName,28,18,13,p.getWidth()-56);text(p,title,28,40,15,p.getWidth()-56);text(p,context,28,64,10,p.getWidth()-56);return p;}
 function table(p:PDFPage,headers:string[],widths:number[],rows:(string|number)[][],top=90,rowHeight=14){let x=28;const headerHeight=34;
  headers.forEach((h,i)=>{rect(p,x,top,widths[i],headerHeight,true);const hs=lines(h,widths[i]-6,9);hs.slice(0,3).forEach((line,j)=>text(p,line,x+widths[i]/2,top+3+j*10,9,widths[i]-4,'center'));x+=widths[i];});
  rows.forEach((row,j)=>{let x=28;row.forEach((v,i)=>{rect(p,x,top+headerHeight+j*rowHeight,widths[i],rowHeight);text(p,v,i===2?x+3:x+widths[i]/2,top+headerHeight+j*rowHeight+1,10,widths[i]-5,i===2?'left':'center');x+=widths[i];});});
 }
 const chunks:TeacherStudent[][]=[];for(let i=0;i<roster.length;i+=28)chunks.push(roster.slice(i,i+28));
 const cover=page('แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)',false);
 text(cover,'รายวิชา '+subject.name_th,cover.getWidth()/2,125,22,510,'center');text(cover,'รหัสวิชา '+subject.subject_code,cover.getWidth()/2,163,17,510,'center');text(cover,'ชั้น '+roomLabel+' ภาคเรียนที่ '+term.term_no,cover.getWidth()/2,197,17,510,'center');text(cover,'ปีการศึกษา '+year.year_be,cover.getWidth()/2,230,19,510,'center');
 const males=roster.filter(s=>gender(s.name_prefix_th)===0).length,females=roster.filter(s=>gender(s.name_prefix_th)===1).length;
 const groupName:Record<string,string>={'ท':'ภาษาไทย','ค':'คณิตศาสตร์','ว':'วิทยาศาสตร์และเทคโนโลยี','ส':'สังคมศึกษา ศาสนา และวัฒนธรรม','พ':'สุขศึกษาและพลศึกษา','ศ':'ศิลปะ','ง':'การงานอาชีพ','อ':'ภาษาต่างประเทศ'};
 const coverDetails=[['กลุ่มสาระการเรียนรู้',groupName[subject.subject_code[0]]??'—'],['ชั่วโมง/สัปดาห์',(book.expected/20).toString()+(room.level_code.startsWith('ม.')?' · '+(book.expected/40).toFixed(2)+' หน่วยกิต':'')],['ครูผู้สอน',book.teacherName],['ครูประจำชั้น',book.homeroomNames.join(' / ')||'—'],['นักเรียน',`ชาย ${males} คน หญิง ${females} คน รวม ${roster.length} คน`],['เวลาเรียน',`${book.expected} คาบในภาคเรียนนี้ (${book.learningHours} ชั่วโมง/${book.hourBasis==='year'?'ปี':'ภาคเรียน'})`],['คะแนนเต็ม',pp5Score(data,o,roster[0].id).caps.join(' : ')+' (เก็บ : กลางภาค : ปลายภาค)']];
 let cy=270;for(const [label,value] of coverDetails){text(cover,label,42,cy,12);const wrapped=lines(value,380,12);wrapped.forEach((v,j)=>text(cover,v,155,cy+j*18,12));cy+=Math.max(30,wrapped.length*18+10);}
 text(cover,'สรุปผลการพัฒนาผู้เรียน',42,cy+14,15);cy+=48;
 const grades=['4','3.5','3','2.5','2','1.5','1','0','ร','มส','—'];
 const counts=grades.map(g=>roster.filter(s=>pp5Score(data,o,s.id).grade===g).length);
 table(cover,['ผลการเรียน',...grades],[87,...grades.map(()=>40)],[['จำนวนคน',...counts]],cy,23);
 if(room.level_code.startsWith('ป.'))text(cover,'ระดับประถม: สรุปเกรดเมื่อบันทึกคะแนนครบทั้งสองภาคเรียน',42,cy+64,9,510);
 let qy=cy+88;for(const group of ['traits','reading'] as const){text(cover,group==='traits'?'คุณลักษณะอันพึงประสงค์':'อ่าน คิดวิเคราะห์ และเขียน',42,qy,12);qy+=23;text(cover,QUALITY.map((label,i)=>label+' '+assessments.filter(a=>roster.some(s=>s.id===a.student_id)&&assessmentQuality(group==='traits'?a.trait_scores:a.reading_scores,group)===i).length+' คน').join(' | '),42,qy,10,510);qy+=32;}
 text(cover,'ลงชื่อ ................................................ ครูผู้สอน',42,746,12);text(cover,'('+book.teacherName+')',145,769,12,360,'center');
 const sessions=attendanceSessions(attendance),anchor=book.termStart&&book.termStart<=sessions[0].date?book.termStart:sessions[0].date;
 const weeks=Math.max(20,...sessions.map(s=>weekOf(s.date,anchor)+1)),lookup=new Map(attendance.map(a=>[a.student_id+'#'+a.class_date+'#'+a.session_no,a.attendance_status]));
 const marks:Record<string,string>={present:'/',absent:'ข',late:'ส',leave:'ล'};
 for(let start=0;start<weeks;start+=5){for(const chunk of chunks){const cols:Array<{week:number;date:string;period:number}>=[];
  for(let w=start;w<start+5;w++){const found=sessions.filter(s=>weekOf(s.date,anchor)===w);if(found.length)found.forEach(s=>cols.push({week:w+1,...s}));else cols.push({week:w+1,date:'',period:0});}
  // Split exceptionally dense weeks rather than crop attendance columns.
  for(let ci=0;ci<cols.length;ci+=30){const part=cols.slice(ci,ci+30),p=page('บันทึกเวลาเรียน สัปดาห์ที่ '+(start+1)+'–'+(start+5)+(ci?' (ต่อ)':''));
   const colWidth=490/part.length,headers=['เลขที่','เลขประจำตัว','ชื่อ–สกุล',...part.map(s=>'ส'+s.week+'\n'+(s.date?s.date.slice(8)+'/'+s.date.slice(5,7)+'\nคาบ '+s.period:'—')), 'มา','ขาด','สาย','ลา','รวม'];
   const rows=chunk.map(s=>{const marksFor=part.map(c=>c.date?marks[lookup.get(s.id+'#'+c.date+'#'+c.period)??'']??'—':'');const all=part.filter(c=>c.date&&eligibleForLesson(data,o,s.id,c.date)).map(c=>lookup.get(s.id+'#'+c.date+'#'+c.period));return [roster.indexOf(s)+1,s.student_no,fullName(s),...marksFor,...['present','absent','late','leave'].map(v=>all.filter(a=>a===v).length),all.length];});
   table(p,headers,[27,52,131,...part.map(()=>colWidth),...Array(5).fill(17)],rows);text(p,'/ มาเรียน   ข ขาดเรียน   ส มาสาย   ล ลา | ช่องว่าง = ไม่มีคาบ | — = นอกช่วงลงทะเบียน',28,558,10,780);
  }
 }}
 for(const chunk of chunks){const p=page('บันทึกคะแนน คุณลักษณะอันพึงประสงค์ และอ่านคิดเขียน');const headers=['เลขที่','รหัส','ชื่อ–สกุล','เก็บ','กลาง','ปลาย','รวมภาค','เกรด',...TRAITS.map((_,i)=>'ค'+(i+1)),'ผล ค.',...READING.map((_,i)=>'อ'+(i+1)),'ผล อ.'];
  const rows=chunk.map(s=>{const a=assessments.find(a=>a.student_id===s.id)!,r=pp5Score(data,o,s.id);return [roster.indexOf(s)+1,s.student_no,fullName(s),...r.scores.map(v=>v??'—'),r.total??'—',r.grade,...a.trait_scores!,QUALITY[assessmentQuality(a.trait_scores,'traits')!],...a.reading_scores!,QUALITY[assessmentQuality(a.reading_scores,'reading')!]];});
  table(p,headers,[26,43,165,30,30,30,36,30,...Array(8).fill(17),50,...Array(5).fill(17),50],rows);
  text(p,'ค1–ค8: '+TRAITS.join(' / '),28,529,8,785);text(p,'อ1–อ5: '+READING.join(' / ')+' | คะแนน 0 ไม่ผ่าน 1 ผ่าน 2 ดี 3 ดีเยี่ยม',28,542,8,785);
  if(room.level_code.startsWith('ป.'))text(p,'ระดับประถม: แสดงคะแนนภาคเรียนนี้ และสรุปเกรดเมื่อครบทั้งปี',28,555,8,785);
 }
 let targetPage=page('ตัวชี้วัด / ผลการเรียนรู้',false),ty=100;
 if(!targets.length){text(targetPage,'ยังไม่ได้กำหนดตัวชี้วัดจากหลักสูตร',28,90,12);for(let i=0;i<18;i++){text(targetPage,(i+1)+'. ........................................................................................................................',28,125+i*31,11,540);}}
 for(const [index,t] of targets.entries()){
  const content=(index+1)+'. '+[t.standard_code,t.target_code,t.target_description].filter(Boolean).join(' ')+' ('+(t.target_type==='learning_outcome'?'ผลการเรียนรู้':t.indicator_phase==='final'?'ปลายทาง':t.indicator_phase==='intermediate'?'ระหว่างทาง':'ตัวชี้วัด')+')';
  for(const line of lines(content,535,12)){if(ty>770){targetPage=page('ตัวชี้วัด / ผลการเรียนรู้ (ต่อ)',false);ty=100;}text(targetPage,line,28,ty,12);ty+=18;}ty+=10;
 }
 const pages=pdf.getPages();pages.forEach((p,i)=>{text(p,subject.subject_code+' · '+roomLabel,28,p.getHeight()-23,9,p.getWidth()-150);text(p,`หน้า ${i+1} / ${pages.length}`,p.getWidth()-28,p.getHeight()-23,9,100,'right');});
 return pdf.save();
}
