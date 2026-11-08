const {chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.join(__dirname,'..');
const seconds=Number(process.env.VFS_PERF_SECONDS??15);
if(!Number.isFinite(seconds)||seconds<5||seconds>60)throw Error('VFS_PERF_SECONDS must be between 5 and 60');
const baseline=process.env.VFS_PERF_BASELINE;
const modes=baseline?['no-helper','previous','current']:['no-helper','current'];
const output=process.env.VFS_PERF_OUTPUT??path.join(root,'dist/performance.json');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json')));
const instrumentation=`
window.__vfsPerf={observerCallbacks:0,stateMessages:0};
const OriginalObserver=window.MutationObserver;
window.MutationObserver=class extends OriginalObserver {
  constructor(callback){super((records,observer)=>{window.__vfsPerf.observerCallbacks++;callback(records,observer);});}
};
const originalSend=chrome.runtime.sendMessage;
chrome.runtime.sendMessage=function(...args){window.__vfsPerf.stateMessages++;return originalSend(...args);};
`;
const html=`<!doctype html><title>Local performance fixture</title>
<style>#movie_player{position:relative;width:640px;height:360px;background:black}video{width:100%;height:100%}button{position:absolute;bottom:0;right:0}</style>
<div id="movie_player"><video muted autoplay playsinline></video><button class="ytp-fullscreen-button">Full screen</button></div>
<section><div id="updates"><span>0</span></div></section>
<script>
window.framesDrawn=0;window.domUpdates=0;
const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
const draw=canvas.getContext('2d'),video=document.querySelector('video'),updates=document.querySelector('#updates');
video.srcObject=canvas.captureStream(30);window.videoReady=video.play();
function tick(){
  window.framesDrawn++;
  draw.fillStyle=window.framesDrawn%2?'#182838':'#203040';draw.fillRect(0,0,640,360);
  for(let i=0;i<20;i++){updates.firstChild.replaceWith(document.createTextNode(String(window.domUpdates++)));}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
document.querySelector('button').addEventListener('click',()=>{
  const player=document.querySelector('#movie_player');player.setAttribute('data-vfs-player','');
  document.documentElement.setAttribute('data-vfs-active','');player.setAttribute('popover','manual');player.showPopover();
});
</script>`;

async function sample(mode,round){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'vfs-perf-'));
  const extension=path.join(temporary,'extension');
  fs.cpSync(path.join(root,'extension'),extension,{recursive:true});
  const source=mode==='previous'?fs.readFileSync(baseline,'utf8'):fs.readFileSync(path.join(extension,'content.js'),'utf8');
  fs.writeFileSync(path.join(extension,'content.js'),instrumentation+source);
  const args=mode==='no-helper'?[]:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`];
  const context=await chromium.launchPersistentContext(path.join(temporary,'profile'),{channel:'chromium',headless:true,args,viewport:{width:1280,height:720}});
  try{
    await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page),browser=await context.browser().newBrowserCDPSession();
    const worlds=[];cdp.on('Runtime.executionContextCreated',({context})=>worlds.push(context));
    await cdp.send('Runtime.enable');await cdp.send('Performance.enable');
    await page.goto('https://www.youtube.com/watch?v=local-performance');
    await page.evaluate(()=>window.videoReady);
    await page.getByRole('button',{name:'Full screen',exact:true}).click();
    await page.waitForTimeout(1500);
    const world=worlds.find(c=>c.name===manifest.name);
    if(mode!=='no-helper'&&!world)throw Error('Extension measurement context missing');
    async function snapshot(){
      const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      const processes=(await browser.send('SystemInfo.getProcessInfo')).processInfo;
      const pageStats=await page.evaluate(()=>({frames:window.framesDrawn,updates:window.domUpdates}));
      const stats=world?JSON.parse((await cdp.send('Runtime.evaluate',{contextId:world.id,expression:'JSON.stringify(window.__vfsPerf)',returnByValue:true})).result.value):{observerCallbacks:0,stateMessages:0};
      return {time:performance.now(),metrics,processes,pageStats,stats};
    }
    const start=await snapshot();await page.waitForTimeout(seconds*1000);const end=await snapshot();
    const elapsed=(end.time-start.time)/1000;
    const cpu=end.processes.reduce((sum,p)=>sum+Math.max(0,p.cpuTime-(start.processes.find(old=>old.id===p.id)?.cpuTime??0)),0);
    return {mode,round,browserVersion:context.browser().version(),elapsedSeconds:elapsed,browserCpuSeconds:cpu,browserCpuPercent:100*cpu/elapsed,pageTaskSeconds:end.metrics.TaskDuration-start.metrics.TaskDuration,pageScriptSeconds:end.metrics.ScriptDuration-start.metrics.ScriptDuration,frames:end.pageStats.frames-start.pageStats.frames,domUpdates:end.pageStats.updates-start.pageStats.updates,observerCallbacks:end.stats.observerCallbacks-start.stats.observerCallbacks,stateMessages:end.stats.stateMessages-start.stats.stateMessages};
  }finally{await context.close();fs.rmSync(temporary,{recursive:true,force:true});}
}

(async()=>{
  const samples=[];
  for(let round=1;round<=3;round++){
    const order=round%2?modes:[...modes].reverse();
    for(const mode of order){const result=await sample(mode,round);samples.push(result);console.log(JSON.stringify(result));}
  }
  const result={date:new Date().toISOString(),platform:process.platform,arch:process.arch,cpuModel:os.cpus().at(0).model,browserVersion:samples.at(0).browserVersion,playwrightVersion:require('@playwright/test/package.json').version,secondsPerSample:seconds,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'extension/content.js'))).digest('hex'),samples};
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log('Saved controlled performance measurements.');
})().catch(error=>{console.error(error);process.exitCode=1;});
