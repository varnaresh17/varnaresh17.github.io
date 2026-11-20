const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const core=require('../owner-analytics.js');
const totals={total:17,total_events:5,stats:[{day:'2026-11-20',daily:10},{day:'2026-11-19',daily:7}]};
const okay=data=>({ok:true,status:200,json:async()=>data});
test('page counts exclude actions, daily activity includes both, missing counts are not zero',()=>{
 const r=core.normalize(totals,{hits:[{count:12,path:'/research.html',title:'Research',event:false},{count:5,path:'xrd-bragg-calculate',event:true}],more:true},{stats:[{name:'US',count:8}]},{stats:[]},{stats:[]});
 assert.equal(r.visits,12);assert.equal(r.actions,5);assert.equal(r.activity,17);assert.deepEqual(r.daily.map(x=>x.count),[7,10]);assert.equal(r.pages.length,1);assert.equal(r.events.length,1);assert.equal(r.more,true);assert.deepEqual(r.locations,[{name:'US',count:8}]);
 for(const invalid of [null,{}, {total:1,total_events:2},{total:-1,total_events:0},{total:'5',total_events:0}])assert.throws(()=>core.normalize(invalid));
 assert.equal(core.normalize({total:0,total_events:0}).visits,0);assert.equal(core.normalize(totals,{},null).locations,null);
});
test('only aggregate, whitelisted fields are retained',()=>{
 const r=core.normalize(totals,{hits:[{count:2,title:'<img src=x onerror=alert(1)>',email:'private@example.com',ip:'1.2.3.4'}]},{stats:[{name:'<script>x</script>',count:1,email:'private@example.com'}]});
 assert.ok(!JSON.stringify(r).includes('private@example.com'));assert.ok(!JSON.stringify(r).includes('1.2.3.4'));assert.equal(r.pages[0].name,'<img src=x onerror=alert(1)>');
 const js=fs.readFileSync('owner-analytics.js','utf8');assert.ok(!js.includes('innerHTML'));assert.ok(js.includes('textContent=text'));
});
test('UTC ranges are inclusive of chosen end date and validate real dates and bounds',()=>{
 assert.deepEqual(core.preset(7,new Date('2026-11-20T12:00:00Z')),{start:'2026-11-14',end:'2026-11-20'});
 assert.equal(core.range('2024-02-29','2024-02-29').end,'2024-03-01T00:00:00.000Z');
 for(const args of [['2026-02-29','2026-03-01'],['2026-11-20','2026-11-19'],['2025-01-01','2026-11-20'],['junk','2026-11-20']])assert.throws(()=>core.range(...args));
});
test('API key travels only in Authorization to fixed HTTPS read endpoints',async()=>{
 const calls=[],key='test-key-never-store';
 const client=core.createClient(key,async(url,options)=>{calls.push({url,options});return okay(totals);},async()=>{},()=>1000);
 await client.get('stats/total',{start:'2026-11-20T00:00:00Z',secret:key,redirect:'https://evil.example'});
 const {url,options}=calls[0];assert.equal(new URL(url).origin,'https://varnaresh17.goatcounter.com');assert.ok(!url.includes(key));assert.ok(!url.includes('evil'));assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
 for(const path of ['sites/1','https://evil.example/','../count','count'])await assert.rejects(client.get(path,{}),e=>e.status===403);
 client.clear();await assert.rejects(client.get('stats/hits',{}),e=>e.status===401);assert.equal(calls.length,1);
});
test('authorization failures are sanitized and do not parse private response text',async()=>{
 for(const status of [401,403]){let read=false;const c=core.createClient('test-key',async()=>({ok:false,status,json:async()=>{read=true;return {error:'secret key'};}}),async()=>{});await assert.rejects(c.get('stats/total',{}),e=>e.status===status&&!core.message(e).includes('secret key'));assert.equal(read,false);}
});
test('rate limiting has one bounded retry and no uncontrolled loop',async()=>{
 let calls=0;const waits=[];const c=core.createClient('test-key',async()=>{calls++;return {ok:false,status:429,headers:{get:()=>999}};},async ms=>waits.push(ms),()=>1000);
 await assert.rejects(c.get('stats/total',{}),e=>e.status===429);assert.equal(calls,2);assert.ok(waits.includes(5000));
});
test('timeouts and caller cancellation terminate pending reads',async()=>{
 const pending=async(url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
 const c=core.createClient('test-key',pending,async()=>{},()=>1000,10);
 await assert.rejects(c.get('stats/total',{}),e=>e.status===408);
 const controller=new AbortController(),promise=c.get('stats/total',{},controller.signal);setTimeout(()=>controller.abort(),1);await assert.rejects(promise,e=>e.name==='AbortError');
});
test('dashboard is authenticated on the site and editor, with no public snapshots or query secrets',()=>{
 const js=fs.readFileSync('owner-analytics.js','utf8'),editor=fs.readFileSync('editor.html','utf8');
 for(const forbidden of ['sessionStorage','document.cookie','counter/TOTAL','console.log'])assert.ok(!js.includes(forbidden));
 assert.ok(editor.includes("https://raw.githubusercontent.com https://varnaresh17.goatcounter.com;"));assert.ok(editor.includes('type="password" autocomplete="off"'));assert.ok(editor.includes('sandbox="allow-scripts"'));assert.ok(editor.includes('id="statistics-remember" type="checkbox"'));
 const page=fs.readFileSync('statistics.html','utf8');assert.ok(page.includes('data-statistics-page'));assert.ok(page.includes('class="statistics-dialog statistics-page"'));assert.ok(page.includes('noindex,nofollow'));assert.ok(!page.includes('site-analytics.js'));assert.ok(!fs.readFileSync('sitemap.xml','utf8').includes('statistics.html'));
 for(const f of require('../editor-core.js').PAGES)assert.ok(fs.readFileSync(f,'utf8').includes('href="statistics.html"'));
 assert.ok(!require('../editor-core.js').allowedPath('statistics.html'));
 for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html')&&!['editor.html','statistics.html'].includes(f)))assert.ok(!fs.readFileSync(file,'utf8').includes('owner-analytics.js'));
});

function device(clock=()=>1000){const values=new Map();return {values,store:core.createDeviceStore({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},clock)};}
test('remember storage is empty by default and saves only a read key and expiry when asked',()=>{
 const {store,values}=device();assert.equal(store.read(),null);assert.equal(values.size,0);
 assert.equal(store.save('fixture-only'),true);const entry=JSON.parse(values.get(core.DEVICE_KEY));assert.deepEqual(Object.keys(entry).sort(),['expires','token']);assert.equal(entry.expires,1000+30*86400000);assert.equal(store.read(),'fixture-only');store.clear();assert.equal(store.read(),null);
});
test('expired, malformed and invalid device keys are removed',()=>{
 let now=1000;const {store,values}=device(()=>now);store.save('fixture-only');now+=30*86400000;assert.equal(store.read(),null);assert.equal(values.size,0);
 for(const value of ['bad json','null',JSON.stringify({token:'bad',expires:now+1000}),JSON.stringify({token:'fixture-only',expires:now+40*86400000})]){values.set(core.DEVICE_KEY,value);assert.equal(store.read(),null);assert.equal(values.size,0);}
 assert.equal(store.save('bad key'),false);
});
test('blocked browser storage does not break session-only access',()=>{
 const store=core.createDeviceStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});assert.equal(store.read(),null);assert.equal(store.save('fixture-only'),false);assert.equal(store.clear(),false);
});
