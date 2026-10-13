'use client';
export const YEAR_EVENT='wichakan:academic-year';
export function getYearSelection(schoolId:string):string{
 if(typeof window==='undefined'||!schoolId)return '';
 try{return window.localStorage.getItem('wichakan:year:'+schoolId)??'';}catch{return '';}
}
export function setYearSelection(schoolId:string,yearId:string):void{
 if(typeof window==='undefined'||!schoolId)return;
 try{window.localStorage.setItem('wichakan:year:'+schoolId,yearId);}catch{}
 window.dispatchEvent(new CustomEvent(YEAR_EVENT,{detail:{schoolId,yearId}}));
}
export function resolveYear<T extends {id:string;is_active?:boolean}>(
 years:T[],schoolId:string,preferred?:string
):string{
 if(preferred&&years.some(y=>y.id===preferred))return preferred;
 const saved=getYearSelection(schoolId);
 return years.find(y=>y.id===saved)?.id??years.find(y=>y.is_active)?.id??years[0]?.id??'';
}
