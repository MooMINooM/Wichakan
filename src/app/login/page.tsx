'use client';

import Link from 'next/link';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError('ยังไม่ได้เชื่อมต่อ Supabase กรุณากำหนด Environment Variables'); return; }
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) { setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลบัญชี'); return; }
    router.push('/workspace');
  }
  return <main className="wichakan-page wichakan-auth mx-auto max-w-md px-5 py-20">
    <div className="ui-panel rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/" className="text-sm text-blue-700">← Wichakan</Link>
      <h1 className="mt-5 text-3xl font-bold">เข้าสู่ระบบ</h1>
      <p className="mb-8 mt-2 text-sm text-slate-500">ใช้บัญชีที่โรงเรียนมอบหมาย</p>
      <form onSubmit={signIn} className="space-y-4">
        <label className="block text-sm font-medium">อีเมล<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label>
        <label className="block text-sm font-medium">รหัสผ่าน<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3"/></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="ui-primary w-full rounded-xl bg-blue-800 px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
      </form>
    </div>
  </main>;
}
