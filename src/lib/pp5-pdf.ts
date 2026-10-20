import {PDFDocument,rgb,degrees,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {TRAITS,READING,QUALITY,eligibleForLesson,assessmentQuality,attendanceSessions,fullName,gender,pp5Score,pp5Readiness,weekOf,type Attendance,type CourseAssessment,type Target} from './pp5';
import type {TeacherWorkspace,TeacherOffering,TeacherStudent} from './use-teacher-workspace';
export type Pp5Book={data:TeacherWorkspace;offering:TeacherOffering;roster:TeacherStudent[];attendance:Attendance[];assessments:CourseAssessment[];targets:Target[];expected:number;schoolName:string;teacherName:string;homeroomNames:string[];learningHours:number;hourBasis:string;termStart:string|null};
const MONTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export async function createPp5Pdf(book:Pp5Book){
 const {data,offering:o,roster,attendance,assessments,targets}=book;
 if(!pp5Readiness(data,o,roster,attendance,assessments,book.expected).ready)throw Error('ยังบันทึกข้อมูล ปพ.5 ไม่ครบ');
 if(!book.schoolName||!book.teacherName)throw Error('ข้อมูลโรงเรียนหรือครูผู้สอนไม่ครบ');
 const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
 async function asset(path:string){const r=await fetch(base+path);if(!r.ok)throw Error('โหลดแบบฟอร์ม ปพ.5 ไม่สำเร็จ');return r.arrayBuffer();}
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const [regularBytes,boldBytes,emblemBytes]=await Promise.all([asset('/fonts/sarabun/Sarabun-Regular.ttf'),asset('/fonts/sarabun/Sarabun-Bold.ttf'),asset('/pp5/obec-emblem.png')]);
 const regular=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true}),emblem=await pdf.embedPng(emblemBytes);
 const subject=data.subjects.find(s=>s.id===o.subject_id)!,room=data.rooms.find(r=>r.id===o.classroom_id)!,term=data.terms.find(t=>t.id===o.term_id)!,year=data.years.find(y=>y.id===room.academic_year_id)!;
 const roomLabel=room.room_code.startsWith(room.level_code+'/')?room.room_code:room.level_code+'/'+room.room_code,period=`ภาคเรียนที่ ${term.term_no}/${year.year_be}`;
 pdf.setTitle('ปพ.5 '+subject.subject_code+' '+subject.name_th);pdf.setAuthor(book.teacherName);
 const ink=rgb(0,0,0),pale=rgb(.94,.94,.94);
 function text(p:PDFPage,value:string|number,x:number,y:number,size=11,width=1000,align:'left'|'center'|'right'='left',strong=false){
  const font=strong?bold:regular,str=String(value);let fit=size;while(font.widthOfTextAtSize(str,fit)>width&&fit>5.5)fit-=.25;
  const w=font.widthOfTextAtSize(str,fit);p.drawText(str,{x:align==='center'?x-w/2:align==='right'?x-w:x,y:p.getHeight()-y-fit,font,size:fit,color:ink});
 }
 function line(p:PDFPage,x:number,y:number,w:number,dashed=false){p.drawLine({start:{x,y:p.getHeight()-y},end:{x:x+w,y:p.getHeight()-y},thickness:.45,color:ink,...(dashed?{dashArray:[1.5,1.5]}:{})});}
 function box(p:PDFPage,x:number,y:number,w:number,h:number,shade=false){p.drawRectangle({x,y:p.getHeight()-y-h,width:w,height:h,borderWidth:.45,borderColor:ink,...(shade?{color:pale}:{})});}
 function cell(p:PDFPage,v:string|number,x:number,y:number,w:number,h:number,size=10,strong=false,align:'left'|'center'='center',shade=false){box(p,x,y,w,h,shade);text(p,v,align==='left'?x+3:x+w/2,y+(h-size)/2-1,size,w-4,align,strong);}
 function vertical(p:PDFPage,v:string,x:number,y:number,w:number,h:number,size=9){box(p,x,y,w,h);const width=regular.widthOfTextAtSize(v,size),fit=Math.min(size,size*(h-5)/Math.max(width,1));p.drawText(v,{x:x+w/2+fit/3,y:p.getHeight()-y-h+3,rotate:degrees(90),font:regular,size:fit,color:ink});}
 function wrap(value:string,width:number,size=11,font:PDFFont=regular){const out:string[]=[];for(const para of value.split('\n')){let part='';for(const {segment} of new Intl.Segmenter('th',{granularity:'grapheme'}).segment(para)){if(font.widthOfTextAtSize(part+segment,size)>width&&part){out.push(part);part=segment;}else part+=segment;}out.push(part);}return out;}
 const addPage=(landscape=false)=>pdf.addPage(landscape?[841.89,595.28]:[595.28,841.89]);
 const groupNames:Record<string,string>={'ท':'ภาษาไทย','ค':'คณิตศาสตร์','ว':'วิทยาศาสตร์และเทคโนโลยี','ส':'สังคมศึกษา ศาสนา และวัฒนธรรม','พ':'สุขศึกษาและพลศึกษา','ศ':'ศิลปะ','ง':'การงานอาชีพ','อ':'ภาษาต่างประเทศ'},group=groupNames[subject.subject_code[0]]??'—';
 const scores=roster.map(s=>pp5Score(data,o,s.id)),caps=scores[0].caps;
 // The cover follows 1.พิมพ์หน้าปก: emblem, inline metadata, summary tables and approval boxes.
 const cover=addPage();cover.drawImage(emblem,{x:279,y:cover.getHeight()-116,width:36,height:53});box(cover,430,65,125,28);text(cover,'ปพ.5',492,67,19,115,'center',true);
 text(cover,'แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน',297.5,123,19,535,'center',true);text(cover,book.schoolName,297.5,151,17,535,'center',true);
 function field(label:string,value:string|number,x:number,y:number,w:number,labelWidth:number){text(cover,label,x,y,11,labelWidth,'left',true);text(cover,value,x+labelWidth+4,y,11,w-labelWidth-6);line(cover,x+labelWidth,y+16,w-labelWidth,true);}
 const rightColumn=300,rightLabelWidth=88;
 field('ชั้น',roomLabel,35,181,240,35);field('ภาคเรียนที่',term.term_no,rightColumn,181,130,rightLabelWidth);field('ปีการศึกษา',year.year_be,450,181,110,65);
 const male=roster.filter(s=>gender(s.name_prefix_th)===0).length,female=roster.filter(s=>gender(s.name_prefix_th)===1).length;
 field('นักเรียนชาย',male+' คน',35,204,240,72);field('นักเรียนหญิง',female+' คน',rightColumn,204,130,rightLabelWidth);field('รวมทั้งหมด',roster.length+' คน',450,204,110,66);
 field('รหัสวิชา',subject.subject_code,35,227,240,55);field('รายวิชา',subject.name_th,rightColumn,227,260,rightLabelWidth);
 field('กลุ่มสาระการเรียนรู้',group,35,250,240,101);field('เวลาเรียนทั้งหมด',book.expected+' ชั่วโมง/ภาคเรียน',rightColumn,250,260,rightLabelWidth);
 field('อัตราส่วนคะแนน ระหว่างเรียน : กลางภาค : ปลายภาค',caps.join(' : '),35,273,525,306);
 field('เวลาเรียน',book.expected/20+' ชั่วโมง/สัปดาห์',35,296,290,58);field('จำนวน',room.level_code.startsWith('ม.')?(book.expected/40).toFixed(2)+' หน่วยกิต':'—',rightColumn,296,260,rightLabelWidth);
 field('ครูผู้สอน',book.teacherName,35,319,525,57);field('ครูที่ปรึกษา 1.',book.homeroomNames[0]??'—',35,342,255,80);field('ครูที่ปรึกษา 2.',book.homeroomNames[1]??'—',305,342,255,80);
 const gx=35,gy=377,gw=525;cell(cover,'สรุปผลการพัฒนาผู้เรียน',gx,gy,gw,22,13,true);
 const grades=['4','3.5','3','2.5','2','1.5','1','0','ร','มส'];const counts=grades.map(g=>scores.filter(s=>s.grade===g).length),numeric=scores.map(s=>Number(s.grade)).filter((n,i)=>scores[i].grade!=='—'&&scores[i].grade!==''&&Number.isFinite(n));
 const gradeWidths=[85,...grades.map(()=>29),45,105];const gradeRows=[['ระดับผลการเรียน',...grades,'รวม','ผลการเรียนเฉลี่ย'],['จำนวน (คน)',...counts,roster.length,numeric.length?(numeric.reduce((a,b)=>a+b,0)/numeric.length).toFixed(2):'—'],['ร้อยละ',...counts.map(n=>(100*n/roster.length).toFixed(1)),'100','']];
 gradeRows.forEach((row,j)=>{let x=gx;row.forEach((v,i)=>{cell(cover,v,x,gy+22+j*19,gradeWidths[i],19,i===0?10:10,j===0);x+=gradeWidths[i];});});
 if(scores.some(s=>s.grade==='—'))text(cover,'ยังไม่สรุปเกรด '+scores.filter(s=>s.grade==='—').length+' คน (คะแนนรายปีต้องครบทั้งสองภาคเรียน)',35,459,9,525);
 function qualityTable(groupType:'traits'|'reading',x:number,width:number,title:string){const y=481;cell(cover,title,x,y,width,23,11,true);const widths=[width*.34,width*.36,width*.30];let xx=x;['ระดับคุณภาพ','จำนวน (คน)','ร้อยละ'].forEach((v,i)=>{cell(cover,v,xx,y+23,widths[i],20,10,true);xx+=widths[i];});[3,2,1,0].forEach((q,i)=>{const count=assessments.filter(a=>roster.some(s=>s.id===a.student_id)&&assessmentQuality(groupType==='traits'?a.trait_scores:a.reading_scores,groupType)===q).length;let xx=x;[QUALITY[q],count,(100*count/roster.length).toFixed(1)].forEach((v,j)=>{cell(cover,v,xx,y+43+i*20,widths[j],20,10);xx+=widths[j];});});}
 qualityTable('traits',35,255,'การประเมินคุณลักษณะอันพึงประสงค์');qualityTable('reading',305,255,'การประเมินการอ่าน คิดวิเคราะห์ และเขียน');
 box(cover,35,617,255,176);box(cover,305,617,255,176);text(cover,'การอนุมัติผลการพัฒนาผู้เรียน',42,625,12,240,'left',true);text(cover,'เรียนเสนอเพื่อพิจารณา',315,625,12,235,'left',true);
 for(const [i,role] of ['ครูผู้สอน','หัวหน้างานวัดและประเมินผล','หัวหน้าฝ่ายวิชาการ'].entries()){const y=653+i*43;text(cover,'ลงชื่อ ...........................................',43,y,10,150);text(cover,role,190,y,9,94);text(cover,'( '+(i===0?book.teacherName:'........................................')+' )',155,y+17,10,235,'center');}
 text(cover,'ลงชื่อ ............................................................',317,659,11,235);text(cover,'( ......................................................... )',432,683,11,235,'center');text(cover,'ผู้อำนวยการ'+book.schoolName,432,705,10,235,'center');text(cover,'[  ] อนุมัติ     [  ] ไม่อนุมัติ',432,729,11,235,'center');text(cover,'............... / ............... / ...............',432,758,11,235,'center');
 // Twenty-five weekday columns per five-week page, preserving the source's four header rows.
 const sessions=attendanceSessions(attendance),anchor=book.termStart&&book.termStart<=sessions[0].date?book.termStart:sessions[0].date,monday=new Date(anchor+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const weeks=Math.max(20,...sessions.map(s=>weekOf(s.date,anchor)+1)),lookup=new Map(attendance.map(a=>[a.student_id+'#'+a.class_date+'#'+a.session_no,a.attendance_status]));
 const rowsPerPage=30;
 const marks:Record<string,string>={present:'/',absent:'ข',late:'ส',leave:'ล'},chunks:TeacherStudent[][]=[];for(let i=0;i<roster.length;i+=rowsPerPage)chunks.push(roster.slice(i,i+rowsPerPage));
 const weekend=sessions.filter(s=>new Date(s.date+'T00:00:00Z').getUTCDay()%6===0);
 const attendanceBlocks=Array.from({length:Math.ceil(weeks/5)},(_,block)=>Array.from({length:25},(_,i)=>{const date=new Date(monday);date.setUTCDate(date.getUTCDate()+block*35+Math.floor(i/5)*7+i%5);const iso=date.toISOString().slice(0,10);return {date:iso,week:block*5+Math.floor(i/5)+1,periods:sessions.filter(s=>s.date===iso).map(s=>s.period)};}));
 if(weekend.length)attendanceBlocks.push(weekend.map(s=>({date:s.date,week:weekOf(s.date,anchor)+1,periods:[s.period]})));
 attendanceBlocks.forEach((days,block)=>{for(const chunk of chunks){const p=addPage(true),x=18,y=42,left=[20,40,135,45],dayW=440/days.length,summaryWidths=[18,18,18,18,20,23,20],dayX=x+240,summaryX=dayX+440;
 text(p,`แบบบันทึกเวลาเรียน รายวิชา ${subject.subject_code} ${subject.name_th} ${period} ผู้สอน ${book.teacherName}`,421,20,11,805,'center',true);
 cell(p,'เลขที่',x,y,left[0],56,8);cell(p,'เลขประจำตัว',x+20,y,left[1],56,7);cell(p,'ชื่อ-สกุล',x+60,y,left[2],56,10);
 ['สัปดาห์ที่','เดือน','วันที่','ชั่วโมง'].forEach((v,i)=>cell(p,v,x+195,y+i*14,45,14,9,true));
 let from=0;while(from<days.length){let to=from+1;while(to<days.length&&days[to].week===days[from].week)to++;cell(p,days[from].week,dayX+from*dayW,y,(to-from)*dayW,14,9,true);from=to;}
 days.forEach((d,i)=>{const xx=dayX+i*dayW;cell(p,MONTHS[Number(d.date.slice(5,7))-1],xx,y+14,dayW,14,7);cell(p,Number(d.date.slice(8)),xx,y+28,dayW,14,8);cell(p,d.periods.join(','),xx,y+42,dayW,14,7,false,'center',!d.periods.length);});
 let sx=summaryX;['มาเรียน','ขาดเรียน','มาสาย','ลา','รวมเวลาเรียน','ร้อยละ','หมายเหตุ'].forEach((v,i)=>{vertical(p,v,sx,y,summaryWidths[i],56,8);sx+=summaryWidths[i];});
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],yy=y+56+i*15.5;cell(p,roster.indexOf(chunk[0])+i+1,x,yy,20,15.5,10);cell(p,s?.student_no??'',x+20,yy,40,15.5,10);cell(p,s?fullName(s):'',x+60,yy,180,15.5,11,false,'left');const values:string[]=[];
 days.forEach((d,j)=>{const eligible=s&&eligibleForLesson(data,o,s.id,d.date),statuses=eligible?d.periods.map(period=>lookup.get(s!.id+'#'+d.date+'#'+period)??''):[];values.push(...statuses);cell(p,s?(eligible?statuses.map(st=>marks[st]??'—').join(''):'—'):'',dayX+j*dayW,yy,dayW,15.5,10,false,'center',!d.periods.length);});
 const counts=['present','absent','late','leave'].map(v=>values.filter(a=>a===v).length),total=values.length,present=counts[0]+counts[2];let xx=summaryX;[...counts,total,total?(100*present/total).toFixed(0):'',''].forEach((v,j)=>{cell(p,s?v:'',xx,yy,summaryWidths[j],15.5,9.5);xx+=summaryWidths[j];});}
 text(p,'/ มาเรียน   ข ขาดเรียน   ส มาสาย   ล ลา | หลายคาบในวันเดียวเรียงตามแถวชั่วโมง | ช่องสีเทาไม่มีคาบ',18,574,9,805);
 }});
 // Primary: two term groups on one row; secondary: only the selected term.
 const annual=!room.level_code.startsWith('ม.');
 for(const chunk of chunks){const p=addPage(annual),x=18,y=annual?44:54,rowHeight=annual?14.25:21,ws=annual?[22,174,...Array(8).fill(31),34,30,...Array(8).fill(16),24,...Array(5).fill(16),24,32]:[18,132,...Array(5).fill(25),...Array(8).fill(11),18,...Array(5).fill(11),18,25],xs=[x];ws.forEach(w=>xs.push(xs[xs.length-1]+w));
 const traitStart=annual?12:7,traitResult=traitStart+8,readingStart=traitResult+1,readingResult=readingStart+5,note=readingResult+1,width=ws.reduce((a,b)=>a+b,0),center=p.getWidth()/2;
 text(p,`บันทึกผลการพัฒนาผู้เรียนและการประเมินคุณลักษณะอันพึงประสงค์/อ่านคิดวิเคราะห์และเขียน`,center,annual?13:20,11,width,'center',true);text(p,`${annual?'ปีการศึกษา '+year.year_be+' · คะแนนภาคเรียนที่ 1 และ 2':period} รายวิชา ${subject.subject_code} ${subject.name_th} ครูผู้สอน ${book.teacherName}`,center,annual?28:35,10,width,'center');
 const merged=(v:string,a:number,b:number,yy:number,h:number,size=8)=>{const w=xs[b]-xs[a];if(v.includes('\n')){box(p,xs[a],yy,w,h);v.split('\n').forEach((part,j)=>text(p,part,xs[a]+w/2,yy+1+j*9,size,w-4,'center',true));return;}if(bold.widthOfTextAtSize(v,size)<=w-4){cell(p,v,xs[a],yy,w,h,size,true);return;}box(p,xs[a],yy,w,h);wrap(v,w-4,6.3,bold).forEach((part,j)=>text(p,part,xs[a]+w/2,yy+1+j*7,6.3,w-4,'center',true));};
 const scoreHeader=(label:string,j:number)=>{const w=ws[j],parts=label.split('\n');box(p,xs[j],y+20,w,44);parts.forEach((part,k)=>text(p,part,xs[j]+w/2,y+21+(44-parts.length*10)/2+k*10,8.5,w-4,'center',true));};
 merged('เลขที่',0,1,y,84,8);merged('ชื่อ-สกุล',1,2,y,84,10);
 if(annual){merged('ภาคเรียนที่ 1',2,6,y,20,10);merged('ภาคเรียนที่ 2',6,10,y,20,10);for(const start of [2,6])['คะแนน\nเก็บ','กลาง\nภาค','ปลาย\nภาค','รวม\nภาคเรียน'].forEach((label,i)=>scoreHeader(label,start+i));vertical(p,'รวมทั้งปี',xs[10],y,ws[10],64,9);vertical(p,'ระดับผลการเรียน',xs[11],y,ws[11],64,9);
 const yc=scores[0].yearCaps;[...yc.slice(0,3),yc.slice(0,3).reduce((a,b)=>a+b,0),...yc.slice(3),yc.slice(3).reduce((a,b)=>a+b,0),yc.reduce((a,b)=>a+b,0),'—'].forEach((cap,i)=>cell(p,cap,xs[i+2],y+64,ws[i+2],20,9));
 }else{merged('คะแนนผลการเรียน',2,7,y,20,10);['คะแนน\nเก็บ','กลาง\nภาค','ปลาย\nภาค','รวม\nคะแนน','ระดับผล\nการเรียน'].forEach((label,i)=>scoreHeader(label,i+2));[...caps,caps.reduce((a,b)=>a+b,0),'—'].forEach((cap,i)=>cell(p,cap,xs[i+2],y+64,ws[i+2],20,9));}
 merged('ผลการประเมินภาคเรียนที่ '+term.term_no,traitStart,note,y,20,9);
 vertical(p,'หมายเหตุ',xs[note],y,ws[note],84,8);merged('คุณลักษณะอันพึงประสงค์',traitStart,traitResult,y+20,20,8);merged('อ่าน คิดวิเคราะห์\nและเขียน',readingStart,readingResult,y+20,20,7.5);
 vertical(p,'ผลการประเมิน',xs[traitResult],y+20,ws[traitResult],64,8);vertical(p,'ผลการประเมิน',xs[readingResult],y+20,ws[readingResult],64,8);
 for(let i=traitStart;i<traitResult;i++)cell(p,i-traitStart+1,xs[i],y+40,ws[i],24,9);for(let i=readingStart;i<readingResult;i++)cell(p,i-readingStart+1,xs[i],y+40,ws[i],24,9);
 for(const i of [...Array.from({length:8},(_,i)=>i+traitStart),...Array.from({length:5},(_,i)=>i+readingStart)])cell(p,3,xs[i],y+64,ws[i],20,8);
 for(let i=0;i<rowsPerPage;i++){const s=chunk[i],score=s?pp5Score(data,o,s.id):null,a=s?assessments.find(a=>a.student_id===s.id):null,row=Array<string|number>(ws.length).fill('');row[0]=roster.indexOf(chunk[0])+i+1;
 if(s&&score&&a){row[1]=fullName(s);if(annual){for(let j=0;j<3;j++){row[2+j]=score.yearScores[j]??'—';row[6+j]=score.yearScores[j+3]??'—';}row[5]=score.termTotals[0]??'—';row[9]=score.termTotals[1]??'—';row[10]=score.annualTotal??'—';row[11]=score.grade;}else{score.scores.forEach((v,j)=>row[j+2]=v??'—');row[5]=score.total??'—';row[6]=score.grade;}
 for(let j=0;j<8;j++)row[traitStart+j]=a.trait_scores![j];row[traitResult]=assessmentQuality(a.trait_scores,'traits')!;for(let j=0;j<5;j++)row[readingStart+j]=a.reading_scores![j];row[readingResult]=assessmentQuality(a.reading_scores,'reading')!;row[note]=['ร','มส'].includes(score.grade)?score.grade:'';}
 row.forEach((v,j)=>cell(p,v,xs[j],y+84+i*rowHeight,ws[j],rowHeight,j===1?11:10.5,false,j===1?'left':'center'));}
 text(p,'คุณภาพ 0 ไม่ผ่าน 1 ผ่าน 2 ดี 3 ดีเยี่ยม'+(annual?' | รวมปีและเกรดสรุปเมื่อคะแนนครบทั้งสองภาคเรียน':''),18,annual?573:785,8.5,width-110);
 }
 // 5.พิมพ์ ตชว: metadata first, then the original numbered writing lines.
 let targetPage:PDFPage;let ty=0;
 function targetSheet(continued=false){const p=addPage();text(p,'ตัวชี้วัด/ผลการเรียนรู้'+(continued?' (ต่อ)':''),297.5,63,20,540,'center',true);text(p,'รหัสวิชา '+subject.subject_code,35,111,12,240);text(p,'รายวิชา '+subject.name_th,300,111,12,260);text(p,'กลุ่มสาระการเรียนรู้ '+group,35,139,12,260);text(p,'ครูผู้สอน '+book.teacherName,300,139,12,260);text(p,'ตัวชี้วัด/ผลการเรียนรู้ จำนวน '+targets.length+' ตัว',35,179,12,525);return p;}
 targetPage=targetSheet();ty=225;
 if(!targets.length){for(let i=0;i<13;i++){text(targetPage,(i+1)+'.',35,ty,12);line(targetPage,55,ty+18,505,true);line(targetPage,55,ty+36,505,true);ty+=43;}}
 for(const [index,t] of targets.entries()){const content=(index+1)+'. '+[t.standard_code,t.target_code,t.target_description].filter(Boolean).join(' ');for(const v of wrap(content,525,12)){if(ty>775){targetPage=targetSheet(true);ty=225;}text(targetPage,v,35,ty,12,525);ty+=19;}ty+=16;}
 const pages=pdf.getPages();pages.forEach((p,i)=>{text(p,`หน้า ${i+1} / ${pages.length}`,p.getWidth()-18,p.getHeight()-18,9,100,'right');});return pdf.save();
}
