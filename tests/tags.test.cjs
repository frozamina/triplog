const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),url='file:///'+path.join(root,'app/src/main/assets/index.html').replaceAll('\\','/');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXE?{executablePath:process.env.BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:790},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url);const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/design.json'),'utf8'));
  fixture.templates=[{...structuredClone(fixture.trips[0]),id:'tag-template',tags:['模板标签']}];
  await page.evaluate(v=>{data=v;localStorage.setItem('triplog-preview',JSON.stringify(v));screen='mine';render();actions.tags()},fixture);
  const managementTags=await page.locator('.tag-list [data-action="tagEdit"]').evaluateAll(els=>els.map(e=>e.dataset.value));
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.getByRole('button',{name:'行程',exact:true}).click();await page.locator('.trip[data-value="design-detail"]').click();
  await page.getByRole('button',{name:'编辑高铁',exact:true}).click();
  assert.equal(await page.locator('#extra-mode').evaluate(el=>el.nextElementSibling.htmlFor),'extra-distance_km');assert.equal(await page.locator('#extra-distance_km').evaluate(el=>el.nextElementSibling.dataset.tagField),'extra-tags');
  const mode=await page.locator('#extra-mode').boundingBox(),tagField=await page.locator('[data-tag-field="extra-tags"]').boundingBox(),carrier=await page.locator('#extra-carrier').boundingBox();
  assert(tagField.y>=mode.y+mode.height&&tagField.y<carrier.y);
  await page.locator('#extra-carrier').fill('G88');
  assert.equal(await page.locator('#extra-tags-options').isVisible(),false);
  await page.locator('#extra-tags-trigger').click();
  assert.deepEqual(await page.locator('#extra-tags-options .tag-choice').allTextContents(),managementTags);
  const choice=name=>page.locator('#extra-tags-options').getByRole('button',{name,exact:true});
  assert.equal(await choice('晚点').getAttribute('aria-pressed'),'true');await choice('晚点').click();
  await choice('堵车').click();await choice('无座').click();
  assert.equal(await choice('堵车').getAttribute('aria-pressed'),'true');assert.equal(await choice('无座').getAttribute('aria-pressed'),'true');
  await page.locator('#extra-tags-custom').fill('顺利换乘');await page.locator('#extra-tags-options').getByRole('button',{name:'添加',exact:true}).click();
  assert.equal(await page.locator('#extra-carrier').inputValue(),'G88');
  const out=path.join(root,'app/build/tag-verification');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'tag-picker.png')});
  await page.getByRole('button',{name:'保存补充信息',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).click();assert.equal(await page.evaluate(()=>currentTrip().status),'done');
  assert.deepEqual(await page.evaluate(()=>currentTrip().legs.find(s=>s.id==='rail').tags),['堵车','无座','顺利换乘']);
  assert.equal(await page.locator('.segment-tags').getByText('顺利换乘',{exact:true}).count(),1);
  await page.reload();await page.locator('.trip[data-value="design-detail"]').click();
  assert.equal(await page.locator('.segment-tags').getByText('顺利换乘',{exact:true}).count(),1);
  // Whole-trip tags can be selected and saved directly from the detail header.
  await page.getByRole('button',{name:'选择行程标签',exact:true}).click();
  await page.locator('#detail-tags-options').getByRole('button',{name:'天气影响',exact:true}).click();
  await page.getByRole('button',{name:'保存标签',exact:true}).click();
  assert.equal(await page.locator('.detail-tags').getByRole('button',{name:'天气影响',exact:true}).count(),1);
  // Transfer tags use the same picker and remain visible in the timeline.
  await page.getByRole('button',{name:'编辑换乘等待',exact:true}).first().click();
  await page.locator('#wait-tags-trigger').click();await page.locator('#wait-tags-options').getByRole('button',{name:'安检排队',exact:true}).click();
  await page.getByRole('button',{name:'保存换乘',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
  assert.equal(await page.locator('.segment-tags').getByText('安检排队',{exact:true}).count(),1);
  await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByRole('button',{name:'我的',exact:true}).click();
  await page.getByRole('button',{name:/标签管理/}).click();
  assert.equal(await page.locator('[data-action="tagEdit"][data-value="顺利换乘"]').innerText(),'顺利换乘1');
  assert.equal(await page.locator('[data-action="tagEdit"][data-value="安检排队"]').innerText(),'安检排队1');
  assert.deepEqual(errors,[]);console.log('PASS: shared management/picker catalog; tag row below mode; multi-select/deselect; custom labels; other fields preserved; leg/trip/transfer persistence and detail display; counts.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
