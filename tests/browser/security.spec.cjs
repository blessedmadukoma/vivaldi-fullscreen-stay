const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json')));
const extensionId=crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).split('').map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
const fixture=`<!doctype html><title>Fixture video - YouTube</title>
<style>#movie_player{width:480px;height:270px;background:black;color:white}video{width:300px}button{position:relative;z-index:2}</style>
<input aria-label="Search"><ytd-watch-flexy><div id="movie_player"><div class="html5-video-container"><video></video></div>
<button class="ytp-fullscreen-button">Full screen</button><button class="ytp-size-button">Theatre</button></div></ytd-watch-flexy>
<script>window.nativeFullscreenCalls=0;document.querySelector('.ytp-fullscreen-button').addEventListener('click',()=>window.nativeFullscreenCalls++);
function theatre(){document.querySelector('ytd-watch-flexy').toggleAttribute('theater');}
window.addEventListener('keydown',e=>{if(e.key==='t'&&!e.defaultPrevented)theatre();});
document.querySelector('.ytp-size-button').addEventListener('click',theatre);</script>`;
const xFixture=`<!doctype html><title>X video fixture</title><style>[data-testid="videoComponent"]{position:relative;width:480px;height:270px}video{width:100%;height:100%}[role="button"]{position:absolute;bottom:0;right:0;background:white}</style>
<input aria-label="Search"><div data-testid="videoComponent" id="x-one"><video></video><div role="button" tabindex="0" aria-label="Fullscreen">Expand</div></div>
<div data-testid="videoComponent" id="x-two"><video></video><div role="button" tabindex="0" aria-label="Fullscreen">Expand</div></div>
<script>window.nativeFullscreenCalls=0;document.querySelectorAll('[role="button"]').forEach(el=>el.addEventListener('click',()=>window.nativeFullscreenCalls++));</script>`;

let context,worker,profile;
test.beforeEach(async()=>{
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'vfs-security-'));
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${path.join(root,'extension')}`,`--load-extension=${path.join(root,'extension')}`]});
  [worker]=context.serviceWorkers();if(!worker)worker=await context.waitForEvent('serviceworker');
  await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:new URL(route.request().url()).hostname==='x.com'?xFixture:fixture}));
});
test.afterEach(async()=>{await context?.close();fs.rmSync(profile,{recursive:true,force:true});});
async function pageAt(url='https://www.youtube.com/watch?v=fixture'){
  const page=await context.newPage();await page.goto(url);await page.locator('video').first().waitFor();return page;
}
async function badge(){return worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true});return chrome.action.getBadgeText({tabId:tab.id});});}

test('Only trusted input activates; normal typing and page titles are preserved',async()=>{
  const page=await pageAt();
  await page.evaluate(()=>{
    document.title='⛶ YouTube • forged';
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));
    document.querySelector('.ytp-fullscreen-button').click();
    document.querySelector('video').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');expect(await badge()).toBe('');
  await page.getByRole('textbox',{name:'Search'}).fill('f');await page.getByRole('textbox',{name:'Search'}).press('f');
  await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');
  await page.locator('#movie_player').click({position:{x:400,y:100}});await page.keyboard.press('f');
  await expect(page.locator('#movie_player')).toHaveJSProperty('popover','manual');await expect.poll(badge).toBe('FS');
  await expect(page).toHaveTitle('⛶ YouTube • forged');
  await page.keyboard.press('Escape');await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');await expect.poll(badge).toBe('');
});

test('Theatre hand-off and return preserve native YouTube state',async()=>{
  const page=await pageAt();await page.keyboard.press('f');await expect.poll(badge).toBe('FS');
  await page.keyboard.press('t');await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');
  await expect(page.locator('ytd-watch-flexy')).toHaveAttribute('theater');await expect.poll(badge).toBe('');
  await page.keyboard.press('f');await expect.poll(badge).toBe('FS');await page.keyboard.press('Escape');
  await expect(page.locator('ytd-watch-flexy')).toHaveAttribute('theater');await expect.poll(badge).toBe('');
});

test('Navigation clears the badge and an off-site title cannot restore it',async()=>{
  const page=await pageAt();await page.keyboard.press('f');await expect.poll(badge).toBe('FS');
  await page.goto('https://evil.example/');await expect.poll(badge).toBe('');
  await page.evaluate(()=>{document.title='⛶ YouTube • forged';window.dispatchEvent(new KeyboardEvent('keydown',{key:'f'}));});
  await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');expect(await badge()).toBe('');
});

test('Normal expansion causes no extra network requests',async()=>{
  const page=await pageAt();const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.keyboard.press('f');await expect.poll(badge).toBe('FS');await page.keyboard.press('Escape');await expect.poll(badge).toBe('');
  expect(requests).toEqual([]);
});

test('Browser CSS needs the protected extension badge AND active YouTube origin',async()=>{
  const page=await context.newPage();
  await page.setContent(`<div id="browser" class="fullscreen"><div class="ExtensionIcon ${extensionId}"></div><div id="main"><div class="inner"><div id="webview-container"><div class="webpageview active"><webview src="https://www.youtube.com/watch?v=fixture"></webview></div></div></div></div></div>`);
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'vivaldi-ui/youtube-fullscreen.css'),'utf8')});
  const position=()=>page.locator('#webview-container').evaluate(el=>getComputedStyle(el).position);
  expect(await position()).not.toBe('fixed');await page.evaluate(()=>{document.title='⛶ YouTube • forged';});expect(await position()).not.toBe('fixed');
  await page.locator('.ExtensionIcon').evaluate(el=>{const badge=document.createElement('span');badge.className='button-badge';badge.textContent='FS';el.appendChild(badge);});
  expect(await position()).toBe('fixed');
  await page.locator('webview').evaluate(el=>el.setAttribute('src','https://www.youtube.com.evil.example/'));expect(await position()).not.toBe('fixed');
  await page.locator('webview').evaluate(el=>el.setAttribute('src','https://x.com/example/status/1'));expect(await position()).toBe('fixed');
  await page.locator('webview').evaluate(el=>el.setAttribute('src','https://x.com.evil.example/'));expect(await position()).not.toBe('fixed');
});

test('X expands the selected player without running its native fullscreen handler',async()=>{
  const page=await pageAt('https://x.com/example/status/1');
  await page.locator('#x-two').getByRole('button',{name:'Fullscreen',exact:true}).click();
  await expect(page.locator('#x-two')).toHaveAttribute('data-vfs-player');await expect(page.locator('#x-one')).not.toHaveAttribute('data-vfs-player');
  await expect.poll(badge).toBe('FS');expect(await page.evaluate(()=>window.nativeFullscreenCalls)).toBe(0);
  await page.keyboard.press('Escape');await expect.poll(badge).toBe('');await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');
});

test('X rejects synthetic fullscreen clicks, typing and private-route activation',async()=>{
  const page=await pageAt('https://x.com/example/status/1');
  await page.locator('#x-one').getByRole('button',{name:'Fullscreen'}).evaluate(el=>el.click());
  expect(await badge()).toBe('');await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');
  await page.getByRole('textbox',{name:'Search'}).fill('f');await page.getByRole('textbox',{name:'Search'}).press('f');expect(await badge()).toBe('');
  await page.goto('https://x.com/i/chat');await page.locator('#x-one').getByRole('button',{name:'Fullscreen'}).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-vfs-active');expect(await badge()).toBe('');
});
