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
 const margin=72,portraitWidth=595.28-144,landscapeWidth=841.89-144;
 let cover:PDFPage;
 const coverScale=portraitWidth/525;
 const coverX=(x:number)=>margin+(x-35)*coverScale;
 const coverY=(y:number)=>margin+Math.max(0,y-63)*.9;
 const ink=rgb(0,0,0),pale=rgb(.94,.94,.94);
 function text(p:PDFPage,value:string|number,x:number,y:number,size:number=PP5_TYPE.body,width=1000,align:'left'|'center'|'right'='left',strong=false){
  if(p===cover){x=coverX(x);y=coverY(y);width*=coverScale;}
  const font=strong?bold:regular;
  wrap(String(value),width,size,font).forEach((part,i)=>{const w=font.widthOfTextAtSize(part,size);p.drawText(part,{x:align==='center'?x-w/2:align==='right'?x-w:x,y:p.getHeight()-y-size-i*size,font,size,color:ink});});
 }
 function line(p:PDFPage,x:number,y:number,w:number,dashed=false){if(p===cover){x=coverX(x);y=coverY(y);w*=coverScale;}p.drawLine({start:{x,y:p.getHeight()-y},end:{x:x+w,y:p.getHeight()-y},thickness:.45,color:ink,...(dashed?{dashArray:[1.5,1.5]}:{})});}
 function rawBox(p:PDFPage,x:number,y:number,w:number,h:number,shade=false){p.drawRectangle({x,y:p.getHeight()-y-h,width:w,height:h,borderWidth:.45,borderColor:ink,...(shade?{color:pale}:{})});}
 function box(p:PDFPage,x:number,y:number,w:number,h:number,shade=false){if(p===cover){x=coverX(x);y=coverY(y);w*=coverScale;h*=.9;}rawBox(p,x,y,w,h,shade);}
 function cell(p:PDFPage,v:string|number,x:number,y:number,w:number,h:number,size:number=PP5_TYPE.body,strong=false,align:'left'|'center'='center',shade=false){
  if(p===cover){x=coverX(x);y=coverY(y);w*=coverScale;h*=.9;}
  rawBox(p,x,y,w,h,shade);const font=strong?bold:regular,lines=wrap(String(v),w-2,size,font);
  const bounds=lines.map(part=>inkBounds(part,size,strong));
  const min=Math.min(...bounds.map((b,i)=>b.min-i*size)),max=Math.max(...bounds.map((b,i)=>b.max-i*size));
  const baseline=p.getHeight()-y-h/2-(max+min)/2;
  lines.forEach((part,i)=>{const width=font.widthOfTextAtSize(part,size);p.drawText(part,{x:align==='left'?x+1:x+(w-width)/2,y:baseline-i*size,font,size,color:ink});});
 }

 function vertical(p:PDFPage,v:string,x:number,y:number,w:number,h:number,size:number=PP5_TYPE.tableHeader){box(p,x,y,w,h);const parts=wrap(v,h-6,size,bold);
 parts.forEach((part,i)=>{const bounds=inkBounds(part,size,true),width=bold.widthOfTextAtSize(part,size);p.drawText(part,{x:x+w/2+(bounds.max+bounds.min)/2+(i-(parts.length-1)/2)*size,y:p.getHeight()-y-h/2-width/2,rotate:degrees(90),font:bold,size,color:ink});});
 }

 function wrap(value:string,width:number,size:number=PP5_TYPE.body,font:PDFFont=regular){const out:string[]=[];for(const para of value.split('\n')){let part='';for(const {segment} of new Intl.Segmenter('th',{granularity:'grapheme'}).segment(para)){if(font.widthOfTextAtSize(part+segment,size)>width&&part){out.push(part);part=segment;}else part+=segment;}out.push(part);}return out;}
 const addPage=(landscape=false)=>pdf.addPage(landscape?[841.89,595.28]:[595.28,841.89]);
 const groupNames:Record<string,string>={'ท':'ภาษาไทย','ค':'คณิตศาสตร์','ว':'วิทยาศาสตร์และเทคโนโลยี','ส':'สังคมศึกษา ศาสนา และวัฒนธรรม','พ':'สุขศึกษาและพลศึกษา','ศ':'ศิลปะ','ง':'การงานอาชีพ','อ':'ภาษาต่างประเทศ'},group=groupNames[subject.subject_code[0]]??'—';
 const scores=roster.map(s=>pp5Score(data,o,s.id)),caps=scores[0].caps;
 // The cover follows 1.พิมพ์หน้าปก: emblem, inline metadata, summary tables and approval boxes.
 cover=addPage();cover.drawImage(emblem,{x:279,y:cover.getHeight()-margin-53,width:36,height:53});cell(cover,'ปพ.5',521.469,63,33.09,15.15,PP5_TYPE.note);
 text(cover,'แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน',297.5,123,PP5_TYPE.title,535,'center',true);text(cover,book.schoolName,297.5,151,PP5_TYPE.section,535,'center',true);
 // Uniform label/value alignment. Three equal columns for short facts;
 // two equal columns or a spanning field for longer course/staff details.
 const labelWidth=88,columns=[35,215,395],third=165,half=255;
 function field(label:string,value:string|number,x:number,y:number,w:number){const labelSpace=label==='เวลาเรียน'?70:labelWidth;text(cover,label,x,y,PP5_TYPE.body,labelSpace,'left',true);text(cover,value,x+labelSpace+4,y,PP5_TYPE.body,w-labelSpace-6);line(cover,x+labelSpace,y+19,w-labelSpace,true);}
 field('ชั้น',roomLabel,columns[0],181,third);field('ภาคเรียนที่',term.term_no,columns[1],181,third);field('ปีการศึกษา',year.year_be,columns[2],181,third);
 const male=roster.filter(s=>gender(s.name_prefix_th)===0).length,female=roster.filter(s=>gender(s.name_prefix_th)===1).length;
 field('นักเรียนชาย',male+' คน',columns[0],204,third);field('นักเรียนหญิง',female+' คน',columns[1],204,third);field('รวมทั้งหมด',roster.length+' คน',columns[2],204,third);
 field('รหัสวิชา',subject.subject_code,35,227,third);field('รายวิชา',subject.name_th,215,227,345);
 field('กลุ่มสาระการเรียนรู้',group,35,250,525);
 field('เวลาเรียนทั้งหมด',book.expected+' ชั่วโมง/ภาคเรียน',35,273,345);field('เวลาเรียน',book.expected/20+' ชั่วโมง/สัปดาห์',395,273,third);
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
 const directorCenter=305+255/2;
 text(cover,'ลงชื่อ ............................................................',directorCenter,659,PP5_TYPE.body,235,'center');text(cover,'( '+coverName(book.signatories.director_name)+' )',directorCenter,683,PP5_TYPE.body,235,'center');text(cover,'ผู้อำนวยการ'+book.schoolName,directorCenter,705,PP5_TYPE.body,235,'center');text(cover,'[  ] อนุมัติ     [  ] ไม่อนุมัติ',directorCenter,729,PP5_TYPE.body,235,'center');text(cover,'............... / ............... / ...............',directorCenter,758,PP5_TYPE.body,235,'center');
 // Twenty weekday columns per four-week page, preserving all four header rows.
 const sessions=attendanceSessions(attendance),anchor=book.termStart&&book.termStart<=sessions[0].date?book.termStart:sessions[0].date,monday=new Date(anchor+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const weeks=Math.max(20,...sessions.map(s=>weekOf(s.date,anchor)+1)),lookup=new Map(attendance.map(a=>[a.student_id+'#'+a.class_date+'#'+a.session_no,a.attendance_status]));
 const rowSize=12,rowHeight=13.6,rowsPerPage=25;
 const marks:Record<string,string>={present:'/',absent:'ข',late:'ส',leave:'ล'},chunks:TeacherStudent[][]=[];for(let i=0;i<roster.length;i+=rowsPerPage)chunks.push(roster.slice(i,i+rowsPerPage));
 const weekend=sessions.filter(s=>new Date(s.date+'T00:00:00Z').getUTCDay()%6===0);
 const attendanceBlocks=Array.from({length:Math.ceil(weeks/4)},(_,block)=>Array.from({length:20},(_,i)=>{const date=new Date(monday);date.setUTCDate(date.getUTCDate()+block*28+Math.floor(i/5)*7+i%5);const iso=date.toISOString().slice(0,10);return {date:iso,week:block*4+Math.floor(i/5)+1,periods:sessions.filter(s=>s.date===iso).map(s=>s.period)};}));
 if(weekend.length)attendanceBlocks.push(weekend.map(s=>({date:s.date,week:weekOf(s.date,anchor)+1,periods:[s.period]})));
 attendanceBlocks.forEach((days,block)=>{for(const chunk of chunks){const p=addPage(true),x=margin,y=94+wrap(`รายวิชา ${subject.subject_code} ${subject.name_th} ${period} ผู้สอน ${book.teacherName}`,landscapeWidth).length*PP5_TYPE.body+2,left=[20,38,150,40],dayW=(landscapeWidth-248-135)/days.length,summaryWidths=[18,18,18,18,20,23,20],dayX=x+248,summaryX=x+landscapeWidth-135;
 text(p,'แบบบันทึกเวลาเรียน',421,margin,PP5_TYPE.title,landscapeWidth,'center',true);text(p,`รายวิชา ${subject.subject_code} ${subject.name_th} ${period} ผู้สอน ${book.teacherName}`,421,94,PP5_TYPE.body,landscapeWidth,'center');
 cell(p,'เลขที่',x,y,left[0],56,PP5_TYPE.tableHeader,true);cell(p,'เลขประจำตัว',x+20,y,left[1],56,PP5_TYPE.tableHeader,true);cell(p,'ชื่อ-สกุล',x+58,y,left[2],56,PP5_TYPE.tableHeader,true);
 ['สัปดาห์ที่','เดือน','วันที่','ชั่วโมง'].forEach((v,i)=>cell(p,v,x+208,y+i*14,40,14,PP5_TYPE.tableHeader,true));
 let from=0;while(from<days.length){let to=from+1;while(to<days.length&&days[to].week===days[from].week)to++;cell(p,days[from].week,dayX+from*dayW,y,(to-from)*dayW,14,PP5_TYPE.tableHeader,true);from=to;}
 from=0;while(from<days.length){let to=from+1;while(to<days.length&&days[to].date.slice(0,7)===days[from].date.slice(0,7))to++;cell(p,MONTHS[Number(days[from].date.slice(5,7))-1],dayX+from*dayW,y+14,(to-from)*dayW,14,PP5_TYPE.tableHeader);from=to;}
 days.forEach((d,i)=>{const xx=dayX+i*dayW;cell(p,Number(d.date.slice(8)),xx,y+28,dayW,14,PP5_TYPE.tableHeader);cell(p,d.periods.join(','),xx,y+42,dayW,14,PP5_TYPE.tableHeader,false,'center',!d.periods.length);});

 let sx=summaryX;['มาเรียน','ขาดเรียน','มาสาย','ลา','รวมเวลาเรียน','ร้อยละ','หมายเหตุ'].forEach((v,i)=>{vertical(p,v,sx,y,summaryWidths[i],56,PP5_TYPE.tableHeader);sx+=summaryWidths[i];});
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],yy=y+56+i*rowHeight;cell(p,roster.indexOf(chunk[0])+i+1,x,yy,20,rowHeight,rowSize);cell(p,s?.student_no??'',x+20,yy,38,rowHeight,rowSize);cell(p,s?fullName(s):'',x+58,yy,190,rowHeight,rowSize,false,'left');const values:string[]=[];
 days.forEach((d,j)=>{const eligible=s&&eligibleForLesson(data,o,s.id,d.date),statuses=eligible?d.periods.map(period=>lookup.get(s!.id+'#'+d.date+'#'+period)??''):[];values.push(...statuses);cell(p,s?(eligible?statuses.map(st=>marks[st]??'—').join(''):'—'):'',dayX+j*dayW,yy,dayW,rowHeight,rowSize,false,'center',!d.periods.length);});
 const counts=['present','absent','late','leave'].map(v=>values.filter(a=>a===v).length),total=values.length,present=counts[0]+counts[2];let xx=summaryX;[...counts,total,total?(100*present/total).toFixed(0):'',''].forEach((v,j)=>{cell(p,s?v:'',xx,yy,summaryWidths[j],rowHeight,rowSize);xx+=summaryWidths[j];});}

 }});
 // Keep scores, traits and reading on separate sheets, with the same roster chunks.
 const annual=!room.level_code.startsWith('ม.');
 function sheetHeader(p:PDFPage,title:string,width:number,scoreSheet=false){
  const center=p.getWidth()/2;
  text(p,title,center,margin,PP5_TYPE.title,width,'center',true);
  const subtitle=`${scoreSheet&&annual?'ปีการศึกษา '+year.year_be+' · คะแนนภาคเรียนที่ 1 และ 2':period} ชั้น ${roomLabel} รายวิชา ${subject.subject_code} ${subject.name_th} ครูผู้สอน ${book.teacherName}`;
  const lines=wrap(subtitle,width,PP5_TYPE.body);
  lines.forEach((value,i)=>text(p,value,center,94+i*PP5_TYPE.body,PP5_TYPE.body,width,'center'));
  return 94+lines.length*PP5_TYPE.body+2;
 }

 function mergedCell(p:PDFPage,v:string,x:number,y:number,w:number,h:number){cell(p,v,x,y,w,h,PP5_TYPE.tableHeader,true);}
 for(const chunk of chunks){const p=addPage(annual),x=margin,headerHeight=60,groupHeight=16,labelHeight=28,capHeight=16,ws=annual?[24,200,...Array(8).fill(42),52,54,31.89]:[24,200,35,35,35,45,45,32.28],xs=[x];ws.forEach(w=>xs.push(xs[xs.length-1]+w));
 const y=sheetHeader(p,'บันทึกผลการพัฒนาผู้เรียน',annual?landscapeWidth:portraitWidth,true);

 const note=ws.length-1,width=xs[ws.length]-x;

 const merged=(v:string,a:number,b:number,yy:number,h:number)=>mergedCell(p,v,xs[a],yy,xs[b]-xs[a],h);
 const scoreHeader=(label:string,j:number)=>merged(label,j,j+1,y+groupHeight,labelHeight);
 merged('เลขที่',0,1,y,headerHeight);merged('ชื่อ-สกุล',1,2,y,headerHeight);
 if(annual){merged('ภาคเรียนที่ 1',2,6,y,groupHeight);merged('ภาคเรียนที่ 2',6,10,y,groupHeight);for(const start of [2,6])['คะแนน\nเก็บ','กลาง\nภาค','ปลาย\nภาค','รวม\nภาคเรียน'].forEach((label,i)=>scoreHeader(label,start+i));merged('รวมทั้งปี',10,11,y,groupHeight+labelHeight);merged('ระดับผล\nการเรียน',11,12,y,groupHeight+labelHeight);
 const yc=scores[0].yearCaps;[...yc.slice(0,3),yc.slice(0,3).reduce((a,b)=>a+b,0),...yc.slice(3),yc.slice(3).reduce((a,b)=>a+b,0),yc.reduce((a,b)=>a+b,0),'—'].forEach((cap,i)=>cell(p,cap,xs[i+2],y+headerHeight-capHeight,ws[i+2],capHeight));
 }else{merged('คะแนนผลการเรียน',2,7,y,groupHeight);['คะแนน\nเก็บ','กลาง\nภาค','ปลาย\nภาค','รวม\nคะแนน','ระดับผล\nการเรียน'].forEach((label,i)=>scoreHeader(label,i+2));[...caps,caps.reduce((a,b)=>a+b,0),'—'].forEach((cap,i)=>cell(p,cap,xs[i+2],y+headerHeight-capHeight,ws[i+2],capHeight));}
 vertical(p,'หมายเหตุ',xs[note],y,ws[note],headerHeight);
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],score=s?pp5Score(data,o,s.id):null,row=Array<string|number>(ws.length).fill('');row[0]=roster.indexOf(chunk[0])+i+1;
 if(s&&score){row[1]=fullName(s);if(annual){for(let j=0;j<3;j++){row[2+j]=score.yearScores[j]??'—';row[6+j]=score.yearScores[j+3]??'—';}row[5]=score.termTotals[0]??'—';row[9]=score.termTotals[1]??'—';row[10]=score.annualTotal??'—';row[11]=score.grade;}else{score.scores.forEach((v,j)=>row[j+2]=v??'—');row[5]=score.total??'—';row[6]=score.grade;}row[note]=['ร','มส'].includes(score.grade)?score.grade:'';}
 row.forEach((v,j)=>cell(p,v,xs[j],y+headerHeight+i*rowHeight,ws[j],rowHeight,rowSize,false,j===1?'left':'center'));}

 }
 // Assessments retain the selected offering's term; do not copy scores between terms.
 for(const kind of ['traits','reading'] as const){const labels=kind==='traits'?TRAITS:READING,title=kind==='traits'?'ประเมินคุณลักษณะอันพึงประสงค์':'ประเมินการอ่าน คิดวิเคราะห์ และเขียน';
 for(const chunk of chunks){const p=addPage(true),x=margin,headerHeight=62,ws=[24,200,...labels.map(()=>400/labels.length),40,33.89],xs=[x];ws.forEach(w=>xs.push(xs[xs.length-1]+w));
 const result=labels.length+2,note=result+1,width=xs[ws.length]-x,y=sheetHeader(p,title,width);

 mergedCell(p,'เลขที่',xs[0],y,ws[0],headerHeight);mergedCell(p,'ชื่อ-สกุล',xs[1],y,ws[1],headerHeight);
 mergedCell(p,'ผลการประเมินภาคเรียนที่ '+term.term_no,xs[2],y,xs[result]-xs[2],14);
 labels.forEach((label,i)=>{vertical(p,label,xs[i+2],y+14,ws[i+2],34);cell(p,3,xs[i+2],y+48,ws[i+2],14);});
 vertical(p,'ผลการประเมิน',xs[result],y,ws[result],48);cell(p,'—',xs[result],y+48,ws[result],14);vertical(p,'หมายเหตุ',xs[note],y,ws[note],headerHeight);
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],a=s?assessments.find(a=>a.student_id===s.id):null,row=Array<string|number>(ws.length).fill('');row[0]=roster.indexOf(chunk[0])+i+1;
 if(s&&a){const values=kind==='traits'?a.trait_scores:a.reading_scores;row[1]=fullName(s);labels.forEach((_,j)=>row[j+2]=values?.[j]??'—');row[result]=assessmentQuality(values,kind)??'—';}
 row.forEach((v,j)=>cell(p,v,xs[j],y+headerHeight+i*rowHeight,ws[j],rowHeight,rowSize,false,j===1?'left':'center'));}

 }}
 // 5.พิมพ์ ตชว: metadata first, then the original numbered writing lines.
 let targetPage:PDFPage;let ty=0;
 function targetSheet(continued=false){const p=addPage();
 text(p,'ตัวชี้วัด/ผลการเรียนรู้'+(continued?' (ต่อ)':''),p.getWidth()/2,margin,PP5_TYPE.title,portraitWidth,'center',true);
 let y=104;
 for(const value of ['รหัสวิชา '+subject.subject_code+' รายวิชา '+subject.name_th,'กลุ่มสาระการเรียนรู้ '+group,'ครูผู้สอน '+book.teacherName,'ตัวชี้วัด/ผลการเรียนรู้ จำนวน '+targets.length+' ตัว']){
  const lines=wrap(value,portraitWidth);lines.forEach(value=>{text(p,value,margin,y,PP5_TYPE.body,portraitWidth);y+=18;});
 }ty=y+14;return p;}
 targetPage=targetSheet();
 if(!targets.length){for(let i=0;i<10;i++){if(ty+36>targetPage.getHeight()-margin-24)targetPage=targetSheet(true);text(targetPage,(i+1)+'.',margin,ty,PP5_TYPE.body);line(targetPage,margin+20,ty+18,portraitWidth-20,true);line(targetPage,margin+20,ty+36,portraitWidth-20,true);ty+=45;}}
 for(const [index,t] of targets.entries()){const content=(index+1)+'. '+[t.standard_code,t.target_code,t.target_description].filter(Boolean).join(' ');for(const v of wrap(content,portraitWidth,PP5_TYPE.body)){if(ty+PP5_TYPE.body>targetPage.getHeight()-margin-24)targetPage=targetSheet(true);text(targetPage,v,margin,ty,PP5_TYPE.body,portraitWidth);ty+=19;}ty+=16;}

 const pages=pdf.getPages();pages.forEach((p,i)=>{const value=`หน้า ${i+1} / ${pages.length}`,size=PP5_TYPE.note;p.drawText(value,{x:p.getWidth()-margin-regular.widthOfTextAtSize(value,size),y:margin+2,font:regular,size,color:ink});});return pdf.save();
}
