'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
/** Keep existing bookmarks working after moving score configuration into subjects. */
export default function ScoreSettingsPage(){
 const router=useRouter();
 useEffect(()=>{router.replace('/curriculum');},[router]);
 return <main className="wichakan-page"><p role="status">กำลังเปิดหลักสูตรและรายวิชา...</p></main>;
}
