const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js');
function trip(){return {id:'test',origin:'湛江',destination:'深圳',date:'2026-10-24',status:'done',legs:[{id:'a',seq:0,mode:'highspeed',depart_at:'2026-10-24T23:00:00+08:00',arrive_at:'2026-10-25T01:00:00+08:00',cost:100.10,distance_km:200},{id:'b',seq:2,mode:'metro',depart_at:'2026-10-25T01:30:00+08:00',arrive_at:'2026-10-25T02:00:00+08:00',cost:0.20,distance_km:20}],transfers:[{id:'w',seq:1,start_at:'2026-10-25T01:00:00+08:00',end_at:'2026-10-25T01:30:00+08:00'}]}}
let t=trip();C.validate(t);let m=C.metrics(t);assert.equal(m.total,180);assert.equal(m.travel,150);assert.equal(m.wait,30);assert.equal(m.cost,100.3);assert.equal(m.distance,220);assert.equal(m.transfers,1);assert.equal(m.ratio,1/6);
t.legs[1].depart_at='2026-10-25T01:15:00+08:00';assert.throws(()=>C.validate(t),/重叠/);
t=trip();t.legs[0].cost=-1;assert.throws(()=>C.validate(t),/金额/);
t=trip();t.legs[0].arrive_at='2026-10-24T22:00:00+08:00';assert.throws(()=>C.validate(t),/早于/);
t=trip();let c=C.copyTrip(t,'2027-02-01');C.validate(c);assert.notEqual(t.id,c.id);assert.notEqual(t.legs[0].id,c.legs[0].id);assert.equal(C.metrics(c).total,180);assert.equal(C.local(c.legs[0].depart_at).slice(0,10),'2027-02-01');
t=trip();t.status='ongoing';t.legs[1].arrive_at=null;C.validate(t);assert.equal(C.metrics(t,'2026-10-25T02:30:00+08:00').total,210);
t.status='done';assert.throws(()=>C.validate(t),/补全/);
t=trip();t.origin='=HYPERLINK("bad")';let csv=C.csv([t]);assert(csv.startsWith('\uFEFF'));assert(csv.includes("'=HYPERLINK"));assert(csv.includes('等待'));
t=trip();t.legs[0].distance_km=0;t.legs[1].distance_km=0;assert.equal(C.metrics(t).perKm,0);assert.equal(C.metrics(t).speed,0);
console.log('PASS: overnight, independent waits, integer cents, overlap, negative values, template dates, durable timer, incomplete records, CSV formula escaping, zero distance');
