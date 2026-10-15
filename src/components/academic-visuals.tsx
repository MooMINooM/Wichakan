import type {ReactNode} from 'react';

export function AcademicIcon({name,className=''}:{name:'calendar'|'book'|'users'|'chart'|'check'|'edit'|'school'|'search'|'file'|'alert';className?:string}){
 const paths:Record<typeof name,ReactNode>={
  alert:<><path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h4m-10 3h2"/></>,
  book:<><path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v15"/><path d="M6 8h2m8 0h2M6 12h2m8 0h2"/></>,
  users:<><circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3ZM5 5a3 3 0 0 0 0 6M19 5a3 3 0 0 1 0 6M3 21H1v-4a4 4 0 0 1 3-4m17 8h2v-4a4 4 0 0 0-3-4"/></>,
  chart:<><path d="M4 21V13h3v8Zm7 0V7h3v14Zm7 0V2h3v19Z"/></>,
  check:<><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/></>,
  edit:<><path d="m15 4 5 5M4 16 17 3a2 2 0 0 1 4 4L8 20l-5 1Z"/></>,
  school:<><path d="m2 8 10-5 10 5-10 5Zm4 3v6c4 3 8 3 12 0v-6m4-3v11"/></>,
  search:<><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></>,
  file:<><path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8m-8 4h8"/></>,
 };
 return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function SchoolScene(){
 return <svg viewBox="0 0 560 180" className="academic-school-scene" aria-hidden="true">
  <defs><linearGradient id="school-wall" x2="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#b9dfff"/></linearGradient><linearGradient id="school-tree" x2="1" y2="1"><stop stopColor="#a5e6c7"/><stop offset="1" stopColor="#4ab5ab"/></linearGradient></defs>
  <path fill="#fff" opacity=".7" d="M25 60h109c-1-14-15-18-27-14-2-24-34-28-43-7-19-9-36 2-39 21Zm335-29h124c-2-13-15-17-27-14-3-23-35-22-42-4-20-12-41-4-42 9-7-2-11 1-13 9Z"/>
  <path fill="#b7e0f4" d="M0 164Q60 70 140 140 240 80 340 146 440 65 560 130v50H0Z"/>
  {[60,112,445,493,535].map((x,i)=><g key={x} transform={`translate(${x} ${i%2?99:114})`}><ellipse cy="-10" rx="20" ry="36" fill="url(#school-tree)"/><path d="M0-25v64m0-29-10-9m10 1 10-9" stroke="#71aaa2" strokeWidth="3"/></g>)}
  <path fill="#42b7f0" d="M171 98h92v69h-92Zm164 0h69v69h-69Z"/>
  <path fill="url(#school-wall)" d="M165 107h100v60H165Zm171 0h76v60h-76ZM261 76l40-30 40 30v91h-80Z"/>
  <path fill="#2095f5" d="m155 106 15-17h90v17Zm182 0V89h69l17 17ZM250 77l51-40 51 40-7 7-44-34-44 34Z"/>
  <path fill="#0a7bea" d="M288 131h26v36h-26Z"/><path stroke="#83c7fa" strokeWidth="2" d="M301 134v33"/>
  {[180,206,232,350,376].map(x=><g key={x} fill="#7bc6fc" stroke="#eff9ff" strokeWidth="2"><path d={`M${x} 118h13v16h-13Zm0 25h13v16h-13Z`}/></g>)}
  <circle cx="301" cy="90" r="10" fill="#fff" stroke="#168cff" strokeWidth="2"/><path d="M301 83v7l5 3M301 38V12" stroke="#168cff" strokeWidth="2"/><path d="M303 12q11-7 22 0v13q-11-7-22 0" fill="#59b6ff"/>
  <path d="M300 167h-22l-22 13h90l-22-13Z" fill="#d6ebfa"/>
  <path d="M0 177h560" stroke="#93dbbc" strokeWidth="6"/>
  {[147,176,245,352,419].map(x=><ellipse key={x} cx={x} cy="170" rx="17" ry="9" fill="#74cfb2"/>)}
 </svg>;
}
