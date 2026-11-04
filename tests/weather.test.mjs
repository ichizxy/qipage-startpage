import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const weather={current:{temperature_2m:26,weather_code:0,relative_humidity_2m:70},daily:{time:['today'],weather_code:[0],temperature_2m_min:[24],temperature_2m_max:[29]}};
function setup(t,{saved,fetchImpl}={}){
  const dom=new JSDOM(read('index.html'),{url:'https://qipage.test/',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window,$=s=>w.document.querySelector(s),calls=[],intervals=[],positions=[];
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};
  w.HTMLMediaElement.prototype.pause=w.HTMLMediaElement.prototype.load=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.setInterval=(fn,ms)=>{intervals.push({fn,ms});};
  w.fetch=(url,options)=>{calls.push({url,options});return fetchImpl?fetchImpl(url,options):Promise.resolve({ok:true,json:async()=>weather});};
  w.structuredClone=structuredClone;
  Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:(success,error,options)=>positions.push({success,error,options})}});
  const errors=[];w.addEventListener('error',e=>errors.push(e.error));
  t.after(()=>assert.deepEqual(errors,[]));
  w.eval(read('core.js'));w.eval(read('engine-icons.js'));
  const original=saved?.(w.QiPageCore.createDefaults());
  if(original)w.localStorage.setItem('qipage.v1',JSON.stringify(original));
  w.eval(read('app.js'));
  const enable=value=>{$('#weather-enabled').checked=value;$('#weather-enabled').dispatchEvent(new w.Event('change'));};
  const submitCity=()=>{$('#city-input').value='上海';$('#city-form').dispatchEvent(new w.Event('submit',{cancelable:true}));};
  return {w,$,calls,intervals,positions,enable,submitCity,saved:()=>JSON.parse(w.localStorage.getItem('qipage.v1'))};
}

test('天气默认关闭，刷新、定时器、城市搜索和定位都不联网；显式开启与关闭可持久保存',async t=>{
  const e=setup(t);
  assert.equal(e.$('#weather-enabled').checked,false);
  e.$('#weather-refresh').click();e.submitCity();e.$('#locate').click();
  e.intervals.find(i=>i.ms===30*60*1000).fn();
  assert.equal(e.calls.length,0);assert.equal(e.positions.length,0);
  e.enable(true);await flush();assert.equal(e.calls.length,1);
  assert.equal(e.calls[0].options.credentials,'omit');assert.equal(e.calls[0].options.referrerPolicy,'no-referrer');
  assert.equal(e.saved().weatherEnabled,true);
  e.enable(false);e.$('#weather-refresh').click();
  assert.equal(e.calls.length,1);assert.equal(e.saved().weatherEnabled,false);
  assert.match(e.$('#weather-detail').textContent,/已关闭/);
  const reload=setup(t,{saved:()=>e.saved()});assert.equal(reload.calls.length,0);
});

test('旧设置自动关闭联网并迁移精确坐标；开启后发送的坐标只有一位小数',async t=>{
  const e=setup(t,{saved:s=>{delete s.weatherEnabled;s.location={name:'测试城市',latitude:31.234567,longitude:121.476543};return s;}});
  assert.equal(e.calls.length,0);
  assert.deepEqual(e.saved().location,{name:'测试城市',latitude:31.2,longitude:121.5});
  e.enable(true);await flush();
  const url=new URL(e.calls[0].url);assert.equal(url.searchParams.get('latitude'),'31.2');assert.equal(url.searchParams.get('longitude'),'121.5');
  const reload=setup(t,{saved:()=>e.saved()});assert.equal(reload.calls.length,1);
});

test('关闭会中止天气和城市搜索，迟到的响应和定位结果不能恢复联网或覆盖位置',async t=>{
  const pending=[];
  const e=setup(t,{fetchImpl:()=>new Promise(resolve=>pending.push(resolve))});
  e.enable(true);e.submitCity();e.$('#locate').click();
  assert.equal(e.calls.length,2);assert.equal(e.positions[0].options.enableHighAccuracy,false);
  const before=e.saved().location;
  e.enable(false);
  assert.ok(e.calls.every(c=>c.options.signal.aborted));
  e.enable(true);e.positions[0].success({coords:{latitude:51.512345,longitude:-0.123456}});
  assert.deepEqual(e.saved().location,before);
  e.enable(false);
  pending.forEach(resolve=>resolve({ok:true,json:async()=>({...weather,results:[{name:'迟到城市',latitude:1,longitude:2}]})}));
  await flush();assert.equal(e.$('#city-results').children.length,0);assert.match(e.$('#weather-detail').textContent,/已关闭/);
});

test('定位与城市选择都只持久保存近似坐标，导入备份不能自动开启联网',async t=>{
  const e=setup(t,{fetchImpl:url=>Promise.resolve({ok:true,json:async()=>url.includes('geocoding')?{results:[{name:'上海',latitude:31.234567,longitude:121.476543}]}:weather})});
  e.enable(true);e.$('#locate').click();e.positions[0].success({coords:{latitude:-33.865143,longitude:151.2099}});await flush();
  assert.equal(e.saved().location.latitude,-33.9);assert.equal(e.saved().location.longitude,151.2);
  e.submitCity();await flush();e.$('.city-result').click();await flush();
  assert.deepEqual(e.saved().location,{name:'上海',latitude:31.2,longitude:121.5});
  const raw=e.saved();raw.weatherEnabled=true;raw.location.latitude=31.234567;
  Object.defineProperty(e.$('#import-data'),'files',{value:[{size:100,text:async()=>JSON.stringify(raw)}]});
  await e.$('#import-data').onchange({target:e.$('#import-data')});
  const count=e.calls.length;await e.$('#confirm-import').onclick();
  assert.equal(e.saved().weatherEnabled,false);assert.equal(e.saved().location.latitude,31.2);assert.equal(e.calls.length,count);
});
