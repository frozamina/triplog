/* npm install --no-save playwright@1.62.1; npx playwright install chromium
   PLAYWRIGHT_MODULE and BROWSER_EXE can select an existing local installation.
   Fixtures are test-only and are never bundled in the APK. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),url='file:///'+path.join(root,'app/src/main/assets/index.html').replaceAll('\\','/');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/design.json'),'utf8'));
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXE?{executablePath:process.env.BROWSER_EXE}:{})});
 const page=await browser.newPage({viewport:{width:390,height:790},reducedMotion:'reduce'}),errors=[];
 await page.clock.install({time:new Date('2026-10-29T16:02:18+08:00')});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 // Loading legacy v1 records must not create, replace or reseed any stored record.
 fixture.trips[0].unknown_future_field={preserve:true};
 await page.evaluate(v=>localStorage.setItem('triplog-preview',JSON.stringify(v)),fixture);
 await page.reload();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('triplog-preview'))),fixture);
 const out=path.join(root,'app/build/ui-verification');fs.mkdirSync(out,{recursive:true});
 for(const width of [320,360,390,480]){
  await page.setViewportSize({width,height:790});
  for(const screenName of ['home','live','detail','editor','insights','compare','mine']){
   await page.evaluate(name=>{screen=name;current=name==='live'?'design-live':'design-detail';if(name==='editor'){draft=clone(currentTrip());editing=current;selectedLeg=draft.legs[0].id}render()},screenName);
   assert.equal(await page.evaluate(()=>document.querySelector('.app-screen').scrollWidth>innerWidth),false,screenName+' overflow at '+width);
   if(screenName==='live'){
    assert.equal(await page.getByTestId('timer-card').count(),1);assert.equal(await page.locator('.rec-timer').count(),1);
    assert.equal(await page.locator('.rec-modes .mchip').count(),6);assert.equal(await page.locator('.rec-bottom .rec-stop').count(),1);
   }
   if(width===390)await page.screenshot({path:path.join(out,screenName+'.png')});
  }
 }
 await page.setViewportSize({width:390,height:790});
 await page.evaluate(()=>{screen='home';render()});
 await page.getByRole('button',{name:'新建行程',exact:true}).click();
 await page.locator('#trip-origin').fill('杭州');await page.locator('#trip-destination').fill('上海');
 await page.getByRole('button',{name:'添加行程段',exact:true}).click();
 await page.locator('[data-field=cost]').fill('100.10');
 await page.getByRole('button',{name:'添加换乘',exact:true}).click();
 await page.locator('#wait-location').fill('上海虹桥');await page.getByRole('button',{name:'保存换乘',exact:true}).click();
 await page.getByRole('button',{name:'添加行程段',exact:true}).click();
 await page.locator('[data-field=cost]').last().fill('0.20');
 await page.getByRole('button',{name:'完成',exact:true}).click();
 assert.equal(await page.evaluate(()=>C.metrics(currentTrip()).cost),100.3);
 await page.getByRole('button',{name:'存为模板',exact:true}).click();
 await page.getByRole('button',{name:'返回',exact:true}).click();
 await page.evaluate(()=>quickLive());
 await page.locator('#trip-quick_origin').fill('杭州');await page.locator('#trip-quick_destination').fill('南京');
 await page.getByRole('button',{name:'开始行程',exact:true}).click();
 const started=await page.evaluate(()=>activeOf(currentTrip()).depart_at);
 const activeId=await page.evaluate(()=>current);
 await page.getByRole('button',{name:'选择等待',exact:true}).click();
 assert.equal(await page.evaluate(()=>activeOf(currentTrip()).start_at),started);
 await page.reload();await page.evaluate(id=>{current=id;screen='live';render()},activeId);
 assert.equal(await page.evaluate(()=>activeOf(currentTrip()).start_at),started);
 await page.getByRole('button',{name:'选择打车',exact:true}).click();
 assert.equal(await page.evaluate(()=>activeOf(currentTrip()).depart_at),started);
 await page.getByRole('button',{name:'结束本段 › 开始等待',exact:true}).click();
 assert.equal(await page.evaluate(()=>activeOf(currentTrip()).start_at===currentTrip().legs.at(-1).arrive_at),true);
 await page.getByRole('button',{name:'结束等待 › 开始下一段',exact:true}).click();
 assert.equal(await page.evaluate(()=>activeOf(currentTrip()).mode),'taxi');
 await page.getByRole('button',{name:'打卡操作',exact:true}).click();await page.getByRole('button',{name:'结束整趟行程',exact:true}).click();
 await page.getByRole('button',{name:'抵达目的地 · 结束并保存',exact:true}).click();
 assert.equal(await page.evaluate(()=>currentTrip().status),'done');
 // The pre-existing record, unknown fields and all IDs survive subsequent saves.
 assert.deepEqual(await page.evaluate(()=>data.trips.find(t=>t.id==='design-detail')),fixture.trips[0]);
 
 // Long unfinished segments expose all three recovery actions, without auto-ending.
 await page.evaluate(()=>{let t=clone(data.trips.find(t=>t.id==='design-live'));t.legs.at(-1).depart_at=new Date(Date.now()-7*3600000).toISOString();t.legs=t.legs.slice(-1);t.legs[0].seq=0;t.transfers=[];t.id='long-running';t.status='ongoing';persist('trips',t);current=t.id;screen='live';render()});
 assert.equal(await page.getByRole('button',{name:'按预计时间结束',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'继续计时',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'手动改时间',exact:true}).count(),1);
 await page.getByRole('button',{name:'手动改时间',exact:true}).click();
 await page.locator('#manual-end').fill('2026-10-29T15:30');
 await page.getByRole('button',{name:'按此时间结束',exact:true}).click();
 assert.equal(await page.evaluate(()=>activeOf(currentTrip()).kind),'transfer');
 // Same-record metadata edits keep an ongoing timer in ongoing state.
 await page.getByRole('button',{name:'打卡操作',exact:true}).click();
 await page.getByRole('button',{name:'补充本段地点、花费',exact:true}).click();
 await page.getByRole('button',{name:'保存',exact:true}).click();
 assert.equal(await page.evaluate(()=>currentTrip().status),'ongoing');
 // Template reuse and label management operate on real saved records.
 await page.evaluate(()=>{screen='mine';render()});
 await page.getByRole('button',{name:/路线模板/}).click();
 await page.getByRole('button',{name:/套用/}).click();
 assert.equal(await page.evaluate(()=>draft.date), '2026-10-29');
 assert.equal(await page.evaluate(()=>draft.legs.length),2);
 await page.evaluate(()=>{screen='mine';modal=null;render()});
 await page.getByRole('button',{name:/标签管理/}).click();
 await page.getByRole('button',{name:'晚点1',exact:true}).click();
 await page.locator('#rename-tag').fill('列车晚点');
 await page.getByRole('button',{name:'应用到全部记录',exact:true}).click();
 assert.equal(await page.evaluate(()=>data.trips.find(t=>t.id==='design-detail').legs[1].tags.includes('列车晚点')),true);

 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: seven screens at four widths; original data preservation; complete record; template; native-style timer card; type switch; reload; close-and-start; inferred mode; finish.');
})().catch(e=>{console.error(e);process.exitCode=1});
