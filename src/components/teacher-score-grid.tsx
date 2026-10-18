'use client';
import {useEffect,useState} from 'react';
import {AcademicIcon} from '@/components/academic-visuals';
import {getSupabaseBrowserClient} from '@/lib/supabase/browser';
import {SCORE_FIELDS,SCORE_LABELS,evaluateScore,settingCaps,validCaps,type ScoreMode,type ScoreRecord,type ScoreSetting} from '@/lib/teacher-scores';
import {teacherError,type TeacherStudent} from '@/lib/use-teacher-workspace';
type Draft={values:string[];special:string;dirty:boolean;savedComplete:boolean};
type Props={offeringId:string;students:TeacherStudent[];records:ScoreRecord[];setting?:ScoreSetting;mode:ScoreMode;termNo:number;onDirty:(dirty:boolean)=>void;onBusy:(busy:boolean)=>void;onSaved:(records:ScoreRecord[])=>void};
export default function TeacherScoreGrid({offeringId,students,records,setting,mode,termNo,onDirty,onBusy,onSaved}:Props){
 const [drafts,setDrafts]=useState<Record<string,Draft>>(()=>Object.fromEntries(students.map(s=>{const r=records.find(r=>r.student_id===s.id&&r.course_offering_id===offeringId);return [s.id,{values:SCORE_FIELDS.map(f=>r?.[f]==null?'':String(r[f])),special:r?.special_result??'',dirty:false,savedComplete:r?.is_complete??false}];})));
 const [filter,setFilter]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const caps=settingCaps(setting),configured=validCaps(caps,mode),dirty=Object.values(drafts).some(d=>d.dirty);
 const complete=(d:Draft)=>d.savedComplete&&!d.dirty&&evaluateScore(d.values,d.special,caps,mode,termNo).complete;
 const normal=students.filter(s=>complete(drafts[s.id])&&!drafts[s.id].special).length,special=students.filter(s=>complete(drafts[s.id])&&!!drafts[s.id].special).length;
 const remaining=students.length-normal-special;
 useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
 useEffect(()=>{onBusy(busy);},[busy,onBusy]);
 function update(id:string,change:Partial<Draft>){if(busy)return;setDrafts(old=>({...old,[id]:{...old[id],...change,dirty:true}}));setError('');setNotice('');}
 async function save(){
  const db=getSupabaseBrowserClient();if(!db||busy||!configured)return;
  const changed=students.filter(s=>drafts[s.id].dirty);if(!changed.length)return;
  const invalid=changed.filter(s=>!evaluateScore(drafts[s.id].values,drafts[s.id].special,caps,mode,termNo).valid);
  if(invalid.length){setError('ตรวจคะแนนรหัส '+invalid.map(s=>s.student_no).join(', ')+': ต้องเป็นจำนวนเต็ม 0–คะแนนเต็ม');return;}
  const rows=changed.map(student=>{const draft=drafts[student.id],result=evaluateScore(draft.values,draft.special,caps,mode,termNo);return {student_id:student.id,scores:result.numbers,special:draft.special||null};});
  setBusy(true);setError('');setNotice('');
  try{
   const r=await db.rpc('save_course_scores',{p_offering_id:offeringId,p_rows:rows});if(r.error)throw r.error;
   const saved=rows.map(row=>({course_offering_id:offeringId,student_id:row.student_id,special_result:row.special,is_complete:evaluateScore(drafts[row.student_id].values,drafts[row.student_id].special,caps,mode,termNo).complete,...Object.fromEntries(SCORE_FIELDS.map((f,i)=>[f,row.scores[i]]))} as ScoreRecord));
   onSaved(saved);
   setDrafts(old=>{const next={...old};for(const record of saved)next[record.student_id]={...next[record.student_id],dirty:false,savedComplete:record.is_complete};return next;});
   setNotice('บันทึกคะแนนทั้งหมดแล้ว '+saved.length+' คน');
  }catch(e){setError('บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังคงอยู่ทั้งหมด กรุณาลองอีกครั้ง: '+teacherError(e));}
  finally{setBusy(false);}
 }
 // Show boys first, then girls; within each group sort student codes descending.
 // The students table stores a Thai name prefix, not a separate gender column.
 const genderOrder=(prefix:string|null)=>/^(เด็กชาย|ด\.ช\.|นาย)(?:\s|$)/.test((prefix??'').trim())?0:/^(เด็กหญิง|ด\.ญ\.|นางสาว|นาง)(?:\s|$)/.test((prefix??'').trim())?1:2;
 const orderedStudents=[...students].sort((a,b)=>genderOrder(a.name_prefix_th)-genderOrder(b.name_prefix_th)||b.student_no.localeCompare(a.student_no,'th',{numeric:true})||a.id.localeCompare(b.id));
 const displayed=orderedStudents.filter(s=>filter==='special'?!!drafts[s.id].special:filter==='complete'?complete(drafts[s.id]):filter==='incomplete'?!complete(drafts[s.id]):true);
 const termCap=(start:number)=>configured?caps.slice(start,start+3).reduce((a,b)=>a+b,0):'—';
 const semester=mode==='semester',start=termNo===1?0:3,visibleScoreIndices=semester?[start,start+1,start+2]:[0,1,2,3,4,5];
 return <>
  {!configured&&<p role="alert" className="teacher-warning">{!setting?'Admin ยังไม่ได้ตั้งค่าคะแนนเต็มของรายวิชานี้':'คะแนนเต็มไม่ตรงเงื่อนไขตามระดับชั้น กรุณาให้ Admin แก้ไข'} จึงยังบันทึกคะแนนไม่ได้</p>}
  <section className="teacher-metrics" aria-label="สรุปคะแนนนักเรียน">
   {([{label:'นักเรียนทั้งหมด',value:students.length,icon:'users',color:'purple'},{label:'บันทึกคะแนนแล้ว',value:normal,icon:'check',color:'green'},{label:'ยังไม่ครบ',value:remaining,icon:'calendar',color:'orange'},{label:'ร / มส',value:special,icon:'file',color:'red'}] as const).map(m=><div key={m.label} className={'teacher-metric '+m.color}><i><AcademicIcon name={m.icon}/></i><div><p>{m.label}</p><strong>{m.value} <small>คน</small></strong></div></div>)}
  </section>
  <section className="ui-panel score-panel" aria-labelledby="score-table-heading">
   <div className="score-panel-toolbar"><h2 id="score-table-heading"><AcademicIcon name="check"/>ตารางบันทึกคะแนน</h2><div className="score-caps">{(!semester||termNo===1)&&<span>ภาคเรียน 1: เก็บ {caps[0]??'—'} | กลางภาค {caps[1]??'—'} | ปลายภาค {caps[2]??'—'}</span>}{(!semester||termNo===2)&&<span>ภาคเรียน 2: เก็บ {caps[3]??'—'} | กลางภาค {caps[4]??'—'} | ปลายภาค {caps[5]??'—'}</span>}<strong>{mode==='annual'?'รายปี /100':'รายภาคเรียน /100'} · {mode==='semester'?'ขณะนี้ภาคเรียน '+termNo:'สิ้นภาคเรียน 1 แสดงความก้าวหน้า'}</strong></div></div>
   <div className="score-tools"><label>แสดงนักเรียน<select aria-label="กรองนักเรียนตามสถานะคะแนน" disabled={busy} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">ทั้งหมด ({students.length})</option><option value="complete">บันทึกครบ</option><option value="incomplete">ยังไม่ครบ</option><option value="special">ร / มส</option></select></label><span className={'teacher-state '+(!students.length?'no-students':!configured?'configuration':dirty?'progress':remaining?'empty':'complete')}>{!students.length?'ยังไม่มีนักเรียน':!configured?'รอตั้งคะแนนเต็ม':dirty?'มีคะแนนยังไม่บันทึก':remaining?'กำลังบันทึกคะแนน':'บันทึกครบแล้ว'}</span></div>
   {error&&<p role="alert" className="teacher-error">{error}</p>}{notice&&<p role="status" className="teacher-success">{notice}</p>}
   <div className="score-table-scroll"><table className="score-table"><thead><tr><th rowSpan={2} className="score-number">เลขที่</th><th rowSpan={2} className="score-code">รหัส</th><th rowSpan={2} className="score-name">ชื่อ–นามสกุล</th>
   {semester?<th colSpan={3} className={termNo===1?'score-term-one':'score-term-two'}>คะแนนภาคเรียนที่ {termNo}</th>:<><th colSpan={4} className="score-term-one">ภาคเรียนที่ 1</th><th colSpan={4} className="score-term-two">ภาคเรียนที่ 2</th></>}
   <th rowSpan={2}>{semester?'รวมภาคเรียน '+termNo:'รวมทั้งปี'}<br/><small>({configured?100:'—'})</small></th><th rowSpan={2}>เกรด</th><th rowSpan={2}>หมายเหตุ</th></tr><tr>
   {semester?visibleScoreIndices.map(i=><th key={i}>{['เก็บ','กลางภาค','ปลายภาค'][i%3]}<small>({caps[i]??'—'})</small></th>):<>{[0,1,2].map(i=><th key={i}>{['เก็บ','กลางภาค','ปลายภาค'][i]}<small>({caps[i]??'—'})</small></th>)}<th>รวม<br/>ภาคเรียน 1<small>({termCap(0)})</small></th>{[3,4,5].map(i=><th key={i}>{['เก็บ','กลางภาค','ปลายภาค'][i-3]}<small>({caps[i]??'—'})</small></th>)}<th>รวม<br/>ภาคเรียน 2<small>({termCap(3)})</small></th></>}</tr></thead><tbody>{displayed.map(student=>{
    const d=drafts[student.id],value=evaluateScore(d.values,d.special,caps,mode,termNo),index=orderedStudents.findIndex(s=>s.id===student.id);
    const input=(i:number)=><td key={'input'+i}><input aria-label={SCORE_LABELS[i]+' '+student.student_no} aria-invalid={value.invalid[i]||undefined} title={'คะแนนเต็ม '+(caps[i]??'—')} type="number" inputMode="numeric" min="0" max={caps[i]??0} step="1" disabled={!configured||busy} value={d.values[i]} onChange={e=>update(student.id,{values:d.values.map((s,j)=>j===i?e.target.value:s)})}/></td>;
    return <tr key={student.id} className={d.dirty?'score-dirty':''}><td className="score-number">{index+1}</td><td className="score-code">{student.student_no}</td><th scope="row" className="score-name">{student.name_prefix_th??''}{student.first_name_th} {student.last_name_th}</th>
    {semester?visibleScoreIndices.map(input):<>{[0,1,2].map(input)}<td><output className="score-output term-one" aria-label={'รวมภาคเรียน 1 '+student.student_no}>{value.term1??'—'}</output></td>{[3,4,5].map(input)}<td><output className="score-output term-two" aria-label={'รวมภาคเรียน 2 '+student.student_no}>{value.term2??'—'}</output></td></>}
    <td><output className="score-output total" aria-label={(semester?'รวมภาคเรียน '+termNo:'รวมทั้งปี')+' '+student.student_no}>{value.total??'—'}</output></td><td><output className={'score-output grade '+(d.special==='ร'?'special-r':d.special==='มส'?'special-ms':value.total!==null&&value.total>=50?'pass':'')} aria-label={'เกรด '+student.student_no}>{value.grade}</output></td><td className="score-note"><select aria-label={'หมายเหตุ '+student.student_no} disabled={!configured||busy} value={d.special} onChange={e=>update(student.id,{special:e.target.value})}><option value="">—</option><option value="ร">ร</option><option value="มส">มส</option></select></td></tr>;
   })}</tbody></table></div>
   {!students.length&&<p className="teacher-empty">ไม่มีนักเรียนลงทะเบียนในห้องที่เลือก</p>}{students.length>0&&!displayed.length&&<p className="teacher-empty">ไม่พบนักเรียนตามสถานะที่เลือก</p>}
   <footer className="score-footer"><span><AcademicIcon name="users"/>บันทึกครบ <strong>{normal+special}/{students.length}</strong> คน</span><div><button type="button" className="ui-primary" disabled={!dirty||busy||!configured} onClick={()=>void save()}><AcademicIcon name="check"/>{busy?'กำลังบันทึก…':'บันทึกคะแนนทั้งหมด'}</button></div></footer>
   <details className="score-help"><summary>วิธีกรอกคะแนน</summary><p>ช่องว่างหมายถึงยังไม่กรอก ไม่ใช่ 0 · ใช้คะแนนเต็มตามที่ Admin กำหนด · ร / มส แสดงแทนเกรดตัวเลข · กดบันทึกคะแนนทั้งหมดเพื่อเก็บทุกแถวที่แก้ไขในห้องนี้ รวมถึงแถวที่ซ่อนด้วยตัวกรอง สำหรับประถมจะตัดสินผลรายปีเมื่อครบทั้ง 6 ช่อง สำหรับมัธยมแสดงและตัดสินผลเฉพาะ 3 ช่องของรายวิชาในภาคเรียนที่เลือก (รหัสวิชาแต่ละภาคเรียนแยกกัน) หรือระบุ ร / มส</p></details>
  </section>
 </>;
}
