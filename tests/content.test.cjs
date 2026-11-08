const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const extensionFile = name => path.join(__dirname, '..', 'extension', name);
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(kind='') { this.kind=kind; this.attributes=new Map(); this.isConnected=true; this.parentElement=null; this.classes=new Set(); this.classList={contains:k=>this.classes.has(k),add:(...ks)=>ks.forEach(k=>this.classes.add(k)),remove:k=>this.classes.delete(k)}; }
  closest(selector) {
    if(this.kind==='input' && selector.includes('input')) return this;
    if(this.kind==='x-player' && selector.includes('videoComponent')) return this;
    if(this.kind==='button' && selector.includes('button')) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  getBoundingClientRect(){return {width:480,height:270,top:10,left:10,right:490,bottom:280};}
  matches(s){ return s === ":popover-open" && Boolean(this.open); }
  showPopover(){this.open=true;}
  hidePopover(){this.open=false;}
  setAttribute(k,v){this.attributes.set(k,v);}
  removeAttribute(k){this.attributes.delete(k);}
  getAttribute(k){return this.attributes.get(k)??null;}
  hasAttribute(k){return this.attributes.has(k);}
  querySelector(s){if(s==='video')return this.video;if(s==='.ytp-fullscreen-button')return this.button;if(s==='.ytp-size-button')return this.theatreButton;return null;}
}
class Video extends Element {}
function fixture(options={}){
 const listeners={};const root=new Element(),body=new Element(),player=new Element(),button=new Element(),video=new Video();
 body.parentElement=root;player.parentElement=body;video.parentElement=player;button.parentElement=player;button.kind='button';if(options.origin==='https://x.com')player.kind='x-player';player.video=video;player.button=button;const watchPage=new Element();player.theatreButton={click(){watchPage.setAttribute('theater','');}};player.classes.add('existing');button.setAttribute('aria-label','Full screen (f)');
 const document={title:"Test video - YouTube",documentElement:root,fullscreenElement:null,querySelector:s=>s==='#movie_player'?player:s==='ytd-watch-flexy'?watchPage:null};
 const window={innerWidth:1280,innerHeight:720,scrollX:10,scrollY:20,scrollTo:(x,y)=>{window.scrollX=x;window.scrollY=y;},addEventListener:(n,f)=>(listeners[n]??=[]).push(f)};
 window.top=options.frame ? {} : window;
 const messages=[];
 const chrome={runtime:{sendMessage(message){messages.push(JSON.parse(JSON.stringify(message)));return Promise.resolve({ok:options.ack!==false});}}};
 const location={origin:options.origin??'https://www.youtube.com',pathname:options.pathname??'/watch'};
 const observers=[];
 class MutationObserver{constructor(callback){this.callback=callback;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}}
 vm.runInNewContext(fs.readFileSync(extensionFile('content.js'),'utf8'),{Element,HTMLElement:Element,HTMLVideoElement:Video,window,document,MutationObserver,Set,chrome,location});
 const emit=(name,extra={})=>{const e={key:'',isTrusted:true,target:player,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const f of listeners[name]??[])f(e);return e;};
 const key=(key,extra={})=>{const e=emit('keydown',{key,...extra});emit('keyup',{key,...extra});return e;};
 return {root,player,button,video,watchPage,document,window,location,listeners,observers,messages,emit,key,active:()=>root.attributes.has('data-vfs-active')};
}
test('F expands the existing player; second F restores it',()=>{const f=fixture();assert(f.key('f').prevented);assert(f.active());assert(f.player.open);assert.equal(f.document.title,'Test video - YouTube');assert.deepEqual([...f.player.classes],['existing']);assert(f.key('f').prevented);assert(!f.active());assert(!f.player.open);assert.equal(f.document.title,'Test video - YouTube');assert.deepEqual([...f.player.classes],['existing']);assert.equal(f.button.getAttribute('aria-label'),'Full screen (f)');assert(!f.observers[0].connected);});
test('Esc exits and consumes keydown and keyup',()=>{const f=fixture();f.key('f');const a=f.emit('keydown',{key:'Escape'});const b=f.emit('keyup',{key:'Escape'});assert(a.prevented&&a.stopped&&b.prevented&&b.stopped);assert(!f.active());});
test('Typing and modified shortcuts remain unchanged',()=>{for(const extra of [{target:new Element('input')},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}]){const f=fixture();assert(!f.key('f',extra).prevented);assert(!f.active());}});
test('A held F does not repeatedly toggle',()=>{const f=fixture();f.emit('keydown',{key:'f'});assert(f.active());assert(f.emit('keydown',{key:'f',repeat:true}).prevented);assert(f.active());f.emit('keyup',{key:'f'});assert(f.key('f').prevented);assert(!f.active());});
test('Existing native video fullscreen is left alone',()=>{const f=fixture();f.document.fullscreenElement=f.player;assert(!f.key('f').prevented);assert(!f.active());});
test('Navigation restores page layout and scroll position',()=>{const f=fixture();f.key('f');f.window.scrollY=0;f.emit('yt-navigate-start');assert(!f.active());assert.equal(f.window.scrollY,20);assert(!f.player.attributes.has('data-vfs-player'));});
test('Removing the player cleans up its observer and classes',()=>{const f=fixture();f.key('f');f.player.isConnected=false;f.observers[0].callback();assert(!f.active());assert(!f.observers[0].connected);});
test('T restores layout and lets YouTube receive the trusted key',()=>{const f=fixture();f.key('f');assert(!f.key('t').prevented);assert(!f.active());assert(!f.player.open);assert.equal(f.document.title,'Test video - YouTube');});
test('F and Esc preserve the existing theatre state',()=>{for(const key of ['f','Escape']){const f=fixture();f.watchPage.setAttribute('theater','');f.key('f');f.key(key);assert(!f.active());assert(f.watchPage.hasAttribute('theater'));}});
test('Synthetic keyboard, click and double-click cannot activate the extension',()=>{
 for(const kind of ['keydown','click','dblclick']){const f=fixture();f.emit(kind,{key:'f',isTrusted:false});assert(!f.active());assert(!f.messages.some(m=>m.expanded));}
});
test('Origin and top-frame guards fail closed',()=>{
 for(const options of [{origin:'https://evil.example'},{origin:'https://www.youtube.com.evil.example'},{frame:true}]){
  const f=fixture(options);f.key('f');assert(!f.active());assert.equal(f.messages.length,0);
 }
});
test('Forging the old title marker cannot activate the extension',()=>{
 const f=fixture();f.document.title='⛶ YouTube • forged';assert(!f.active());assert(!f.messages.some(m=>m.expanded));
});
test('Messages contain only an explicit boolean and a fixed type',()=>{
 const f=fixture();f.key('f');f.key('Escape');assert.equal(f.messages.length,3);
 for(const m of f.messages){assert.deepEqual(Object.keys(m).sort(),['expanded','type']);assert.equal(m.type,'vfs:state');assert.equal(typeof m.expanded,'boolean');}
});
test('A rejected indicator restores the page instead of hiding browser controls',async()=>{
 const f=fixture({ack:false});f.key('f');await new Promise(setImmediate);assert(!f.active());assert(!f.player.open);
});

test('X controls expand only their own visible video component',()=>{
 const f=fixture({origin:'https://x.com',pathname:'/example/status/1'});f.button.setAttribute('aria-label','Fullscreen');
 assert(f.emit('click',{target:f.button,button:0}).prevented);assert(f.active());assert(f.key('Escape').prevented);assert(!f.active());
});
test('X ignores private routes and stale off-screen players',()=>{
 for(const pathname of ['/i/chat','/messages/1','/settings/account','/compose/post']){const f=fixture({origin:'https://x.com',pathname});f.key('f');assert(!f.active());}
 const f=fixture({origin:'https://x.com'});f.player.getBoundingClientRect=()=>({width:480,height:270,top:-500,left:0,right:480,bottom:-230});f.key('f');assert(!f.active());
});
test('X private SPA navigation exits and only sends a clear',()=>{
 const f=fixture({origin:'https://x.com'});f.key('f');assert(f.active());f.location.pathname='/i/chat';f.key('Escape');assert(!f.active());assert.equal(f.messages.at(-1).expanded,false);
});
