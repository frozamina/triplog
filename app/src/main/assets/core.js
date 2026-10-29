(function(root){
'use strict';
const modes={walk:'步行',taxi:'打车',bus:'公交',metro:'地铁',train:'动车',highspeed:'高铁',coach:'大巴',drive:'驾车',flight:'飞机',ferry:'轮渡',bike:'骑行'};
const colors={walk:'#8B8F94',taxi:'#767B82',bus:'#8E7A4A',metro:'#3F7D6B',train:'#2C5C8F',highspeed:'#2C5C8F',coach:'#A8763C',drive:'#6A5A8C',flight:'#56859B',ferry:'#367D93',bike:'#6A8B52',wait:'#C4542F'};
const uid=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3|8)).toString(16)});
const timeline=t=>[...(t.legs||[]).map(s=>({...s,kind:'leg'})),...(t.transfers||[]).map(s=>({...s,kind:'transfer'}))].sort((a,b)=>a.seq-b.seq);
const start=s=>s.kind==='transfer'?s.start_at:s.depart_at;
const end=s=>s.kind==='transfer'?s.end_at:s.arrive_at;
const minutes=(a,b)=>a&&b?Math.max(0,(Date.parse(b)-Date.parse(a))/60000):0;
function metrics(t,now){
 const list=timeline(t), n=now||new Date().toISOString();let travel=0,wait=0,cents=0,km=0;
 list.forEach(s=>{let d=minutes(start(s),end(s)||(t.status==='ongoing'?n:null));if(s.kind==='transfer')wait+=d;else{travel+=d;cents+=Math.round(Number(s.cost||0)*100);km+=Number(s.distance_km||0)}});
 const total=list.length?minutes(start(list[0]),end(list[list.length-1])||(t.status==='ongoing'?n:null)):minutes(t.depart_at,t.arrive_at);
 const distance=Number(t.distance_km)||km;
 return{travel,wait,cost:cents/100,distance,total,transfers:t.transfers.length,ratio:total?wait/total:0,speed:total?distance/(total/60):0,perKm:distance?cents/100/distance:0,gap:Math.max(0,total-travel-wait)};
}
function validate(t){
 if(!t.origin.trim()||!t.destination.trim()||!t.date)throw Error('请填写出发地、目的地和日期');
 let previous=null;const list=timeline(t);if(list.length>2000)throw Error('段数过多');
 list.forEach((s,i)=>{const a=start(s),b=end(s);if(!a||!Number.isFinite(Date.parse(a)))throw Error('第 '+(i+1)+' 段缺少有效开始时间');
 if(b&&(!Number.isFinite(Date.parse(b))||Date.parse(b)<Date.parse(a)))throw Error('第 '+(i+1)+' 段结束时间早于开始时间');
 if(!b&&(t.status==='done'||i<list.length-1))throw Error('请补全第 '+(i+1)+' 段结束时间');
 if(previous&&Date.parse(a)<Date.parse(previous))throw Error('第 '+(i+1)+' 段与上一段时间重叠');previous=b;
 if(s.kind==='leg'&&(!modes[s.mode]||!Number.isFinite(Number(s.cost||0))||Number(s.cost||0)<0||!Number.isFinite(Number(s.distance_km||0))||Number(s.distance_km||0)<0))throw Error('交通方式、金额或里程无效');
 });if(Number(t.distance_km||0)<0||!Number.isFinite(Number(t.distance_km||0)))throw Error('里程无效');
 if(t.depart_at&&t.arrive_at&&Date.parse(t.arrive_at)<Date.parse(t.depart_at))throw Error('到达时间早于出发时间');return t;
}
function copyTrip(t,date){const c=JSON.parse(JSON.stringify(t)),list=timeline(c),base=list.length?Date.parse(start(list[0])):Date.parse(c.date),target=Date.parse(date+'T'+(list.length?local(start(list[0])).slice(11):'08:00')),delta=target-base;c.id=uid();c.date=date;c.status='draft';c.created_at=new Date().toISOString();list.forEach(s=>{s.id=uid();for(const k of ['depart_at','arrive_at','start_at','end_at'])if(s[k])s[k]=new Date(Date.parse(s[k])+delta).toISOString()});c.legs=list.filter(s=>s.kind==='leg');c.transfers=list.filter(s=>s.kind==='transfer');return c;}
const local=v=>{if(!v)return '';let d=new Date(v);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const duration=v=>{let n=Math.round(v);return n>=60?Math.floor(n/60)+'h '+n%60+'m':n+'m'};
function csv(trips){const q=s=>'"'+String(s??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';let rows=[['出发日期','出发地','目的地','类型','方式或活动','开始','结束','花费','里程','备注']];trips.forEach(t=>timeline(t).forEach(s=>rows.push([t.date,t.origin,t.destination,s.kind==='leg'?'通行':'等待',s.kind==='leg'?modes[s.mode]:s.activity,start(s),end(s),s.cost||0,s.distance_km||0,s.note||''])));return '\uFEFF'+rows.map(r=>r.map(q).join(',')).join('\r\n');}
const api={modes,colors,uid,timeline,start,end,minutes,metrics,validate,copyTrip,local,duration,csv};if(typeof module!=='undefined')module.exports=api;else root.Core=api;
})(typeof window!=='undefined'?window:globalThis);
