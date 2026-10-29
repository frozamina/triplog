const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),url='file:///'+path.join(root,'app/src/main/assets/index.html').replaceAll('\\','/');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXE?{executablePath:process.env.BROWSER_EXE}:{})});
 try{const page=await browser.newPage({viewport:{width:390,height:790},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),errors=[];let accept=true;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>accept?d.accept():d.dismiss());
 await page.goto(url);const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/design.json'),'utf8'));
 await page.evaluate(v=>{data=v;localStorage.setItem('triplog-preview',JSON.stringify(v));screen='home';render()},fixture);
 assert.equal(await page.locator('.trip[data-value="design-detail"] .trip-distance').innerText(),'480 km');
 await page.locator('.trip[data-value="design-detail"]').click();
 assert.equal(await page.locator('.metrics>div').count(),4);assert.equal(await page.locator('.metrics>div').last().innerText(),'480\n总里程 km');
 assert.deepEqual(await page.locator('.leg-distance').allTextContents(),['10 km','450 km','9 站','1 km']);
 await page.getByRole('button',{name:'编辑高铁',exact:true}).click();
 assert.equal(await page.locator('#extra-seat').count(),0);assert.equal(await page.getByRole('button',{name:/上移|下移/}).count(),0);
 assert.equal(await page.locator('#extra-mode').evaluate(e=>e.nextElementSibling.htmlFor),'extra-distance_km');
 await page.locator('#extra-distance_km').fill('451.5');await page.getByRole('button',{name:'保存补充信息',exact:true}).click();
 const rail=()=>page.locator('[data-segment-id="rail"]');assert.equal(await rail().locator('.segment-tags').getByText('晚点',{exact:true}).count(),1);
 assert.equal(await rail().locator('.editor-leg-distance').innerText(),'451.5 km');assert.equal(await page.evaluate(()=>draft.legs.find(s=>s.id==='rail').seat),'05车 12A');
 const out=path.join(root,'app/build/segment-verification');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'editor-segment-tags.png')});
 // Native-like touch hold on a card opens deletion without entering its note sheet.
 const bounds=await rail().locator('.editor-segment-meta').boundingBox();const cdp=await page.context().newCDPSession(page);
 async function hold(){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width-20,y:bounds.y+8}]});await page.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
 await hold();await page.getByRole('button',{name:'删除本段',exact:true}).waitFor();await page.screenshot({path:path.join(out,'delete-segment.png')});
 accept=false;await page.getByRole('button',{name:'删除本段',exact:true}).click();assert.equal(await rail().count(),1);await page.getByRole('button',{name:'关闭',exact:true}).click();
 await hold();accept=true;await page.getByRole('button',{name:'删除本段',exact:true}).click();assert.equal(await rail().count(),0);
 assert.equal(await page.evaluate(()=>currentTrip().legs.some(s=>s.id==='rail')),true,'not persisted until save');
 // Removing a leg preserves other edits and keeps the remaining sequence ordered.
 assert.deepEqual(await page.evaluate(()=>Core.timeline(draft).map(s=>s.seq)),[0,1,2,3,4,5]);
 await page.getByRole('button',{name:'保存',exact:true}).click();assert.equal(await page.evaluate(()=>currentTrip().legs.some(s=>s.id==='rail')),false);
 await page.reload();await page.locator('.trip[data-value="design-detail"]').click();assert.equal(await page.evaluate(()=>currentTrip().legs.length),3);
 assert.deepEqual(errors,[]);console.log('PASS: list/summary/leg mileage, note field ordering, retained old seat data, visible editor tags, touch segment deletion/cancel and saved sequence.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


