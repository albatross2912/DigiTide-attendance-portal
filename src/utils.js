export function duration(ms=0){
  const s=Math.max(0,Math.floor(ms/1000)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return [h,m,sec].map(x=>String(x).padStart(2,"0")).join(":");
}
export function dateLabel(value){
  if(!value) return "—";
  const d=value.toDate?value.toDate():new Date(value);
  return d.toLocaleString([], {dateStyle:"medium",timeStyle:"short"});
}
export function csvDownload(rows,filename){
  const cols=["Employee","Email","Role","Shift Start","Shift End","Working Hours","Break Minutes","Status"];
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols,...rows.map(r=>[r.name,r.email,r.role,r.start,r.end,r.work,r.breaks,r.status])].map(r=>r.map(esc).join(",")).join("\\r\\n");
  const blob=new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}