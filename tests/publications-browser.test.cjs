'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {matches}=require('../publications-browser.js');
const data=JSON.parse(fs.readFileSync(require.resolve('../publications.json'),'utf8'));
const records=[...data.papers,...data.contributions].map(r=>({...r,topics:r.tags,search:[r.title,r.citation,r.authors,r.venue,r.year].join(' ')}));
test('Published results contain all 39 articles and 8 proceedings, without activities',()=>{
 assert.equal(records.length,47);assert.equal(new Set(records.map(r=>r.id)).size,47);
 assert.ok(records.every(r=>['journal','proceeding'].includes(r.type)));
 assert.equal(data.presentations.length,17);assert.equal(data.workshops.length,3);
});
test('Topic counts reflect the actual bibliography and every publication has a valid tag',()=>{
 const tags=new Set(data.publicationTopics.map(t=>t.id));
 for(const r of records){assert.ok(r.topics.length);assert.ok(r.topics.every(t=>tags.has(t)));}
 assert.deepEqual(records.filter(r=>matches(r,{topic:'npls'})).map(r=>r.id),['p02','p05']);
 assert.equal(records.filter(r=>matches(r,{topic:'glasses'})).length,25);
});
test('Topic, publication type and case-insensitive search combine correctly',()=>{
 assert.equal(records.filter(r=>matches(r,{topic:'glasses',type:'proceeding'})).length,8);
 assert.equal(records.filter(r=>matches(r,{topic:'npls',type:'proceeding'})).length,0);
 assert.deepEqual(records.filter(r=>matches(r,{topic:'npls',type:'journal',q:'DUAL ligand 2025'})).map(r=>r.id),['p02']);
 assert.equal(records.filter(r=>matches(r,{q:'not-a-real-material'})).length,0);
});
