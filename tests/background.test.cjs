const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const events = {}, badges = new Map(), relays=[];
  const event = name => ({ addListener(fn) { events[name] = fn; } });
  const chrome = {
    runtime: { id: 'test-extension', onMessage: event('message') },
    action: { async setBadgeText({tabId,text}) { badges.set(tabId,text); } },
    tabs: { onUpdated: event('updated'), onRemoved: event('removed'), async sendMessage(tabId,message){relays.push({tabId,message});} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/background.js'),'utf8'), {chrome, URL});
  const sender = { id:'test-extension', frameId:0, tab:{id:7}, documentId:'document-a', documentLifecycle:'active', origin:'https://www.youtube.com', url:'https://www.youtube.com/watch?v=example' };
  const message = {type:'vfs:state',expanded:true,activation:'0123456789abcdef0123456789abcdef'};
  const send = (data=message, source=sender) => new Promise(resolve => {
    if (!events.message(data,source,resolve)) resolve(null);
  });
  return {chrome,events,badges,relays,sender,message,send};
}

test('An active HTTP(S) document can set only its own tab badge',async()=>{
  const f=fixture(); assert.equal((await f.send()).ok,true);assert.equal(f.badges.get(7),'FS');
  assert.equal((await f.send({...f.message,expanded:false,activation:''})).ok,true);assert.equal(f.badges.get(7),'');
});

test('Reject wrong origins, frames, extension IDs and inactive documents',async()=>{
  for(const patch of [
    {id:'another-extension'},{frameId:-1},{frameId:'1'},{documentLifecycle:'cached'},
    {origin:'https://other.example'}, {url:'https://www.youtube.com.evil.example/watch'},
    {url:'https://www.youtube.com@evil.example/watch'}, {url:'javascript:alert(1)'},
    {documentId:undefined},{tab:{id:-1}},{tab:{id:'7'}},{tab:undefined},
    {origin:'file://',url:'file:///tmp/video'},{origin:'chrome://settings',url:'chrome://settings/'}
  ]){const f=fixture();assert.equal(await f.send(f.message,{...f.sender,...patch}),null);assert.equal(f.badges.size,0);}
});

test('Reject malformed messages and extra page/account data',async()=>{
  for(const data of [null,[],{}, {type:'vfs:state',expanded:'true'}, {type:'other',expanded:true}, {type:'vfs:state',expanded:true,url:'https://evil.example'}, {type:'vfs:state',expanded:true,activation:'page-data'}, {type:'vfs:state',expanded:false,activation:'page-data'}]){
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
  await f.send({...f.message,expanded:false,activation:''});assert.equal(f.badges.get(7),'');assert.equal(f.badges.get(8),'FS');
  f.chrome.action.setBadgeText=async()=>{throw new Error('Tab closed');};assert.equal((await f.send()).ok,false);
  assert.deepEqual(JSON.parse(JSON.stringify(f.relays.at(-1))),{tabId:7,message:{type:'vfs:relay',expanded:false,activation:''}});
});

test('X accepts public video state but private routes can only clear it',async()=>{
  const f=fixture();const source={...f.sender,origin:'https://x.com',url:'https://x.com/example/status/1'};
  assert.equal((await f.send(f.message,source)).ok,true);assert.equal(f.badges.get(7),'FS');
  const privateSource={...source,url:'https://x.com/i/chat'};
  assert.equal(await f.send(f.message,privateSource),null);
  assert.equal((await f.send({...f.message,expanded:false,activation:''},privateSource)).ok,true);assert.equal(f.badges.get(7),'');
  assert.equal(await f.send(f.message,{...source,url:'https://x.com.evil.example/'}),null);
});
test('A child frame can relay layout state within its own tab without URLs or page data',async()=>{
 const f=fixture(),source={...f.sender,frameId:23,origin:'https://player.example',url:'https://player.example/embed'};
 assert.equal((await f.send(f.message,source)).ok,true);assert.equal(f.badges.get(7),'FS');
 assert.deepEqual(JSON.parse(JSON.stringify(f.relays)),[{tabId:7,message:{type:'vfs:relay',expanded:true,activation:f.message.activation}}]);
});
