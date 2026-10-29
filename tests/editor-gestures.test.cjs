const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),url='file:///'+path.join(root,'app/src/main/assets/index.html').replaceAll('\\','/');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXE?{executablePath:process.env.BROWSER_EXE}:{})});
 try {
  const page=await browser.newPage({viewport:{width:390,height:790},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));let confirmDelete=true;
  page.on('dialog',d=>confirmDelete?d.accept():d.dismiss());
  await page.goto(url);const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/design.json'),'utf8'));
  await page.evaluate(v=>{data=v;localStorage.setItem('triplog-preview',JSON.stringify(v));current='design-detail';edit()},fixture);
  const out=path.join(root,'app/build/interaction-verification');fs.mkdirSync(out,{recursive:true});
  // Keyboard and touch focus use a single container; the symbol is inside it.
  const amount=page.locator('[data-seg="taxi"][data-field="cost"]');await amount.fill('45');await amount.focus();
  assert.equal(await amount.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  assert.equal(await amount.evaluate(el=>{const a=el.getBoundingClientRect(),r=el.closest('.cost-entry').getBoundingClientRect(),s=el.closest('.cost-entry').querySelector('.cost-unit').getBoundingClientRect();return r.left<=s.left&&s.right<=a.left&&a.right<=r.right}),true);
  await page.screenshot({path:path.join(out,'amount-focus.png')});
  // Selecting walking is free; switching back restores an entered fare.
  const card=page.locator('[data-segment-id="taxi"]');
  await card.getByRole('button',{name:'选择步行',exact:true}).click();
  assert.equal(await card.locator('[data-field="cost"]').count(),0);
  assert.equal(await card.locator('.legfoot').innerText(),'步行 · 免费\n+ 备注');
  assert.equal(await page.evaluate(()=>draft.legs.find(s=>s.id==='taxi').cost),0);
  await card.getByRole('button',{name:'选择打车',exact:true}).click();assert.equal(await card.locator('[data-field="cost"]').inputValue(),'45');
  await card.getByRole('button',{name:'选择步行',exact:true}).click();await page.screenshot({path:path.join(out,'walking-free.png')});
  // Existing walking records with missing amounts do not count as missing fares.
  await page.evaluate(()=>{let t=data.trips.find(t=>t.id==='design-detail');t.legs.find(s=>s.mode==='walk').cost=null;screen='detail';render()});
  assert.equal(await page.locator('.notice').filter({hasText:'段没填花费'}).count(),0);
  await page.evaluate(()=>edit());await page.getByRole('button',{name:'编辑换乘等待',exact:true}).count();
  await page.locator('[data-action="waitEdit"]').first().click();
  for(const label of ['删除']){const b=page.getByRole('dialog').getByRole('button',{name:label,exact:true});const box=await b.boundingBox();assert(box.width>=80&&box.height>=48)}
  await page.screenshot({path:path.join(out,'segment-actions.png')});
  assert.equal(await page.getByRole('button',{name:'↑ 上移',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'↓ 下移',exact:true}).count(),0);
  await page.evaluate(()=>{screen='home';modal=null;render()});
  // A short click still opens the trip. A hold opens actions without navigation.
  const homeCard=()=>page.locator('.trip[data-value="design-detail"]');
  await homeCard().click();assert.equal(await page.evaluate(()=>screen),'detail');await page.getByRole('button',{name:'返回',exact:true}).click();
  const box=await homeCard().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
  assert.equal(await page.evaluate(()=>screen),'home');await page.getByRole('dialog').getByRole('button',{name:'删除行程',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'home-long-press.png')});
  confirmDelete=false;await page.getByRole('button',{name:'删除行程',exact:true}).click();assert.equal(await homeCard().count(),1);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  // Scrolling motion cancels the hold rather than offering deletion.
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+30);await page.waitForTimeout(650);
  assert.equal(await page.getByRole('dialog').count(),0);await page.mouse.up();
  await page.evaluate(()=>{screen='home';render()});
  const fresh=await homeCard().boundingBox();const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fresh.x+fresh.width/2,y:fresh.y+fresh.height/2}]});await page.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('dialog').waitFor();confirmDelete=true;await page.getByRole('button',{name:'删除行程',exact:true}).click();
  assert.equal(await homeCard().count(),0);assert.equal(await page.evaluate(()=>screen),'home');
  await page.reload();assert.equal(await homeCard().count(),0);assert.equal(await page.evaluate(()=>data.trips.length),fixture.trips.length-1);
  assert.deepEqual(errors,[]);console.log('PASS: grouped amount focus; larger segment controls; free walking and fare restoration; short tap; mouse/touch long press; cancel/delete; scroll cancellation; persistent list deletion.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
