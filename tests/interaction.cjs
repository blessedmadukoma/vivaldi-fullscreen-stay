const fs = require('node:fs');
const path = require('node:path');
const extensionFile = name => path.join(__dirname, '..', 'extension', name);
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(kind='') { this.kind=kind; this.attributes=new Map(); this.isConnected=true; this.parentElement=null; this.classes=new Set(); this.classList={contains:k=>this.classes.has(k),add:(...ks)=>ks.forEach(k=>this.classes.add(k)),remove:k=>this.classes.delete(k)}; }
  closest(selector) { return this.kind==='input' && selector.includes('input') ? this : null; }
  matches(s){ return s === ":popover-open" && Boolean(this.open); }
  showPopover(){this.open=true;}
  hidePopover(){this.open=false;}
  setAttribute(k,v){this.attributes.set(k,v);}
  removeAttribute(k){this.attributes.delete(k);}
  getAttribute(k){return this.attributes.get(k)??null;}
  hasAttribute(k){return this.attributes.has(k);}
  querySelector(s){if(s==='video')return this.video;if(s==='.ytp-fullscreen-button')return this.button;if(s==='.ytp-size-button')return this.theatreButton;return null;}
}
function fixture(){
 const listeners={};const root=new Element(),body=new Element(),player=new Element(),button=new Element(),video=new Element();
 body.parentElement=root;player.parentElement=body;player.video=video;player.button=button;const watchPage=new Element();player.theatreButton={click(){watchPage.setAttribute('theater','');}};player.classes.add('existing');button.setAttribute('aria-label','Full screen (f)');
 const document={title:"Test video - YouTube",documentElement:root,fullscreenElement:null,querySelector:s=>s==='#movie_player'?player:s==='ytd-watch-flexy'?watchPage:null};
 const window={scrollX:10,scrollY:20,scrollTo:(x,y)=>{window.scrollX=x;window.scrollY=y;},addEventListener:(n,f)=>(listeners[n]??=[]).push(f)};
 const observers=[];
 class MutationObserver{constructor(callback){this.callback=callback;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}}
 vm.runInNewContext(fs.readFileSync(extensionFile('content.js'),'utf8'),{Element,window,document,MutationObserver,Set});
 const emit=(name,extra={})=>{const e={key:'',target:player,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const f of listeners[name]??[])f(e);return e;};
 const key=(key,extra={})=>{const e=emit('keydown',{key,...extra});emit('keyup',{key,...extra});return e;};
 return {root,player,button,video,watchPage,document,window,listeners,observers,emit,key,active:()=>root.attributes.has('data-vfs-active')};
}
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS',name);}
test('F expands the existing player; second F restores it',()=>{const f=fixture();assert(f.key('f').prevented);assert(f.active());assert(f.player.open);assert(f.document.title.startsWith('⛶ YouTube • '));assert.deepEqual([...f.player.classes],['existing']);assert(f.key('f').prevented);assert(!f.active());assert(!f.player.open);assert.equal(f.document.title,'Test video - YouTube');assert.deepEqual([...f.player.classes],['existing']);assert.equal(f.button.getAttribute('aria-label'),'Full screen (f)');assert(!f.observers[0].connected);});
test('Esc exits and consumes keydown and keyup',()=>{const f=fixture();f.key('f');const a=f.emit('keydown',{key:'Escape'});const b=f.emit('keyup',{key:'Escape'});assert(a.prevented&&a.stopped&&b.prevented&&b.stopped);assert(!f.active());});
test('Typing and modified shortcuts remain unchanged',()=>{for(const extra of [{target:new Element('input')},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}]){const f=fixture();assert(!f.key('f',extra).prevented);assert(!f.active());}});
test('A held F does not repeatedly toggle',()=>{const f=fixture();f.emit('keydown',{key:'f'});assert(f.active());assert(f.emit('keydown',{key:'f',repeat:true}).prevented);assert(f.active());f.emit('keyup',{key:'f'});assert(f.key('f').prevented);assert(!f.active());});
test('Existing native video fullscreen is left alone',()=>{const f=fixture();f.document.fullscreenElement=f.player;assert(!f.key('f').prevented);assert(!f.active());});
test('Navigation restores page layout and scroll position',()=>{const f=fixture();f.key('f');f.window.scrollY=0;f.emit('yt-navigate-start');assert(!f.active());assert.equal(f.window.scrollY,20);assert(!f.player.attributes.has('data-vfs-player'));});
test('Removing the player cleans up its observer and classes',()=>{const f=fixture();f.key('f');f.player.isConnected=false;f.observers[0].callback();assert(!f.active());assert(!f.observers[0].connected);});
test('Manifest grants only YouTube content access',()=>{const m=JSON.parse(fs.readFileSync(extensionFile('manifest.json')));assert.deepEqual(m.content_scripts[0].matches,['https://www.youtube.com/*']);assert.equal(m.background,undefined);assert.equal(m.permissions,undefined);assert.equal(m.host_permissions,undefined);assert.equal(m.content_scripts[0].run_at,'document_start');});
test('T restores layout and lets YouTube receive the trusted key',()=>{const f=fixture();f.key('f');assert(!f.key('t').prevented);assert(!f.active());assert(!f.player.open);assert.equal(f.document.title,'Test video - YouTube');});
test('F and Esc preserve the existing theatre state',()=>{for(const key of ['f','Escape']){const f=fixture();f.watchPage.setAttribute('theater','');f.key('f');f.key(key);assert(!f.active());assert(f.watchPage.hasAttribute('theater'));}});
console.log(`${checks} local checks passed.`);
