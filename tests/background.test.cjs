const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const events = {}, badges = new Map();
  const event = name => ({ addListener(fn) { events[name] = fn; } });
  const chrome = {
    runtime: { id: 'test-extension', onMessage: event('message') },
    action: { async setBadgeText({tabId,text}) { badges.set(tabId,text); } },
    tabs: { onUpdated: event('updated'), onRemoved: event('removed') }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/background.js'),'utf8'), {chrome, URL});
  const sender = { id:'test-extension', frameId:0, tab:{id:7}, documentId:'document-a', documentLifecycle:'active', origin:'https://www.youtube.com', url:'https://www.youtube.com/watch?v=example' };
  const message = {type:'vfs:state',expanded:true};
  const send = (data=message, source=sender) => new Promise(resolve => {
    if (!events.message(data,source,resolve)) resolve(null);
  });
  return {chrome,events,badges,sender,message,send};
}

test('Only a top-level active YouTube document can set its own tab badge',async()=>{
  const f=fixture(); assert.equal((await f.send()).ok,true);assert.equal(f.badges.get(7),'FS');
  assert.equal((await f.send({...f.message,expanded:false})).ok,true);assert.equal(f.badges.get(7),'');
});

test('Reject wrong origins, frames, extension IDs and inactive documents',async()=>{
  for(const patch of [
    {id:'another-extension'},{frameId:1},{documentLifecycle:'cached'},
    {origin:'https://evil.example'}, {url:'https://www.youtube.com.evil.example/watch'},
    {url:'https://www.youtube.com@evil.example/watch'}, {url:'javascript:alert(1)'},
    {documentId:undefined},{tab:{id:-1}},{tab:{id:'7'}},{tab:undefined}
  ]){const f=fixture();assert.equal(await f.send(f.message,{...f.sender,...patch}),null);assert.equal(f.badges.size,0);}
});

test('Reject malformed messages and extra page/account data',async()=>{
  for(const data of [null,[],{}, {type:'vfs:state',expanded:'true'}, {type:'other',expanded:true}, {type:'vfs:state',expanded:true,url:'https://evil.example'}]){
    const f=fixture();assert.equal(await f.send(data),null);assert.equal(f.badges.size,0);
  }
});

test('A navigation clear follows a pending activation without reading its URL',async()=>{
  const f=fixture();const active=f.send();
  f.events.updated(7,{status:'loading',get url(){throw new Error('URL must not be read');}});
  await active;await new Promise(setImmediate);assert.equal(f.badges.get(7),'');
});

test('Per-tab state is isolated and action API failure is contained',async()=>{
  const f=fixture();await f.send();await f.send(f.message,{...f.sender,tab:{id:8}});
  await f.send({...f.message,expanded:false});assert.equal(f.badges.get(7),'');assert.equal(f.badges.get(8),'FS');
  f.chrome.action.setBadgeText=async()=>{throw new Error('Tab closed');};assert.equal((await f.send()).ok,false);
});
