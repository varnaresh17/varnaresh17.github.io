const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const c=require('../calculator-feedback.js');
const scope='xrd-bragg',text='Please clarify whether the angle field accepts theta or two theta.';
const generated=c.compose(scope,'Suggestion',text);
function issue(overrides={}){return {number:21,title:generated.title,body:generated.body,user:{login:'reader'},created_at:'2026-11-21T12:00:00Z',state:'open',comments:2,...overrides};}
test('feedback contains only deliberate comment and fixed calculator context',()=>{
 const u=new URL(generated.url);assert.equal(u.origin,'https://github.com');assert.equal(u.pathname,'/varnaresh17/varnaresh17.github.io/issues/new');assert.equal(u.searchParams.get('body'),generated.body);assert.ok(generated.body.includes(text));assert.ok(generated.body.includes('xrd.html#bragg-title'));assert.deepEqual([...u.searchParams.keys()].sort(),['body','title']);
 for(const [id,info] of Object.entries(c.SCOPES)){const v=c.compose(id,'Calculation concern','A clear explanation of this result would be useful.');assert.ok(v.body.includes(info.name));assert.ok(v.body.includes(info.page+'#'+info.anchor));}
});
test('unknown contexts, types and invalid comments cannot generate feedback URLs',()=>{
 for(const args of [['__proto__','Suggestion',text],['https://evil.example','Suggestion',text],[scope,'admin',text],[scope,'Suggestion','short'],[scope,'Suggestion','x'.repeat(1001)]])assert.throws(()=>c.compose(...args));
 assert.throws(()=>c.compose(scope,'Suggestion','測'.repeat(1000))); // Prevent a URL over the bound after percent-encoding.
});
test('public feedback is isolated by calculator and links stay inside its repository',()=>{
 const normalized=c.normalizeIssue(issue({html_url:'javascript:alert(1)'}),scope);assert.equal(normalized.url,'https://github.com/varnaresh17/varnaresh17.github.io/issues/21');assert.equal(normalized.body,text);assert.equal(normalized.replies,2);
 assert.equal(c.normalizeIssue(issue(), 'ftir-data'),null);assert.equal(c.normalizeIssue(issue({pull_request:{}}),scope),null);assert.equal(c.normalizeIssue(issue({number:-1}),scope),null);assert.equal(c.normalizeIssue(issue({body:'Unrelated report'}),scope),null);assert.equal(c.normalizeIssue(issue({created_at:'invalid'}),scope),null);
 const data=c.normalizeSearch({total_count:2,items:[issue(),issue({body:'Something else'})]},scope);assert.equal(data.items.length,1);assert.throws(()=>c.normalizeSearch({items:[]},scope));
});
test('untrusted text is never interpreted as HTML and reply URLs are fixed',()=>{
 const bad='<img src=x onerror=alert(1)>';const entry=c.compose(scope,'Suggestion',bad);assert.equal(c.normalizeIssue(issue({body:entry.body}),scope).body,bad);
 const rows=c.normalizeReplies([{id:9,body:bad,created_at:'2026-11-21T12:00:00Z',user:{login:'reader'},html_url:'https://evil.example'}],21);assert.equal(rows[0].body,bad);assert.equal(rows[0].url,'https://github.com/varnaresh17/varnaresh17.github.io/issues/21#issuecomment-9');
 assert.ok(!fs.readFileSync('calculator-feedback.js','utf8').includes('innerHTML'));
});
test('comment loading is anonymous, read-only and scoped, with a short in-memory cache',async()=>{
 const requests=[];const client=c.createClient(async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({total_count:1,items:[issue()]})};});
 assert.equal((await client.comments(scope)).items.length,1);await client.comments(scope);assert.equal(requests.length,1);await client.comments(scope,true);assert.equal(requests.length,2);
 const {url,options}=requests[0];assert.equal(new URL(url).origin,'https://api.github.com');assert.ok(new URL(url).searchParams.get('q').includes('repo:varnaresh17/varnaresh17.github.io'));assert.ok(new URL(url).searchParams.get('q').includes(scope));assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,undefined);assert.equal(options.body,undefined);
 await assert.rejects(client.replies('https://evil.example'));await assert.rejects(client.comments('__proto__'));
});
test('API failures and request timeouts are visible failures, never invented empty data',async()=>{
 for(const status of [403,429,404,500]){const client=c.createClient(async()=>({ok:false,status}));await assert.rejects(client.comments(scope),e=>e.status===status);}
 const pending=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));const client=c.createClient(pending,10);await assert.rejects(client.comments(scope),e=>e.status===0);
});
test('all fourteen sections are on the intended four tool pages only',()=>{
 let total=0;for(const file of ['xrd.html','ftir.html','colorimetry.html','plqy.html']){const s=fs.readFileSync(file,'utf8');assert.equal((s.match(/src="calculator-feedback.js/g)||[]).length,1);for(const match of s.matchAll(/data-feedback-scope="([^"]+)"/g)){assert.ok(c.SCOPES[match[1]]);assert.equal(c.SCOPES[match[1]].page,file);total++;}}
 assert.equal(total,14);const js=fs.readFileSync('calculator-feedback.js','utf8');for(const word of ['localStorage','sessionStorage','api-key','goatcounter','github-token','data.csv','addEventListener(\'input\''])assert.ok(!js.includes(word));assert.ok(js.includes('Your comment has not been posted yet.'));
});

test('Contact feedback stays separate from calculator reports and is available in the editable Contact page',()=>{
 const scope='website-general',entry=c.compose(scope,'Suggestion','Please add a clearer overview of research collaborations.');assert.ok(entry.title.startsWith('[Website feedback]'));assert.ok(entry.body.includes('contact.html#website-feedback'));assert.ok(!entry.body.includes('Calculator:'));assert.ok(c.searchQuery(scope).includes('Website feedback'));
 const row=issue({title:entry.title,body:entry.body});assert.equal(c.normalizeIssue(row,scope).body,'Please add a clearer overview of research collaborations.');assert.equal(c.normalizeIssue(row,'xrd-bragg'),null);
 const html=fs.readFileSync('contact.html','utf8');assert.equal((html.match(/data-feedback-scope=/g)||[]).length,1);assert.ok(html.includes('id="website-feedback"'));assert.ok(html.includes('class="contact-feedback-jump"'));assert.ok(html.includes('mailto:varna.naresh@gmail.com'));assert.ok(require('../editor-core.js').PAGES.includes('contact.html'));
});
