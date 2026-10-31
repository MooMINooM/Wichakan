import Link from 'next/link';
import PageHeader from '@/components/page-header';
const modules=[['ทะเบียนนักเรียน','/students'],['ตั้งค่างานวิชาการ','/academic'],['หลักสูตรและรายวิชา','/curriculum']];
export default function Home(){
 return <main className="wichakan-page">
  <PageHeader title="Wichakan" context="ระบบบริหารงานวิชาการสถานศึกษา" actions={<><Link href="/login" className="ui-primary">เข้าสู่ระบบ</Link><Link href="/workspace" className="ui-secondary">พื้นที่ทำงาน</Link></>}/>
  <section className="mt-5 grid gap-4 sm:grid-cols-3" aria-label="เมนูหลัก">{modules.map(([title,url])=><Link href={url} key={url} className="ui-panel ui-module"><h2>{title}</h2><span aria-hidden="true">→</span></Link>)}</section>
 </main>;
}
