'use client';
import {useEffect,useRef,type ReactNode} from 'react';

export default function AcademicDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog?.close();document.body.style.overflow=old;};},[]);
 return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();}}} className="academic-dialog" aria-labelledby="academic-dialog-title">
  <header className="flex items-center justify-between gap-4 border-b border-slate-100 p-5"><h2 id="academic-dialog-title" className="text-lg font-bold text-blue-950">{title}</h2><button autoFocus type="button" onClick={onClose} aria-label="ปิดหน้าต่าง" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xl">×</button></header>
  <div className="p-5">{children}</div>
 </dialog>;
}
