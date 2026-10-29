'use client';
import {useEffect,useMemo,useState} from 'react';
import PageHeader from '@/components/page-header';
import AcademicDialog from '@/components/academic-dialog';
import {AcademicIcon} from '@/components/academic-visuals';
import {resolveYear,setYearSelection,YEAR_EVENT} from '@/lib/academic-year-selection';
import {useDirectorBase,useDirectorReport} from '@/lib/use-director-workspace';
import {directorOverview,directorRoomLabel,sumProgress,type ProgressCount,type DirectorRoom} from '@/lib/director-overview';
const fields=[['scores','คะแนน'],['attendance','เวลาเรียนถึงวันนี้'],['traits','คุณลักษณะฯ'],['reading','อ่านคิดเขียน'],['activity','กิจกรรม']] as const;
function Meter({value,label,note}:{value:ProgressCount;label:string;note?:string}){const percent=note?null:value.percent;return <div className="director-meter"><div><strong>{percent===null?'—':percent+'%'}</strong><span>{value.total?value.done+'/'+value.total:'ยังไม่มีรายการ'}</span></div><progress aria-label={label} max={100} value={percent??0}/>{note&&<small className="director-meter-note">{note}</small>}</div>;}
const attendanceSetup=(row:DirectorRoom)=>row.courses.filter(c=>c.attendanceIssue&&['dates','slots','missing'].includes(c.attendanceIssue)).length;
export default function DirectorPage(){
 const [retry,setRetry]=useState(0),[refresh,setRefresh]=useState(0),[yearId,setYearId]=useState(''),[termId,setTermId]=useState(''),[level,setLevel]=useState(''),[pending,setPending]=useState(false),[roomId,setRoomId]=useState('');
 const base=useDirectorBase(retry),school=base.data?.schoolId??'';
 const year=base.data?.years.some(y=>y.id===yearId)?yearId:resolveYear(base.data?.years??[],school),terms=base.data?.terms.filter(t=>t.academic_year_id===year)??[],term=terms.some(t=>t.id===termId)?termId:terms[0]?.id??'';
 const report=useDirectorReport(base.data,year,term,refresh);
 useEffect(()=>{const sync=(event:Event)=>{const d=(event as CustomEvent<{schoolId:string;yearId:string}>).detail;if(d?.schoolId===school){setYearId(d.yearId);setTermId('');setRoomId('');}};window.addEventListener(YEAR_EVENT,sync);return()=>window.removeEventListener(YEAR_EVENT,sync);},[school]);
 useEffect(()=>{setRoomId('');},[year,term,level]);
 const allRows=useMemo(()=>report.data?directorOverview(report.data,year,term):[],[report.data,year,term]),levels=[...new Set(allRows.map(r=>r.room.level_code))],validLevel=levels.includes(level)?level:'';
 const rows=allRows.filter(r=>!validLevel||r.room.level_code===validLevel),visible=rows.filter(r=>!pending||!r.complete),selected=rows.find(r=>r.room.id===roomId);
 const ready=!!report.data&&!base.loading&&!report.loading&&!base.error&&!report.error,loading=base.loading||report.loading||!!base.data&&!!year&&!!term&&!report.data&&!report.error;
 const studentCount=new Set(rows.flatMap(r=>r.studentIds)).size,courseCount=rows.reduce((n,r)=>n+r.courses.length,0),complete=rows.filter(r=>r.complete).length;
 const error=base.error||report.error,attendancePending=rows.reduce((n,r)=>n+attendanceSetup(r),0),activityPending=rows.filter(r=>!r.activities.length).length;
 function update(){setRoomId('');if(base.error)setRetry(n=>n+1);else setRefresh(n=>n+1);}
 return <main className="wichakan-page director-dashboard"><PageHeader title="ภาพรวมผู้บริหาร"/>
  <section className="ui-panel director-filters" aria-label="ตัวกรองภาพรวมผู้บริหาร">
   <label>ปีการศึกษา<select aria-label="ปีการศึกษาผู้บริหาร" disabled={!base.data||base.loading} value={year} onChange={e=>{setYearId(e.target.value);setTermId('');setYearSelection(school,e.target.value);}}>{!base.data?.years.length&&<option value="">ยังไม่มีปีการศึกษา</option>}{base.data?.years.map(y=><option key={y.id} value={y.id}>{y.year_be}</option>)}</select></label>
   <label>ภาคเรียน<select aria-label="ภาคเรียนผู้บริหาร" disabled={!base.data||!terms.length} value={term} onChange={e=>setTermId(e.target.value)}>{!terms.length&&<option value="">ยังไม่มีภาคเรียน</option>}{terms.map(t=><option key={t.id} value={t.id}>ภาคเรียนที่ {t.term_no}</option>)}</select></label>
   <label>ระดับชั้น<select aria-label="ระดับชั้นผู้บริหาร" value={validLevel} disabled={!ready} onChange={e=>setLevel(e.target.value)}><option value="">ทั้งหมด</option>{levels.map(l=><option key={l} value={l}>{l}</option>)}</select></label>
   <button className="ui-secondary" disabled={loading} onClick={update}>อัปเดตข้อมูล</button>
  </section>
  {error&&<p role="alert" className="teacher-error">{error}<button type="button" onClick={update}>ลองอีกครั้ง</button></p>}
  {loading&&<p role="status" className="director-loading">กำลังรวบรวมข้อมูลรายห้อง...</p>}
  {!loading&&!error&&base.data&&(!year||!term)&&<p className="ui-panel p-5">ยังไม่มีปีหรือภาคเรียนสำหรับติดตามข้อมูล</p>}
  {ready&&<><div className="director-context"><p>ติดตามการบันทึกข้อมูลประถม–มัธยม · ภาคเรียนที่ {terms.find(t=>t.id===term)?.term_no}/{base.data?.years.find(y=>y.id===year)?.year_be}</p><span>อัปเดต {report.updated} น.</span></div>
   <section className="teacher-metrics" aria-label="ภาพรวมโรงเรียน">
    {[{title:'นักเรียนในห้องที่แสดง',value:studentCount,unit:'คน',icon:'users' as const,color:'blue'},{title:'ห้องเรียน',value:rows.length,unit:'ห้อง',icon:'users' as const,color:'purple'},{title:'รายวิชาที่เปิดสอน',value:courseCount,unit:'วิชา–ห้อง',icon:'book' as const,color:'orange'},{title:'ห้องที่บันทึกครบ',value:complete,unit:'จาก '+rows.length+' ห้อง',icon:'check' as const,color:'green'}].map(m=><div className={'teacher-metric '+m.color} key={m.title}><i><AcademicIcon name={m.icon}/></i><div><p>{m.title}</p><strong>{m.value}</strong><span>{m.unit}</span></div></div>)}
   </section>
   <section className="ui-panel director-summary" aria-label="ความคืบหน้ารวม"><h2>ความคืบหน้าการบันทึกข้อมูล</h2><p>นับข้อมูลที่บันทึกแล้ว · เวลาเรียนตามคาบที่ถึงวันนี้ · กิจกรรมประถมรายปีและมัธยมรายภาค</p><div className="director-progress-grid">{fields.map(([key,label])=><div key={key}><h3>{label}</h3><Meter value={sumProgress(rows.map(r=>r[key]))} label={'ภาพรวม '+label} note={key==='attendance'&&attendancePending?'รอตั้งค่า '+attendancePending+' วิชา':key==='activity'&&activityPending?'ยังไม่กำหนด '+activityPending+' ห้อง':undefined}/></div>)}</div></section>
   <section className="ui-panel director-rooms" aria-labelledby="director-room-heading"><div className="director-room-toolbar"><div><h2 id="director-room-heading">ติดตามงานรายห้อง</h2><p>คะแนนและการประเมินนับคน · เวลาเรียนนับคน–คาบ</p></div><label className="director-pending"><input type="checkbox" checked={pending} onChange={e=>setPending(e.target.checked)}/> เฉพาะห้องที่ยังไม่ครบ</label></div>
    <div className="director-table-scroll" role="region" aria-label="ตารางติดตามงานรายห้อง" tabIndex={0}><table className="director-table"><thead><tr><th scope="col">ห้อง</th><th scope="col">นักเรียน</th><th scope="col">ครูประจำชั้น</th>{fields.map(([key,label])=><th scope="col" key={key}>{label}</th>)}<th scope="col">สถานะ</th><th scope="col">รายละเอียด</th></tr></thead><tbody>{visible.map(r=><tr key={r.room.id}><th scope="row">{directorRoomLabel(r.room)}</th><td>{r.studentIds.length}</td><td className="director-teachers">{r.homerooms.length?r.homerooms.map((name,i)=><div key={i}>{name}</div>):'ยังไม่มอบหมาย'}</td>{fields.map(([key,label])=><td key={key}><Meter value={r[key]} label={label+' '+directorRoomLabel(r.room)} note={key==='attendance'&&attendanceSetup(r)?'รอตั้งค่า '+attendanceSetup(r)+' วิชา':key==='activity'&&!r.activities.length?'ยังไม่กำหนดกิจกรรม':undefined}/></td>)}<td><span className={'director-status '+(r.complete?'complete':'pending')}>{r.complete?'บันทึกครบ':'ต้องติดตาม'}</span></td><td><button className="ui-secondary" onClick={()=>setRoomId(r.room.id)} aria-label={'ดูรายละเอียด '+directorRoomLabel(r.room)}>ดูรายละเอียด</button></td></tr>)}</tbody></table></div>
    {!visible.length&&<p className="director-empty">{rows.length?'ทุกห้องที่แสดงบันทึกครบแล้ว':'ยังไม่มีห้องเรียนในช่วงที่เลือก'}</p>}
   </section>
  </>}
  {ready&&selected&&<RoomDetails row={selected} onClose={()=>setRoomId('')}/>}
 </main>;
}
function RoomDetails({row,onClose}:{row:DirectorRoom;onClose:()=>void}){return <AcademicDialog title={'ติดตามงาน '+directorRoomLabel(row.room)} onClose={onClose}>
 <p className="mb-3 text-sm">นักเรียน {row.studentIds.length} คน · ครูประจำชั้น {row.homerooms.join(' / ')||'ยังไม่มอบหมาย'}</p>
 {row.issues.length>0&&<ul className="director-issues" aria-label="ข้อมูลที่ต้องตรวจสอบ">{row.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
 <h3 className="mb-2 font-semibold">รายวิชาและครูผู้รับผิดชอบ</h3><div className="director-detail-scroll"><table className="director-detail-table"><thead><tr><th>รายวิชา</th><th>ครูผู้สอน</th><th>คะแนน</th><th>เวลาเรียน</th><th>คุณลักษณะฯ</th><th>อ่านคิดเขียน</th></tr></thead><tbody>{row.courses.map(c=><tr key={c.id}><th scope="row"><strong>{c.code}</strong><div>{c.name}</div>{c.issues.map(issue=><small className="director-issue" key={issue}>{issue}</small>)}</th><td>{c.teachers.join(' / ')||'ยังไม่มอบหมาย'}</td>{(['scores','attendance','traits','reading'] as const).map(key=><td key={key}>{c[key].total?<><strong>{c[key].done}/{c[key].total}</strong><small className="block">ขาด {c[key].total-c[key].done}</small></>:'—'}</td>)}</tr>)}</tbody></table></div>
 {!row.courses.length&&<p className="director-empty">ยังไม่มีรายวิชาในภาคเรียนนี้</p>}
 <h3 className="mb-2 mt-5 font-semibold">กิจกรรมพัฒนาผู้เรียน</h3><div className="director-detail-scroll"><table className="director-detail-table director-activity-table"><thead><tr><th>กิจกรรม</th><th>ผู้ประเมิน</th><th>บันทึกครบ</th></tr></thead><tbody>{row.activities.map(a=><tr key={a.key}><th scope="row">{a.name}<small className="block font-normal">{a.period?'ภาคเรียนที่ '+a.period:'รายปี'}</small></th><td>{a.teachers.join(' / ')||'ยังไม่มอบหมาย'}</td><td>{a.progress.done}/{a.progress.total}<small className="block">ขาด {a.progress.total-a.progress.done}</small></td></tr>)}</tbody></table></div>
 {!row.activities.length&&<p className="director-empty">ยังไม่กำหนดกิจกรรมในห้องนี้</p>}
 </AcademicDialog>;}
