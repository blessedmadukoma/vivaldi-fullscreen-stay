const test=require('node:test');
const assert=require('node:assert/strict');
const {checkSource,checkCss}=require('../scripts/security-check.cjs');

test('Security policy rejects network, storage, remote code and dangerous DOM capabilities',()=>{
  for(const code of ['fetch("https://example.invalid")','new WebSocket("wss://example.invalid")','navigator.sendBeacon("https://example.invalid", "x")','document.cookie','localStorage.getItem("x")','eval("1")','new Function("return 1")','document.body.innerHTML="x"','document.createElement("img")','chrome.tabs.query({})','chrome["runtime"]','const api=chrome; api.tabs.create({})','const api=chrome.tabs; api.create({})','document.title="forged"','document.body.setAttribute("src","https://example.invalid")']) assert.throws(()=>checkSource(code,'content.js'),undefined,code);
});

test('Security policy accepts only the reviewed content-script browser API',()=>{
  assert.doesNotThrow(()=>checkSource('chrome.runtime.sendMessage({type:"vfs:state",expanded:false})','content.js'));
  assert.throws(()=>checkSource('chrome.runtime.sendMessage({})','background.js'));
});

test('CSS policy rejects remote resources and escaped resource names',()=>{
  for(const css of ['@import "https://example.invalid/a.css";','video{background:url(https://example.invalid)}','video{background:image-set("https://example.invalid/a.png" 1x)}','video{background:u\\72l(https://example.invalid)}'])assert.throws(()=>checkCss(css));
});
test('Shadow styles must be fixed literals without external resources',()=>{
 assert.doesNotThrow(()=>checkSource('sheet.replaceSync(`[data-vfs-player]{position:fixed!important}`)','content.js'));
 for(const code of ['sheet.replaceSync(pageValue)','sheet.replaceSync(`video{background:url(https://example.invalid/a.png)}`)','sheet.replaceSync(`video{color:${pageValue}}`)'])assert.throws(()=>checkSource(code,'content.js'));
});
