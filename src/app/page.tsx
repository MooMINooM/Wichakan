import Link from 'next/link';
const modules = [
  { name: 'ทะเบียนนักเรียน', en: 'Student Registry', status: 'วางโครงสร้างฐานข้อมูล' },
  { name: 'หลักสูตรและรายวิชา', en: 'Curriculum', status: 'วางโครงสร้างฐานข้อมูล' },
  { name: 'ปีการศึกษาและห้องเรียน', en: 'Academic Setup', status: 'วางโครงสร้างฐานข้อมูล' },
  { name: 'คะแนนและผลการเรียน', en: 'Assessment', status: 'อยู่ในแผนพัฒนา' },
  { name: 'เอกสาร ปพ.', en: 'Documents', status: 'อยู่ในแผนพัฒนา' },
  { name: 'รายงานและสถิติ', en: 'Analytics', status: 'อยู่ในแผนพัฒนา' },
];
export default function Home() {
  return <main className="mx-auto max-w-6xl px-5 py-10">
    <header className="mb-10 rounded-3xl bg-[#123b72] p-8 text-white shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200">School Academic Management System</div>
      <h1 className="mt-4 text-4xl font-bold">Wichakan <span className="text-blue-200">v0.1</span></h1>
      <p className="mt-3 max-w-2xl text-blue-100">ระบบบริหารงานวิชาการสถานศึกษา — โครงสร้างเริ่มต้นสำหรับการพัฒนา ยังไม่เปิดใช้กับข้อมูลจริง</p>
    </header>
    <div className="mb-6 flex flex-wrap gap-3"><Link href="/login" className="rounded-xl bg-blue-800 px-5 py-3 text-sm font-medium text-white">เข้าสู่ระบบ</Link><Link href="/students" className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-medium text-blue-800">ทะเบียนนักเรียน</Link></div>
    <div className="mb-6"><Link href="/academic" className="inline-flex rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-medium text-blue-800">ตั้งค่าปีการศึกษาและห้องเรียน →</Link></div>
    <section aria-label="Modules" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((mod) => <article key={mod.en} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 h-1 w-12 rounded-full bg-blue-500"/>
        <h2 className="text-lg font-bold">{mod.name}</h2><p className="mt-1 text-sm text-slate-500">{mod.en}</p>
        <p className="mt-5 text-xs font-medium text-blue-700">{mod.status}</p>
      </article>)}
    </section>
    <p className="mt-8 text-sm text-slate-500">หมายเหตุ: หน้านี้เป็นหน้าแสดงโครงสร้างโครงการ ไม่ใช่ระบบทะเบียนหรือระบบให้คะแนนที่ใช้งานได้แล้ว</p>
  </main>;
}
