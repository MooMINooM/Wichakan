'use client';
import {useEffect,useRef,useState,type SVGProps} from 'react';
import type {TeacherStudent,TeacherRoom} from '@/lib/use-teacher-workspace';
import type {Pp6Subject,Pp6Cell} from '@/lib/pp6-grades';
import {pp6PrintOrder,pp6PrintSummary,pp6CommentPages} from '@/lib/pp6-print-summary';
import './pp6-report.css';

type Assessment={desirable_traits:string|null;reading_thinking_writing:string|null;learner_activities:string|null;comment:string|null};
type Props={student:TeacherStudent;room:TeacherRoom;year:number|undefined;termNo:number;subjects:Pp6Subject[];cells:Pp6Cell[];assessment?:Assessment;gpa:string|null;rosterCount:number;teacherName:string};
function Text({children,maxWidth,...props}:Omit<SVGProps<SVGTextElement>,'children'> & {children:string|number;maxWidth?:number}){
 const ref=useRef<SVGTextElement>(null),[length,setLength]=useState<number>();
 useEffect(()=>{let active=true;const fit=()=>{if(!active||!ref.current)return;const clone=ref.current.cloneNode(true) as SVGTextElement;clone.removeAttribute('textLength');clone.removeAttribute('lengthAdjust');clone.style.visibility='hidden';ref.current.parentNode?.appendChild(clone);const width=clone.getComputedTextLength();clone.remove();setLength(maxWidth&&width>maxWidth?maxWidth:undefined);};fit();void document.fonts.ready.then(fit);return()=>{active=false;};},[children,maxWidth]);
 return <text {...props} ref={ref} textLength={length} lengthAdjust={length?'spacingAndGlyphs':undefined}>{children}</text>;
}
const xs=[42.89,83.929,141.761,334.341,392.173,442.385,500.217,566.563];
const rowYs=[187.657,...Array.from({length:16},(_,i)=>187.657+(i+1)*16.7355),...Array.from({length:8},(_,i)=>455.425+(i+1)*14.95825)];
const fmt=(n:number|null)=>n===null?'—':n.toFixed(2);
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
export default function Pp6Report({student,room,year,termNo,subjects,cells,assessment,gpa,rosterCount,teacherName}:Props){
 const fullName=[(student.name_prefix_th??'').trim()+student.first_name_th.trim(),student.last_name_th.trim()].filter(Boolean).join(' ');
 const ordered=pp6PrintOrder(subjects),pages=Math.max(1,Math.ceil(ordered.length/24)),summary=pp6PrintSummary(subjects,cells);
 const shortComment=assessment?.comment?.trim()??'',extraComment=shortComment.length>180||shortComment.split("\n").length>3;
 const roomCode=room.room_code.startsWith(room.level_code+'/')?room.room_code.slice(room.level_code.length+1):room.room_code;
 return <>{Array.from({length:pages},(_,page)=>{
  const rows=ordered.slice(page*24,page*24+24);
  return <article className="pp6-student-page" key={page} aria-label={'ปพ.6 '+student.student_no+(pages>1?' หน้า '+(page+1):'')}>
   <svg className="pp6-document" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595.28 841.89" xmlSpace="preserve" role="img" aria-label={'แบบรายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล '+fullName}>
    <title>{'ปพ.6 '+student.student_no+' '+fullName}</title>
    <image href={base+'/pp6/school-emblem.png'} x="72.402" y="19.506" width="75" height="106.635" preserveAspectRatio="xMidYMid meet"/>
    <g fill="none" stroke="black" strokeWidth=".741"><rect x="533.469" y="14.548" width="33.09" height="15.15"/></g>
    <Text x="550.014" y="26.323" textAnchor="middle" fontSize="12">ปพ.6</Text>
    <g fontWeight="700" textAnchor="middle">
     <Text x="357.168" y="51.448" fontSize="22.5" maxWidth={380}>แบบรายงานผลพัฒนาคุณภาพผู้เรียนรายบุคคล</Text>
     <Text x="357.168" y="71.323" fontSize="15">{'ปีการศึกษา '+(year??'—')+' ภาคเรียนที่ '+termNo}</Text>
     <Text x="357.168" y="92.886" fontSize="18.75">โรงเรียนบ้านภูพระโนนผักหวาน</Text>
     <Text x="357.168" y="111.823" fontSize="15" maxWidth={395}>สำนักงานเขตพื้นที่การศึกษาประถมศึกษาหนองบัวลำภู เขต 2    จังหวัด หนองบัวลำภู</Text>
    </g>
    <g fontWeight="700" fontSize="15">
     <Text x="42.52" y="144.453" maxWidth={149}>{'รหัสประจำตัวนักเรียน : '+student.student_no}</Text>
     <Text x="196.753" y="144.453" maxWidth={245}>{'ชื่อ - นามสกุล : '+fullName}</Text>
     <Text x="448.563" y="144.453" maxWidth={55}>{'ชั้น   '+room.level_code}</Text>
     <Text x="508.198" y="144.453" maxWidth={57}>{'ห้อง   '+roomCode}</Text>
    </g>
    <g fill="none" stroke="black" strokeWidth=".741">
     {xs.map(x=><line key={x} x1={x} y1="148.573" x2={x} y2="575.091"/>)}
     {[148.573,...rowYs].map(y=><line key={y} x1={xs[0]} y1={y} x2={xs[7]} y2={y}/>)}
    </g>
    <g fontSize="14.81" fontWeight="700" textAnchor="middle">
     <Text x="63.41" y="173.299">ลำดับ</Text><Text x="112.845" y="173.299">รหัสวิชา</Text><Text x="238.051" y="173.299">ชื่อวิชา</Text><Text x="363.257" y="173.299">ประเภท</Text>
     <Text x="417.279" y="164.413">จำนวน</Text><Text x="417.279" y="182.185">ชั่วโมง</Text><Text x="471.301" y="173.299">คะแนนที่ได้</Text><Text x="533.39" y="164.413">ระดับ</Text><Text x="533.39" y="182.185">ผลการเรียน</Text>
    </g>
    <g fontSize="13.329">{rows.map((subject,index)=>{
     const cell=cells.find(c=>c.subjectId===subject.id),activity=subject.category!=='basic'&&subject.category!=='additional';
     const y=rowYs[index]+13.033,number=ordered.slice(0,page*24+index+1).filter(s=>s.category==='basic'||s.category==='additional').length;
     return <g key={subject.id}>
      <Text x="63.41" y={y} textAnchor="middle">{activity?'':number}</Text><Text x="112.845" y={y} textAnchor="middle" maxWidth={54}>{activity?'':subject.subject_code}</Text>
      <Text x="147.89" y={y} maxWidth={181}>{subject.name_th}</Text><Text x="363.257" y={y} textAnchor="middle">{subject.category==='basic'?'พื้นฐาน':subject.category==='additional'?'เพิ่มเติม':'กิจกรรม'}</Text>
      <Text x="417.279" y={y} textAnchor="middle">{subject.learning_hours??'—'}</Text><Text x="471.301" y={y} textAnchor="middle" maxWidth={52}>{cell?.score??''}</Text><Text x="533.39" y={y} textAnchor="middle" maxWidth={60}>{cell?.grade==='—'?'':cell?.grade??''}</Text>
     </g>;
    })}</g>
    <g fill="none" stroke="black" strokeWidth=".741">
     <rect x="42.89" y="580.142" width="292.611" height="189.688"/>
     {[619.21,635.946,652.681,669.417,686.152,702.888,719.623,736.359,753.094].map(y=><line key={y} x1="42.89" y1={y} x2="335.501" y2={y}/>)}
     <line x1="262.204" y1="580.142" x2="262.204" y2="686.152"/><line x1="262.204" y1="702.888" x2="262.204" y2="769.83"/>
     <line x1="262.204" y1="599.676" x2="335.501" y2="599.676"/><line x1="298.052" y1="599.676" x2="298.052" y2="669.417"/>
    </g>
    <g fontSize="13.329">
     <g fontWeight="700" textAnchor="middle"><Text x="152.547" y="604.341">สรุปผลการประเมิน</Text><Text x="298.852" y="594.574">ผลการเรียน</Text><Text x="280.128" y="614.108">ที่เรียน</Text><Text x="316.776" y="614.108">ที่ได้</Text></g>
     {(['basic','additional','total'] as const).map((key,i)=><g key={key}><Text x="43.26" y={632.243+i*16.7355}>{[' จำนวนหน่วยกิต/น้ำหนักวิชาพื้นฐาน',' จำนวนหน่วยกิต/น้ำหนักวิชาเพิ่มเติม',' รวมจำนวนหน่วยกิต/น้ำหนัก'][i]}</Text><Text x="280.128" y={632.243+i*16.7355} textAnchor="middle">{subjects.length?fmt(summary[key].studied):'—'}</Text><Text x="316.776" y={632.243+i*16.7355} textAnchor="middle">{subjects.length?fmt(summary[key].earned):'—'}</Text></g>)}
     <Text x="43.26" y="682.45"> ระดับผลการเรียนเฉลี่ย(GPA)</Text><Text x="298.852" y="682.45" textAnchor="middle" fontWeight="700">{gpa??'—'}</Text>
     <Text x="189.195" y="699.185" textAnchor="middle" fontWeight="700">การประเมินคุณลักษณะ</Text>
     {(['desirable_traits','reading_thinking_writing','learner_activities'] as const).map((key,i)=><g key={key}><Text x="43.26" y={715.921+i*16.7355}>{[' ผลการประเมินคุณลักษณะอันพึงประสงค์',' ผลการประเมินการอ่าน คิดวิเคราะห์ และเขียน',' ผลการประเมินกิจกรรมพัฒนาผู้เรียน'][i]}</Text><Text x="298.852" y={715.921+i*16.7355} textAnchor="middle" maxWidth={68}>{assessment?.[key]??'—'}</Text></g>)}
     <Text x="43.26" y="766.127">{' อันดับที่ในห้องเรียน จากนักเรียนจำนวน '+rosterCount+' คน'}</Text>
     {([618.337,680.54,740.965]).map((y,i)=><g key={y}><Text x="352.8" y={y}>ลงชื่อ..........................................................................................</Text><Text x="451.288" y={y+(i===0?31.99:15.995)} textAnchor="middle" fontWeight="700">{['ครูที่ปรึกษา','ผู้บริหารสถานศึกษา','ผู้ปกครอง'][i]}</Text>{i===0&&<Text x="451.288" y={y+15.995} textAnchor="middle" maxWidth={205}>{'('+teacherName+')'}</Text>}</g>)}
    </g>
    {shortComment&&!extraComment&&<foreignObject x="42.89" y="783" width="523.673" height="46"><div className="pp6-inline-comment"><b>ความคิดเห็นครูประจำชั้น</b> {shortComment}</div></foreignObject>}
    {pages>1&&<Text x="566.563" y="837" textAnchor="end" fontSize="10">{'หน้า '+(page+1)+' / '+pages}</Text>}
   </svg>
  </article>;
 })}{extraComment&&pp6CommentPages(shortComment).map((comment,index)=><article className="pp6-student-page pp6-comment-page" key={index}><h2>ความคิดเห็นครูประจำชั้น</h2><p>รหัสประจำตัวนักเรียน : {student.student_no}　{fullName}</p><p>ปีการศึกษา {year??'—'} ภาคเรียนที่ {termNo}</p><div>{comment}</div></article>)}</>;
}
