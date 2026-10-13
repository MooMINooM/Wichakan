'use client';
type Props={total:number;page:number;onChange:(page:number)=>void;size?:number};
export const PAGE_SIZE=10;
export default function PageControls({total,page,onChange,size=PAGE_SIZE}:Props){
 const pages=Math.max(1,Math.ceil(total/size));
 if(total<=size)return <p className="mt-3 text-xs text-slate-500">ทั้งหมด {total} รายการ</p>;
 return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
  <span className="text-slate-500">รายการ {Math.min(total,(page-1)*size+1)}–{Math.min(total,page*size)} จาก {total}</span>
  <div className="flex items-center gap-2">
   <button type="button" disabled={page<=1} onClick={()=>onChange(page-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">ก่อนหน้า</button>
   <span className="text-slate-500">{page}/{pages}</span>
   <button type="button" disabled={page>=pages} onClick={()=>onChange(page+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">ถัดไป</button>
  </div>
 </div>;
}