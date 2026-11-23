/* Owner analytics: authenticated reads; optional device key storage requires explicit opt-in. */
(function(root){
  'use strict';
  const API='https://varnaresh17.goatcounter.com/api/v0/';
  const isCount=value=>Number.isSafeInteger(value)&&value>=0;
  const count=value=>isCount(value)?value:null;
  class StatsError extends Error{constructor(status){super('Statistics request failed');this.status=status;}}
  function message(error){
    if(error.status===401)return 'The API key was not accepted. Check it and try again.';
    if(error.status===403)return 'This key cannot read statistics for this site. Use a key with read-statistics permission.';
    if(error.status===429)return 'The statistics service is busy. Wait a moment, then refresh.';
    if(error.status===408)return 'The statistics request timed out. Check your connection, then refresh.';
    if(error.status===400)return 'The date range was not accepted. Check the dates and try again.';
    return 'Statistics could not be loaded. Check your connection or browser blocking, then try again.';
  }
  function utcDay(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Choose valid dates.');
    const date=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('Choose valid dates.');
    return date;
  }
  function range(start,end){
    const a=utcDay(start),b=utcDay(end),days=(b-a)/86400000+1;
    if(days<1||days>366)throw new Error('Choose a date range of 1 to 366 days, with the start before the end.');
    return {start:a.toISOString(),end:new Date(b.getTime()+86400000).toISOString(),label:start+' to '+end+' · UTC'};
  }
  function preset(days,now=new Date()){
    if(![1,7,30,90,365].includes(days))throw new Error('Invalid period');
    const end=now.toISOString().slice(0,10),last=utcDay(end);
    return {start:new Date(last.getTime()-(days-1)*86400000).toISOString().slice(0,10),end};
  }
  const COUNTRY_PAGE_LIMIT=100,COUNTRY_MAX_PAGES=10;
  let regionNames;
  try{regionNames=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'});}catch{}
  function countryRows(data){
    if(data===null)return null;
    const rows=new Map();
    for(const row of Array.isArray(data?.stats)?data.stats:[]){
      if(!row||!isCount(row.count)||row.count===0)continue;
      const raw=String(row.name||'').trim().slice(0,300),id=String(row.id||raw).trim().toUpperCase();
      let code=/^[A-Z]{2}$/.test(id)?(id==='UK'?'GB':id):'',name=raw;
      if(['ZZ','XX'].includes(code))code='';
      if(code){try{name=regionNames?.of(code)||raw||code;}catch{name=raw||code;}}
      if(!code&&(!name||/^(unknown|not supplied|\(unknown\)|\(no data\)|zz|xx)$/i.test(name)))name='Unknown location';
      const key=code||name.toLowerCase(),previous=rows.get(key);
      // Repeated rows during a paginated refresh must not inflate counts.
      if(!previous||previous.count<row.count)rows.set(key,{name:name||'Unknown location',code,count:row.count});
    }
    return Array.from(rows.values()).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'en'));
  }
  async function loadCountries(client,parameters,signal){
    const stats=[],seen=new Set();
    for(let page=0;page<COUNTRY_MAX_PAGES;page++){
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      const result=await client.get('stats/locations',{...parameters,limit:COUNTRY_PAGE_LIMIT,offset:page*COUNTRY_PAGE_LIMIT},signal);
      if(!result||!Array.isArray(result.stats)||(result.more!==undefined&&typeof result.more!=='boolean'))throw new StatsError(502);
      const signature=JSON.stringify(result.stats);
      if(result.more&&(!result.stats.length||seen.has(signature)))throw new StatsError(502);
      seen.add(signature);stats.push(...result.stats);
      if(!result.more)return {stats,more:false};
    }
    // Never silently present an incomplete list as all countries.
    throw new StatsError(502);
  }
  function countryView(rows,{query='',sort='count',page=1,pageSize=25}={}){
    rows=Array.isArray(rows)?rows:[];
    const total=rows.reduce((sum,row)=>sum+row.count,0),q=String(query).trim().toLowerCase();
    const filtered=rows.filter(row=>(row.name+' '+row.code+(row.code==='GB'?' UK':'')).toLowerCase().includes(q)).slice();
    filtered.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'en'):sort==='least'?(a,b)=>a.count-b.count||a.name.localeCompare(b.name,'en'):(a,b)=>b.count-a.count||a.name.localeCompare(b.name,'en'));
    const size=[10,25,50,1000].includes(Number(pageSize))?Number(pageSize):25,pages=Math.max(1,Math.ceil(filtered.length/size));
    page=Math.min(pages,Math.max(1,Number.isSafeInteger(page)?page:1));
    return {rows:filtered.slice((page-1)*size,page*size),filtered,total,page,pages,size,countries:rows.filter(row=>row.name!=='Unknown location').length};
  }
  function countryCSV(rows){
    const total=rows.reduce((sum,row)=>sum+row.count,0);
    const cell=value=>{let text=String(value);if(/^[=+\-@\t\r\n]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    return '\uFEFF'+[['Country','Country code','Count','Share of country counts (%)'],...rows.map(row=>[row.name,row.code,row.count,total?(100*row.count/total).toFixed(2):'0.00'])].map(row=>row.map(cell).join(',')).join('\r\n');
  }
  function normalize(totals,hits,locations,referrers,browsers){
    if(!totals||!isCount(totals.total)||!isCount(totals.total_events)||totals.total_events>totals.total)throw new StatsError(502);
    const rows=(Array.isArray(hits?.hits)?hits.hits:[]).filter(row=>row&&isCount(row.count));
    const statsRows=data=>data===null?null:(Array.isArray(data?.stats)?data.stats:[]).filter(row=>row&&isCount(row.count)).map(row=>({name:String(row.name||'Not supplied').slice(0,300),count:row.count}));
    const daily=(Array.isArray(totals.stats)?totals.stats:[]).filter(row=>row&&/^\d{4}-\d{2}-\d{2}$/.test(row.day)&&isCount(row.daily)).map(row=>({day:row.day,count:row.daily})).sort((a,b)=>a.day.localeCompare(b.day));
    return {
      visits:totals.total-totals.total_events,actions:totals.total_events,activity:totals.total,daily,
      pages:rows.filter(row=>!row.event).map(row=>({name:String(row.title||row.path||'Page').slice(0,500),path:String(row.path||'').slice(0,500),count:row.count})),
      events:rows.filter(row=>row.event).map(row=>({name:String(row.title||row.path||'Action').slice(0,500),count:row.count})),
      locations:countryRows(locations),referrers:statsRows(referrers),browsers:statsRows(browsers),more:!!hits?.more
    };
  }
  function delay(ms,signal){return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
    const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
    const timer=setTimeout(done,ms);
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
  });}
  // Only these read-only requests can be made. The destination cannot be supplied by a page or caller.
  function createClient(token,fetcher,wait=delay,clock=()=>Date.now(),timeoutMs=15000){
    let key=token,last=0;
    const allowed=new Set(['stats/total','stats/hits','stats/locations','stats/toprefs','stats/browsers']);
    return {
      clear(){key='';},
      async get(path,parameters,signal){
        if(!allowed.has(path))throw new StatsError(403);
        if(!key)throw new StatsError(401);
        if(parameters.offset!==undefined&&(!Number.isSafeInteger(parameters.offset)||parameters.offset<0))throw new StatsError(400);
        const url=new URL(path,API);
        for(const [name,value] of Object.entries(parameters))if(['start','end','limit','offset','group'].includes(name))url.searchParams.set(name,String(value));
        for(let attempt=0;attempt<2;attempt++){
          await wait(Math.max(0,350-(clock()-last)),signal);last=clock();
          if(!key||signal?.aborted)throw new DOMException('Aborted','AbortError');
          const request=new AbortController(),abort=()=>request.abort();
          signal?.addEventListener('abort',abort,{once:true});
          const timer=setTimeout(()=>request.abort(),timeoutMs);
          let retryAfter=null;
          try{
            const response=await fetcher(url.href,{method:'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:request.signal});
            if(response.status===429&&attempt===0){
              const retry=Number(response.headers?.get('Retry-After'));
              retryAfter=Math.min(5000,Math.max(1000,Number.isFinite(retry)?retry*1000:1000));
            }else{
              if(!response.ok)throw new StatsError(response.status);
              try{return await response.json();}catch(error){if(request.signal.aborted)throw error;throw new StatsError(502);}
            }
          }catch(error){
            if(signal?.aborted)throw new DOMException('Aborted','AbortError');
            if(request.signal.aborted)throw new StatsError(408);
            throw error instanceof StatsError?error:new StatsError(0);
          }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
          if(retryAfter!==null)await wait(retryAfter,signal);
        }
        throw new StatsError(429);
      }
    };
  }
  const DEVICE_KEY='nv.ownerAnalytics.device.v1',DEVICE_TTL=30*86400000;
  const validKey=key=>typeof key==='string'&&key.length>=10&&key.length<=512&&!/\s/.test(key);
  function createDeviceStore(storage,clock=()=>Date.now()){
    return {
      read(){
        try{
          const entry=JSON.parse(storage.getItem(DEVICE_KEY)||'null'),now=clock();
          if(entry&&validKey(entry.token)&&Number.isFinite(entry.expires)&&entry.expires>now&&entry.expires<=now+DEVICE_TTL)return entry.token;
          storage.removeItem(DEVICE_KEY);
        }catch{try{storage.removeItem(DEVICE_KEY);}catch{}}
        return null;
      },
      save(token){try{if(!validKey(token))return false;storage.setItem(DEVICE_KEY,JSON.stringify({token,expires:clock()+DEVICE_TTL}));return true;}catch{return false;}},
      clear(){try{storage.removeItem(DEVICE_KEY);return true;}catch{return false;}}
    };
  }
  const core={range,preset,normalize,countryRows,loadCountries,countryView,countryCSV,createClient,message,StatsError,createDeviceStore,validKey,DEVICE_KEY};
  if(typeof module==='object'&&module.exports)module.exports=core;
  if(!root.document)return;
  const doc=root.document,$=id=>doc.getElementById(id),dialog=$('statistics-dialog');if(!dialog)return;
  let client=null,controller=null,run=0,busy=false,pendingRemember=null,countries=null,countryPage=1;
  // Access storage lazily; blocked storage must not prevent one-session authentication.
  const device=createDeviceStore({getItem:key=>root.localStorage.getItem(key),setItem:(key,value)=>root.localStorage.setItem(key,value),removeItem:key=>root.localStorage.removeItem(key)});
  const standalone=dialog.hasAttribute('data-statistics-page');
  function setStatus(text,error=false){$('statistics-status').textContent=text;$('statistics-status').classList.toggle('error',error);}
  function clearData(){
    for(const el of dialog.querySelectorAll('[data-stat-value]'))el.textContent='—';
    for(const el of dialog.querySelectorAll('[data-stat-rows]'))el.replaceChildren();
    countries=null;countryPage=1;$('statistics-country-search').value='';$('statistics-country-summary').textContent='';$('statistics-country-showing').textContent='';$('statistics-country-pagination').hidden=true;$('statistics-country-export').disabled=true;
    $('statistics-device-status').textContent='';$('statistics-updated').textContent='';$('statistics-range-label').textContent='';$('statistics-more').hidden=true;
  }
  function lock(){
    run++;controller?.abort();controller=null;client?.clear();client=null;
    $('statistics-api-key').value='';$('statistics-connect').disabled=false;$('statistics-refresh').disabled=false;
    pendingRemember=null;$('statistics-remember').checked=false;busy=false;clearData();$('statistics-data').hidden=true;$('statistics-auth').hidden=false;setStatus('');
  }
  function element(tag,text,className){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function fillRows(id,rows){
    const body=$(id);body.replaceChildren();
    if(!rows||!rows.length){const tr=element('tr'),td=element('td',rows?'No recorded data for this period.':'Temporarily unavailable. Refresh to try again.','statistics-empty');td.colSpan=2;tr.append(td);body.append(tr);return;}
    for(const row of rows){const tr=element('tr'),name=element('td');name.append(element('span',row.name));if(row.path&&row.path!==row.name)name.append(element('small',row.path));tr.append(name,element('td',row.count.toLocaleString()));body.append(tr);}
  }
  function renderCountries(){
    const body=$('statistics-locations');body.replaceChildren();
    const view=countryView(countries,{query:$('statistics-country-search').value,sort:$('statistics-country-sort').value,page:countryPage,pageSize:$('statistics-country-size').value});countryPage=view.page;
    const unavailable=countries===null;
    $('statistics-country-summary').textContent=unavailable?'Country data is temporarily unavailable. Refresh to try again.':view.countries.toLocaleString()+' '+(view.countries===1?'country':'countries')+' recorded in this period · '+view.total.toLocaleString()+' total country counts';
    $('statistics-country-export').disabled=unavailable||!countries.length;
    if(!view.rows.length){const tr=element('tr'),td=element('td',unavailable?'Country data is unavailable.':countries.length?'No countries match your search.':'No country visits recorded for this period.','statistics-empty');td.colSpan=3;tr.append(td);body.append(tr);}
    for(const row of view.rows){
      const tr=element('tr'),country=element('td'),label=element('span',undefined,'statistics-country-name');
      if(row.code){const badge=element('span',row.code,'statistics-country-code');badge.setAttribute('aria-hidden','true');label.append(badge);}
      label.append(element('span',row.name));country.append(label);
      const percent=view.total?100*row.count/view.total:0,share=element('td'),bar=element('span',undefined,'statistics-country-track'),fill=element('span',undefined,'statistics-country-bar');bar.setAttribute('aria-hidden','true');fill.style.width=percent+'%';bar.append(fill);share.append(element('span',percent.toFixed(1)+'%'),bar);tr.append(country,element('td',row.count.toLocaleString()),share);body.append(tr);
    }
    const matches=view.filtered.length,start=matches?(view.page-1)*view.size+1:0,end=Math.min(view.page*view.size,matches);
    $('statistics-country-showing').textContent=unavailable?'':matches?'Showing '+start+'–'+end+' of '+matches+' matching locations. All recorded countries are loaded.':'';
    $('statistics-country-pagination').hidden=view.pages<=1;$('statistics-country-page').textContent='Page '+view.page+' of '+view.pages;$('statistics-country-previous').disabled=view.page<=1;$('statistics-country-next').disabled=view.page>=view.pages;
  }
  function render(data,period){
    for(const key of ['visits','actions','activity'])dialog.querySelector('[data-stat-value="'+key+'"]').textContent=data[key].toLocaleString();
    for(const key of ['pages','events','referrers','browsers'])fillRows('statistics-'+key,data[key]);
    countries=data.locations;countryPage=1;renderCountries();
    const chart=$('statistics-daily');chart.replaceChildren();
    const maximum=Math.max(1,...data.daily.map(row=>row.count));
    if(!data.daily.length)chart.append(element('p','No daily data returned for this period.','statistics-empty'));
    for(const row of data.daily){const line=element('div',undefined,'statistics-day');line.setAttribute('role','listitem');const track=element('span',undefined,'statistics-track'),bar=element('span',undefined,'statistics-bar');bar.style.width=(100*row.count/maximum)+'%';track.append(bar);line.append(element('span',row.day),track,element('strong',row.count.toLocaleString()));chart.append(line);}
    $('statistics-range-label').textContent=period.label;$('statistics-more').hidden=!data.more;
    $('statistics-updated').textContent='Loaded '+new Date().toLocaleString()+'. Date ranges and daily activity use UTC.';
    $('statistics-auth').hidden=true;$('statistics-data').hidden=false;
  }
  function choosePreset(){
    const value=$('statistics-period').value,custom=value==='custom';
    $('statistics-start').disabled=!custom;$('statistics-end').disabled=!custom;
    if(!custom){const dates=preset(Number(value));$('statistics-start').value=dates.start;$('statistics-end').value=dates.end;}
  }
  async function load(){
    if(!client||busy)return;
    let period;try{period=range($('statistics-start').value,$('statistics-end').value);}catch(error){setStatus(error.message,true);return;}
    const ticket=++run;busy=true;controller=new AbortController();const signal=controller.signal;
    $('statistics-connect').disabled=true;$('statistics-refresh').disabled=true;setStatus($('statistics-data').hidden?'Loading private statistics…':'Refreshing… Previous results remain visible until the new data loads.');
    try{
      const parameters={start:period.start,end:period.end};
      const totals=await client.get('stats/total',parameters,signal);
      const hits=await client.get('stats/hits',{...parameters,limit:100,group:'day'},signal);
      const optional=[];let missing=false;
      for(const path of ['stats/locations','stats/toprefs','stats/browsers']){
        try{optional.push(path==='stats/locations'?await loadCountries(client,parameters,signal):await client.get(path,{...parameters,limit:20},signal));}
        catch(error){if(error.name==='AbortError'||[401,403].includes(error.status))throw error;optional.push(null);missing=true;}
      }
      if(ticket!==run||signal.aborted)return;
      render(normalize(totals,hits,...optional),period);
      let storageFailed=false;
      if(pendingRemember){storageFailed=!device.save(pendingRemember);pendingRemember=null;}
      $('statistics-device-status').textContent=device.read()?'Remembered on this browser for up to 30 days. Use Forget this device to remove access.':'This session only. No API key is saved on this device.';
      setStatus(storageFailed?'Statistics loaded for this session. This browser could not remember the key.':missing?'Main totals loaded. Some breakdowns are temporarily unavailable.':'Private statistics loaded.');
    }catch(error){
      if(error.name==='AbortError'||ticket!==run)return;
      if([401,403].includes(error.status))device.clear();
      if([401,403].includes(error.status)||!$('statistics-auth').hidden)lock();
      setStatus(message(error),true);
    }finally{
      if(ticket===run){busy=false;$('statistics-connect').disabled=false;$('statistics-refresh').disabled=false;}
    }
  }
  function openStatistics(){
    if(!standalone){if(dialog.open)return;dialog.showModal();}
    choosePreset();
    const token=device.read();
    if(token){client=createClient(token,root.fetch.bind(root));load();}else $('statistics-api-key').focus();
  }
  for(const id of ['statistics-country-search','statistics-country-sort','statistics-country-size'])$(id).addEventListener(id==='statistics-country-search'?'input':'change',()=>{countryPage=1;renderCountries();});
  $('statistics-country-previous').addEventListener('click',()=>{countryPage--;renderCountries();});
  $('statistics-country-next').addEventListener('click',()=>{countryPage++;renderCountries();});
  $('statistics-country-export').addEventListener('click',()=>{
    if(!countries?.length)return;
    const url=root.URL.createObjectURL(new Blob([countryCSV(countries)],{type:'text/csv;charset=utf-8;'})),link=element('a');link.href=url;link.download='website-countries-'+$('statistics-start').value+'-to-'+$('statistics-end').value+'.csv';doc.body.append(link);link.click();link.remove();setTimeout(()=>root.URL.revokeObjectURL(url),1000);
  });
  $('show-statistics')?.addEventListener('click',openStatistics);
  $('statistics-auth').addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    const token=$('statistics-api-key').value.trim();$('statistics-api-key').value='';
    if(!validKey(token)){setStatus('Paste a valid read-only GoatCounter API key.',true);return;}
    const remember=$('statistics-remember').checked;
    if(!remember)device.clear();
    pendingRemember=remember?token:null;
    client?.clear();client=createClient(token,root.fetch.bind(root));load();
  });
  $('statistics-filter').addEventListener('submit',event=>{event.preventDefault();load();});
  $('statistics-period').addEventListener('change',choosePreset);
  $('statistics-lock').addEventListener('click',()=>{device.clear();lock();setStatus('This device has been disconnected. Enter your key to reconnect.');$('statistics-api-key').focus();});
  $('statistics-close').addEventListener('click',()=>{if(standalone)device.clear();lock();if(!standalone)dialog.close();});
  dialog.addEventListener('close',lock);
  root.addEventListener('pagehide',lock);
  root.addEventListener('storage',event=>{if(event.key===DEVICE_KEY&&!event.newValue)lock();});
  choosePreset();
  if(standalone)openStatistics();
})(typeof window==='undefined'?{}:window);
