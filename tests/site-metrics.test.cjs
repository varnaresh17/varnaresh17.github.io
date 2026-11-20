const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scholar=require('../scholar.js');
test('Scholar links accept only the expected HTTPS Google Scholar paths',()=>{
  assert.ok(scholar.safeLink('https://scholar.google.com/scholar?cites=1'));
  for(const url of ['javascript:alert(1)','https://scholar.google.com.evil.example/scholar','http://scholar.google.com/scholar','https://scholar.google.com@evil.example/citations','https://scholar.google.com/evil'])assert.equal(scholar.safeLink(url),null);
  assert.equal(scholar.validCount(0),true);assert.equal(scholar.validCount(null),false);
});
function analytics(host='varnaresh17.github.io',framed=false){
  const appended=[],events={},sent=[];
  const context={location:{hostname:host,pathname:'/publications.html',origin:'https://varnaresh17.github.io'},document:{referrer:'https://example.com/path?private=1#secret',head:{append:s=>appended.push(s)},createElement:()=>({dataset:{}}),addEventListener:(name,fn)=>events[name]=fn},URL};
  context.window=context;context.self=context;context.top=framed?{}:context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../site-analytics.js'),'utf8'),context);
  if(context.goatcounter)context.goatcounter.count=e=>sent.push(e);
  return {context,appended,events,sent};
}
test('Analytics stays off preview hosts and editor iframes',()=>{
  assert.equal(analytics('localhost').appended.length,0);assert.equal(analytics('preview.example').appended.length,0);assert.equal(analytics('varnaresh17.github.io',true).appended.length,0);
});
test('Analytics strips query data and sends only named actions',()=>{
  const a=analytics();assert.equal(a.appended.length,1);assert.equal(a.appended[0].dataset.goatcounter,'https://varnaresh17.goatcounter.com/count');
  assert.equal(a.context.goatcounter.path(),'/publications.html');assert.equal(a.context.goatcounter.referrer(),'https://example.com/path');
  a.events.submit({target:{id:'bragg-form',value:'private experimental spectrum'}});
  assert.equal(a.sent[0].path,'xrd-bragg-calculate');assert.equal(a.sent[0].event,true);assert.ok(!JSON.stringify(a.sent).includes('private'));
});
test('Tracking and Scholar assets are installed once on their intended pages',()=>{
  let pages=0;for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');if(html.includes('site-navigation.js?')){pages++;assert.equal((html.match(/src="site-analytics.js/g)||[]).length,1);}else assert.ok(!html.includes('src="site-analytics.js'));}
  assert.equal(pages,16);
  const html=fs.readFileSync('publications.html','utf8');assert.ok(html.includes('id="scholar-impact"'));assert.ok(html.includes('scholar.js?'));assert.ok(html.includes('scholar.css?'));
});
test('Public pages cannot display or fetch aggregate visitor totals',()=>{
  for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');if(!html.includes('site-navigation.js?'))continue;
    assert.ok(!html.includes('data-visitor-total'));assert.ok(!html.includes('site-visit-counter'));assert.ok(!html.includes('visitor-counter.js'));
  }
  const retired=fs.readFileSync('visitor-counter.js','utf8');assert.ok(!retired.includes('fetch('));assert.ok(!retired.includes('counter/TOTAL'));
  const editor=fs.readFileSync('editor.html','utf8');assert.ok(editor.includes('Visitor statistics'));assert.ok(editor.includes('https://varnaresh17.goatcounter.com/'));assert.ok(editor.includes('id="show-statistics"'));assert.ok(editor.includes('id="statistics-api-key"'));
});
