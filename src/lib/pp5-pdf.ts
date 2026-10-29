import {PDFDocument,rgb,degrees,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {REPORT_TYPE as PP5_TYPE} from './report-typography';
import {TRAITS,READING,QUALITY,eligibleForLesson,assessmentQuality,attendanceSessions,fullName,gender,pp5Score,pp5Readiness,weekOf,type Attendance,type CourseAssessment,type Target} from './pp5';
import type {TeacherWorkspace,TeacherOffering,TeacherStudent} from './use-teacher-workspace';
export type Pp5Signatories={assessment_head_name:string;academic_head_name:string;director_name:string};
export type Pp5Book={signatories:Pp5Signatories;data:TeacherWorkspace;offering:TeacherOffering;roster:TeacherStudent[];attendance:Attendance[];assessments:CourseAssessment[];targets:Target[];expected:number;schoolName:string;teacherName:string;homeroomNames:string[];learningHours:number;hourBasis:string;termStart:string|null};
// Shared print hierarchy (points), used by every sheet in the book.
export {REPORT_TYPE as PP5_TYPE} from './report-typography';
const MONTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export async function createPp5Pdf(book:Pp5Book){
 const {data,offering:o,roster,attendance,assessments,targets}=book;
 if(!pp5Readiness(data,o,roster,attendance,assessments,book.expected).ready)throw Error('ยังบันทึกข้อมูล ปพ.5 ไม่ครบ');
 if(!book.schoolName||!book.teacherName)throw Error('ข้อมูลโรงเรียนหรือครูผู้สอนไม่ครบ');
 const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
 async function asset(path:string){const r=await fetch(base+path);if(!r.ok)throw Error('โหลดแบบฟอร์ม ปพ.5 ไม่สำเร็จ');return r.arrayBuffer();}
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const [regularBytes,boldBytes,emblemBytes]=await Promise.all([asset('/pp6/THSarabunNew.ttf'),asset('/pp6/THSarabunNew-Bold.ttf'),asset('/pp5/obec-emblem.png')]);
 const regular=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true}),emblem=await pdf.embedPng(emblemBytes);
 const regularMetrics=fontkit.create(new Uint8Array(regularBytes)),boldMetrics=fontkit.create(new Uint8Array(boldBytes));
 const boundsCache=new Map<string,{min:number;max:number}>();
 // Match the shaped glyphs encoded by pdf-lib; spaces have no visible bounds.
 function inkBounds(value:string,size:number,strong=false){const key=Number(strong)+'#'+value;let bounds=boundsCache.get(key);if(!bounds){const metric=strong?boldMetrics:regularMetrics,glyphs=metric.layout(value).glyphs.filter(g=>Number.isFinite(g.bbox.minY)&&Number.isFinite(g.bbox.maxY));bounds={min:glyphs.length?Math.min(...glyphs.map(g=>g.bbox.minY))/metric.unitsPerEm:0,max:glyphs.length?Math.max(...glyphs.map(g=>g.bbox.maxY))/metric.unitsPerEm:0};boundsCache.set(key,bounds);}return {min:bounds.min*size,max:bounds.max*size};}
 const subject=data.subjects.find(s=>s.id===o.subject_id)!,room=data.rooms.find(r=>r.id===o.classroom_id)!,term=data.terms.find(t=>t.id===o.term_id)!,year=data.years.find(y=>y.id===room.academic_year_id)!;
 const roomLabel=room.room_code.startsWith(room.level_code+'/')?room.room_code:room.level_code+'/'+room.room_code,period=`ภาคเรียนที่ ${term.term_no}/${year.year_be}`;
 pdf.setTitle('ปพ.5 '+subject.subject_code+' '+subject.name_th);pdf.setAuthor(book.teacherName);
 const ink=rgb(0,0,0),pale=rgb(.94,.94,.94);
 function text(p:PDFPage,value:string|number,x:number,y:number,size:number=PP5_TYPE.body,width=1000,align:'left'|'center'|'right'='left',strong=false){
  const font=strong?bold:regular,str=String(value);let fit=size;while(font.widthOfTextAtSize(str,fit)>width&&fit>PP5_TYPE.note)fit=PP5_TYPE.note;
  const w=font.widthOfTextAtSize(str,fit);p.drawText(str,{x:align==='center'?x-w/2:align==='right'?x-w:x,y:p.getHeight()-y-fit,font,size:fit,color:ink});
 }
 function line(p:PDFPage,x:number,y:number,w:number,dashed=false){p.drawLine({start:{x,y:p.getHeight()-y},end:{x:x+w,y:p.getHeight()-y},thickness:.45,color:ink,...(dashed?{dashArray:[1.5,1.5]}:{})});}
 function box(p:PDFPage,x:number,y:number,w:number,h:number,shade=false){p.drawRectangle({x,y:p.getHeight()-y-h,width:w,height:h,borderWidth:.45,borderColor:ink,...(shade?{color:pale}:{})});}
 function cell(p:PDFPage,v:string|number,x:number,y:number,w:number,h:number,size:number=PP5_TYPE.body,strong=false,align:'left'|'center'='center',shade=false){
  box(p,x,y,w,h,shade);const font=strong?bold:regular,value=String(v),padding=1;
  let fit=size,lines=wrap(value,w-6,fit,font);
  const layout=()=>{const bounds=lines.map(part=>inkBounds(part,fit,strong));return {min:Math.min(...bounds.map((b,i)=>b.min-i*fit)),max:Math.max(...bounds.map((b,i)=>b.max-i*fit))};};
  let bounds=layout();
  // Retain the shared 14/12 pt hierarchy; fit exceptionally tall Thai names
  // within the row instead of letting upper/lower vowel marks cross a rule.
  if(bounds.max-bounds.min>h-padding*2&&fit>PP5_TYPE.note){fit=PP5_TYPE.note;lines=wrap(value,w-6,fit,font);bounds=layout();}
  if(bounds.max-bounds.min>h-padding*2&&lines.length>1){lines=[value.replace(/\n/g,' ')];bounds=layout();}
  if(lines.some(part=>font.widthOfTextAtSize(part,fit)>w-6)&&fit>PP5_TYPE.note){fit=PP5_TYPE.note;bounds=layout();}
  const baseline=p.getHeight()-y-h/2-(bounds.max+bounds.min)/2;
  lines.forEach((part,i)=>{const width=font.widthOfTextAtSize(part,fit);p.drawText(part,{x:align==='left'?x+3:x+(w-width)/2,y:baseline-i*fit,font,size:fit,color:ink});});
 }
 function vertical(p:PDFPage,v:string,x:number,y:number,w:number,h:number,size:number=PP5_TYPE.tableHeader){box(p,x,y,w,h);const bounds=inkBounds(v,size,true),width=bold.widthOfTextAtSize(v,size);p.drawText(v,{x:x+w/2+(bounds.max+bounds.min)/2,y:p.getHeight()-y-h/2-width/2,rotate:degrees(90),font:bold,size,color:ink});}
 function wrap(value:string,width:number,size:number=PP5_TYPE.body,font:PDFFont=regular){const out:string[]=[];for(const para of value.split('\n')){let part='';for(const {segment} of new Intl.Segmenter('th',{granularity:'grapheme'}).segment(para)){if(font.widthOfTextAtSize(part+segment,size)>width&&part){out.push(part);part=segment;}else part+=segment;}out.push(part);}return out;}
 const addPage=(landscape=false)=>pdf.addPage(landscape?[841.89,595.28]:[595.28,841.89]);
 const groupNames:Record<string,string>={'ท':'ภาษาไทย','ค':'คณิตศาสตร์','ว':'วิทยาศาสตร์และเทคโนโลยี','ส':'สังคมศึกษา ศาสนา และวัฒนธรรม','พ':'สุขศึกษาและพลศึกษา','ศ':'ศิลปะ','ง':'การงานอาชีพ','อ':'ภาษาต่างประเทศ'},group=groupNames[subject.subject_code[0]]??'—';
 const scores=roster.map(s=>pp5Score(data,o,s.id)),caps=scores[0].caps;
 // The cover follows 1.พิมพ์หน้าปก: emblem, inline metadata, summary tables and approval boxes.
 const cover=addPage();cover.drawImage(emblem,{x:279,y:cover.getHeight()-116,width:36,height:53});cell(cover,'ปพ.5',533.469,14.548,33.09,15.15,PP5_TYPE.note);
 text(cover,'แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน',297.5,123,PP5_TYPE.title,535,'center',true);text(cover,book.schoolName,297.5,151,PP5_TYPE.section,535,'center',true);
 // Uniform label/value alignment. Three equal columns for short facts;
 // two equal columns or a spanning field for longer course/staff details.
 const labelWidth=88,columns=[35,215,395],third=165,half=255;
 function field(label:string,value:string|number,x:number,y:number,w:number){text(cover,label,x,y,PP5_TYPE.body,labelWidth,'left',true);text(cover,value,x+labelWidth+4,y,PP5_TYPE.body,w-labelWidth-6);line(cover,x+labelWidth,y+19,w-labelWidth,true);}
 field('ชั้น',roomLabel,columns[0],181,third);field('ภาคเรียนที่',term.term_no,columns[1],181,third);field('ปีการศึกษา',year.year_be,columns[2],181,third);
 const male=roster.filter(s=>gender(s.name_prefix_th)===0).length,female=roster.filter(s=>gender(s.name_prefix_th)===1).length;
 field('นักเรียนชาย',male+' คน',columns[0],204,third);field('นักเรียนหญิง',female+' คน',columns[1],204,third);field('รวมทั้งหมด',roster.length+' คน',columns[2],204,third);
 field('รหัสวิชา',subject.subject_code,35,227,third);field('รายวิชา',subject.name_th,215,227,345);
 field('กลุ่มสาระการเรียนรู้',group,35,250,525);
 field('เวลาเรียนทั้งหมด',book.expected+' ชั่วโมง/ภาคเรียน',35,273,half);field('เวลาเรียน',book.expected/20+' ชั่วโมง/สัปดาห์',305,273,half);
 field('อัตราส่วนคะแนน',`เก็บ ${caps[0]} : กลางภาค ${caps[1]} : ปลายภาค ${caps[2]}`,35,296,345);field('หน่วยกิต',room.level_code.startsWith('ม.')?(book.expected/40).toFixed(2):'—',395,296,third);
 field('ครูผู้สอน',book.teacherName,35,319,525);field('ครูที่ปรึกษา 1.',book.homeroomNames[0]??'—',35,342,half);field('ครูที่ปรึกษา 2.',book.homeroomNames[1]??'—',305,342,half);
 const gx=35,gy=377,gw=525;cell(cover,'สรุปผลการพัฒนาผู้เรียน',gx,gy,gw,22,PP5_TYPE.section,true);
 const grades=['4','3.5','3','2.5','2','1.5','1','0','ร','มส'];const counts=grades.map(g=>scores.filter(s=>s.grade===g).length),numeric=scores.map(s=>Number(s.grade)).filter((n,i)=>scores[i].grade!=='—'&&scores[i].grade!==''&&Number.isFinite(n));
 const gradeWidths=[85,...grades.map(()=>29),45,105];const gradeRows=[['ระดับผลการเรียน',...grades,'รวม','ผลการเรียนเฉลี่ย'],['จำนวน (คน)',...counts,roster.length,numeric.length?(numeric.reduce((a,b)=>a+b,0)/numeric.length).toFixed(2):'—'],['ร้อยละ',...counts.map(n=>(100*n/roster.length).toFixed(1)),'100','']];
 gradeRows.forEach((row,j)=>{let x=gx;row.forEach((v,i)=>{cell(cover,v,x,gy+22+j*19,gradeWidths[i],19,j===0?PP5_TYPE.tableHeader:PP5_TYPE.body,j===0);x+=gradeWidths[i];});});
 if(scores.some(s=>s.grade==='—'))text(cover,'ยังไม่สรุปเกรด '+scores.filter(s=>s.grade==='—').length+' คน (คะแนนรายปีต้องครบทั้งสองภาคเรียน)',35,459,PP5_TYPE.note,525);
 function qualityTable(groupType:'traits'|'reading',x:number,width:number,title:string){const y=481;cell(cover,title,x,y,width,23,PP5_TYPE.section,true);const widths=[width*.34,width*.36,width*.30];let xx=x;['ระดับคุณภาพ','จำนวน (คน)','ร้อยละ'].forEach((v,i)=>{cell(cover,v,xx,y+23,widths[i],20,PP5_TYPE.tableHeader,true);xx+=widths[i];});[3,2,1,0].forEach((q,i)=>{const count=assessments.filter(a=>roster.some(s=>s.id===a.student_id)&&assessmentQuality(groupType==='traits'?a.trait_scores:a.reading_scores,groupType)===q).length;let xx=x;[QUALITY[q],count,(100*count/roster.length).toFixed(1)].forEach((v,j)=>{cell(cover,v,xx,y+43+i*20,widths[j],20,PP5_TYPE.body);xx+=widths[j];});});}
 qualityTable('traits',35,255,'การประเมินคุณลักษณะอันพึงประสงค์');qualityTable('reading',305,255,'การประเมินการอ่าน คิดวิเคราะห์ และเขียน');
 box(cover,35,617,255,176);box(cover,305,617,255,176);text(cover,'การอนุมัติผลการพัฒนาผู้เรียน',42,625,PP5_TYPE.section,240,'left',true);text(cover,'เรียนเสนอเพื่อพิจารณา',315,625,PP5_TYPE.section,235,'left',true);
 const coverName=(name:string)=>name.trim()||'........................................';
 for(const [i,role] of ['ครูผู้สอน','หัวหน้างานวัดและประเมินผล','หัวหน้าฝ่ายวิชาการ'].entries()){const y=648+i*46;const signer=[book.teacherName,book.signatories.assessment_head_name,book.signatories.academic_head_name][i];text(cover,'ลงชื่อ ...........................................',162.5,y,PP5_TYPE.body,240,'center');text(cover,'( '+coverName(signer)+' )',162.5,y+15,PP5_TYPE.body,240,'center');text(cover,role,162.5,y+29,PP5_TYPE.body,240,'center');}
 text(cover,'ลงชื่อ ............................................................',317,659,PP5_TYPE.body,235);text(cover,'( '+coverName(book.signatories.director_name)+' )',432,683,PP5_TYPE.body,235,'center');text(cover,'ผู้อำนวยการ'+book.schoolName,432,705,PP5_TYPE.body,235,'center');text(cover,'[  ] อนุมัติ     [  ] ไม่อนุมัติ',432,729,PP5_TYPE.body,235,'center');text(cover,'............... / ............... / ...............',432,758,PP5_TYPE.body,235,'center');
 // Twenty-five weekday columns per five-week page, preserving the source's four header rows.
 const sessions=attendanceSessions(attendance),anchor=book.termStart&&book.termStart<=sessions[0].date?book.termStart:sessions[0].date,monday=new Date(anchor+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const weeks=Math.max(20,...sessions.map(s=>weekOf(s.date,anchor)+1)),lookup=new Map(attendance.map(a=>[a.student_id+'#'+a.class_date+'#'+a.session_no,a.attendance_status]));
 const rowsPerPage=30;
 const marks:Record<string,string>={present:'/',absent:'ข',late:'ส',leave:'ล'},chunks:TeacherStudent[][]=[];for(let i=0;i<roster.length;i+=rowsPerPage)chunks.push(roster.slice(i,i+rowsPerPage));
 const weekend=sessions.filter(s=>new Date(s.date+'T00:00:00Z').getUTCDay()%6===0);
 const attendanceBlocks=Array.from({length:Math.ceil(weeks/5)},(_,block)=>Array.from({length:25},(_,i)=>{const date=new Date(monday);date.setUTCDate(date.getUTCDate()+block*35+Math.floor(i/5)*7+i%5);const iso=date.toISOString().slice(0,10);return {date:iso,week:block*5+Math.floor(i/5)+1,periods:sessions.filter(s=>s.date===iso).map(s=>s.period)};}));
 if(weekend.length)attendanceBlocks.push(weekend.map(s=>({date:s.date,week:weekOf(s.date,anchor)+1,periods:[s.period]})));
 attendanceBlocks.forEach((days,block)=>{for(const chunk of chunks){const p=addPage(true),x=18,y=48,left=[20,40,135,45],dayW=440/days.length,summaryWidths=[18,18,18,18,20,23,20],dayX=x+240,summaryX=dayX+440;
 text(p,'แบบบันทึกเวลาเรียน',421,3,PP5_TYPE.title,805,'center',true);text(p,`รายวิชา ${subject.subject_code} ${subject.name_th} ${period} ผู้สอน ${book.teacherName}`,421,25,PP5_TYPE.body,805,'center');
 cell(p,'เลขที่',x,y,left[0],56,PP5_TYPE.tableHeader,true);cell(p,'เลขประจำตัว',x+20,y,left[1],56,PP5_TYPE.tableHeader,true);cell(p,'ชื่อ-สกุล',x+60,y,left[2],56,PP5_TYPE.tableHeader,true);
 ['สัปดาห์ที่','เดือน','วันที่','ชั่วโมง'].forEach((v,i)=>cell(p,v,x+195,y+i*14,45,14,PP5_TYPE.tableHeader,true));
 let from=0;while(from<days.length){let to=from+1;while(to<days.length&&days[to].week===days[from].week)to++;cell(p,days[from].week,dayX+from*dayW,y,(to-from)*dayW,14,PP5_TYPE.tableHeader,true);from=to;}
 days.forEach((d,i)=>{const xx=dayX+i*dayW;cell(p,MONTHS[Number(d.date.slice(5,7))-1],xx,y+14,dayW,14,PP5_TYPE.tableHeader);cell(p,Number(d.date.slice(8)),xx,y+28,dayW,14,PP5_TYPE.tableHeader);cell(p,d.periods.join(','),xx,y+42,dayW,14,PP5_TYPE.tableHeader,false,'center',!d.periods.length);});
 let sx=summaryX;['มาเรียน','ขาดเรียน','มาสาย','ลา','รวมเวลาเรียน','ร้อยละ','หมายเหตุ'].forEach((v,i)=>{vertical(p,v,sx,y,summaryWidths[i],56,PP5_TYPE.tableHeader);sx+=summaryWidths[i];});
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],yy=y+56+i*15.5;cell(p,roster.indexOf(chunk[0])+i+1,x,yy,20,15.5,PP5_TYPE.body);cell(p,s?.student_no??'',x+20,yy,40,15.5,PP5_TYPE.body);cell(p,s?fullName(s):'',x+60,yy,180,15.5,PP5_TYPE.body,false,'left');const values:string[]=[];
 days.forEach((d,j)=>{const eligible=s&&eligibleForLesson(data,o,s.id,d.date),statuses=eligible?d.periods.map(period=>lookup.get(s!.id+'#'+d.date+'#'+period)??''):[];values.push(...statuses);cell(p,s?(eligible?statuses.map(st=>marks[st]??'—').join(''):'—'):'',dayX+j*dayW,yy,dayW,15.5,PP5_TYPE.body,false,'center',!d.periods.length);});
 const counts=['present','absent','late','leave'].map(v=>values.filter(a=>a===v).length),total=values.length,present=counts[0]+counts[2];let xx=summaryX;[...counts,total,total?(100*present/total).toFixed(0):'',''].forEach((v,j)=>{cell(p,s?v:'',xx,yy,summaryWidths[j],15.5,PP5_TYPE.body);xx+=summaryWidths[j];});}
 text(p,'/ มาเรียน   ข ขาดเรียน   ส มาสาย   ล ลา | หลายคาบในวันเดียวเรียงตามแถวชั่วโมง | ช่องสีเทาไม่มีคาบ',18,577,PP5_TYPE.note,805);
 }});
 // Keep scores, traits and reading on separate sheets, with the same roster chunks.
 const annual=!room.level_code.startsWith('ม.');
 function sheetHeader(p:PDFPage,title:string,width:number,scoreSheet=false){
  const center=p.getWidth()/2;
  text(p,title,center,3,PP5_TYPE.title,width,'center',true);
  text(p,`${scoreSheet&&annual?'ปีการศึกษา '+year.year_be+' · คะแนนภาคเรียนที่ 1 และ 2':period} ชั้น ${roomLabel} รายวิชา ${subject.subject_code} ${subject.name_th}`,center,25,PP5_TYPE.body,width,'center');
  text(p,'ครูผู้สอน '+book.teacherName,center,41,PP5_TYPE.body,width,'center');
 }
 function mergedCell(p:PDFPage,v:string,x:number,y:number,w:number,h:number){cell(p,v,x,y,w,h,PP5_TYPE.tableHeader,true);}
 for(const chunk of chunks){const p=addPage(annual),x=18,y=64,rowHeight=annual?15:21,headerHeight=annual?60:84,groupHeight=annual?16:20,labelHeight=annual?28:44,capHeight=annual?16:20,ws=annual?[24,210,...Array(8).fill(50),70,60,32]:[24,210,...Array(5).fill(55),50],xs=[x];ws.forEach(w=>xs.push(xs[xs.length-1]+w));
 const note=ws.length-1,width=xs[ws.length]-x;
 sheetHeader(p,'บันทึกผลการพัฒนาผู้เรียน',width,true);
 const merged=(v:string,a:number,b:number,yy:number,h:number)=>mergedCell(p,v,xs[a],yy,xs[b]-xs[a],h);
 const scoreHeader=(label:string,j:number)=>merged(label,j,j+1,y+groupHeight,labelHeight);
 merged('เลขที่',0,1,y,headerHeight);merged('ชื่อ-สกุล',1,2,y,headerHeight);
 if(annual){merged('ภาคเรียนที่ 1',2,6,y,groupHeight);merged('ภาคเรียนที่ 2',6,10,y,groupHeight);for(const start of [2,6])['คะแนน\nเก็บ','กลาง\nภาค','ปลาย\nภาค','รวม\nภาคเรียน'].forEach((label,i)=>scoreHeader(label,start+i));merged('รวมทั้งปี',10,11,y,groupHeight+labelHeight);merged('ระดับผล\nการเรียน',11,12,y,groupHeight+labelHeight);
 const yc=scores[0].yearCaps;[...yc.slice(0,3),yc.slice(0,3).reduce((a,b)=>a+b,0),...yc.slice(3),yc.slice(3).reduce((a,b)=>a+b,0),yc.reduce((a,b)=>a+b,0),'—'].forEach((cap,i)=>cell(p,cap,xs[i+2],y+headerHeight-capHeight,ws[i+2],capHeight));
 }else{merged('คะแนนผลการเรียน',2,7,y,20);['คะแนน\nเก็บ','กลาง\nภาค','ปลาย\nภาค','รวม\nคะแนน','ระดับผล\nการเรียน'].forEach((label,i)=>scoreHeader(label,i+2));[...caps,caps.reduce((a,b)=>a+b,0),'—'].forEach((cap,i)=>cell(p,cap,xs[i+2],y+headerHeight-capHeight,ws[i+2],capHeight));}
 vertical(p,'หมายเหตุ',xs[note],y,ws[note],headerHeight);
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],score=s?pp5Score(data,o,s.id):null,row=Array<string|number>(ws.length).fill('');row[0]=roster.indexOf(chunk[0])+i+1;
 if(s&&score){row[1]=fullName(s);if(annual){for(let j=0;j<3;j++){row[2+j]=score.yearScores[j]??'—';row[6+j]=score.yearScores[j+3]??'—';}row[5]=score.termTotals[0]??'—';row[9]=score.termTotals[1]??'—';row[10]=score.annualTotal??'—';row[11]=score.grade;}else{score.scores.forEach((v,j)=>row[j+2]=v??'—');row[5]=score.total??'—';row[6]=score.grade;}row[note]=['ร','มส'].includes(score.grade)?score.grade:'';}
 row.forEach((v,j)=>cell(p,v,xs[j],y+headerHeight+i*rowHeight,ws[j],rowHeight,PP5_TYPE.body,false,j===1?'left':'center'));}
 if(annual)text(p,'รวมปีและเกรดสรุปเมื่อคะแนนครบทั้งสองภาคเรียน',18,577,PP5_TYPE.note,width-110);
 }
 // Assessments retain the selected offering's term; do not copy scores between terms.
 for(const kind of ['traits','reading'] as const){const labels=kind==='traits'?TRAITS:READING,title=kind==='traits'?'ประเมินคุณลักษณะอันพึงประสงค์':'ประเมินการอ่าน คิดวิเคราะห์ และเขียน';
 for(const chunk of chunks){const p=addPage(),x=18,y=64,headerHeight=120,rowHeight=19.5,ws=[24,195,...labels.map(()=>240/labels.length),60,40],xs=[x];ws.forEach(w=>xs.push(xs[xs.length-1]+w));
 const result=labels.length+2,note=result+1,width=xs[ws.length]-x;sheetHeader(p,title,width);
 mergedCell(p,'เลขที่',xs[0],y,ws[0],headerHeight);mergedCell(p,'ชื่อ-สกุล',xs[1],y,ws[1],headerHeight);
 mergedCell(p,'ผลการประเมินภาคเรียนที่ '+term.term_no,xs[2],y,xs[result]-xs[2],20);
 labels.forEach((label,i)=>{vertical(p,label,xs[i+2],y+20,ws[i+2],80);cell(p,3,xs[i+2],y+100,ws[i+2],20);});
 vertical(p,'ผลการประเมิน',xs[result],y,ws[result],100);cell(p,'—',xs[result],y+100,ws[result],20);vertical(p,'หมายเหตุ',xs[note],y,ws[note],headerHeight);
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],a=s?assessments.find(a=>a.student_id===s.id):null,row=Array<string|number>(ws.length).fill('');row[0]=roster.indexOf(chunk[0])+i+1;
 if(s&&a){const values=kind==='traits'?a.trait_scores:a.reading_scores;row[1]=fullName(s);labels.forEach((_,j)=>row[j+2]=values?.[j]??'—');row[result]=assessmentQuality(values,kind)??'—';}
 row.forEach((v,j)=>cell(p,v,xs[j],y+headerHeight+i*rowHeight,ws[j],rowHeight,PP5_TYPE.body,false,j===1?'left':'center'));}
 text(p,'ระดับคุณภาพ 0 ไม่ผ่าน   1 ผ่าน   2 ดี   3 ดีเยี่ยม',18,790,PP5_TYPE.note,width);
 }}
 // 5.พิมพ์ ตชว: metadata first, then the original numbered writing lines.
 let targetPage:PDFPage;let ty=0;
 function targetSheet(continued=false){const p=addPage();text(p,'ตัวชี้วัด/ผลการเรียนรู้'+(continued?' (ต่อ)':''),297.5,63,PP5_TYPE.title,540,'center',true);text(p,'รหัสวิชา '+subject.subject_code,35,111,PP5_TYPE.body,240);text(p,'รายวิชา '+subject.name_th,300,111,PP5_TYPE.body,260);text(p,'กลุ่มสาระการเรียนรู้ '+group,35,139,PP5_TYPE.body,260);text(p,'ครูผู้สอน '+book.teacherName,300,139,PP5_TYPE.body,260);text(p,'ตัวชี้วัด/ผลการเรียนรู้ จำนวน '+targets.length+' ตัว',35,179,PP5_TYPE.body,525);return p;}
 targetPage=targetSheet();ty=225;
 if(!targets.length){for(let i=0;i<13;i++){text(targetPage,(i+1)+'.',35,ty,PP5_TYPE.body);line(targetPage,55,ty+18,505,true);line(targetPage,55,ty+36,505,true);ty+=43;}}
 for(const [index,t] of targets.entries()){const content=(index+1)+'. '+[t.standard_code,t.target_code,t.target_description].filter(Boolean).join(' ');for(const v of wrap(content,525,PP5_TYPE.body)){if(ty>775){targetPage=targetSheet(true);ty=225;}text(targetPage,v,35,ty,PP5_TYPE.body,525);ty+=19;}ty+=16;}
 const pages=pdf.getPages();pages.forEach((p,i)=>{text(p,`หน้า ${i+1} / ${pages.length}`,p.getWidth()-18,p.getHeight()-18,PP5_TYPE.note,100,'right');});return pdf.save();
}
