const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const acorn = require('acorn');
const root = path.join(__dirname, '..');

function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node,parent);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child,visit,node));
    else if (value && typeof value === 'object') walk(value,visit,node);
  }
}

function member(node) {
  if (node?.type === 'ChainExpression') return member(node.expression);
  if (node?.type === 'Identifier') return node.name;
  if (node?.type !== 'MemberExpression' || node.computed) return null;
  const base = member(node.object);
  return base ? `${base}.${node.property.name}` : null;
}

function checkSource(source, filename) {
  const tree = acorn.parse(source,{ecmaVersion:'latest',sourceType:'script'});
  const forbidden = new Set(['fetch','XMLHttpRequest','WebSocket','WebTransport','EventSource','Worker','SharedWorker','eval','Function','importScripts','require','localStorage','sessionStorage','indexedDB','cookieStore','caches','Reflect','Proxy','globalThis','console']);
  const properties = new Set(['cookie','cookieStore','credentials','localStorage','sessionStorage','indexedDB','sendBeacon','innerHTML','outerHTML','insertAdjacentHTML','createElement','createElementNS','write','writeln','postMessage','href','src','srcdoc','formAction','ping','assign','replace']);
  const api = filename === 'content.js' ? ['chrome.runtime.sendMessage'] : [
    'chrome.runtime.id','chrome.runtime.onMessage.addListener','chrome.action.setBadgeText',
    'chrome.tabs.onUpdated.addListener','chrome.tabs.onRemoved.addListener'
  ];
  walk(tree,(node,parent)=>{
    if (node.type === 'Identifier' && forbidden.has(node.name)) throw new Error(`${filename}: forbidden capability ${node.name}`);
    if (node.type === 'ImportExpression' || node.type === 'WithStatement') throw new Error(`${filename}: dynamic code is forbidden`);
    if (node.type === 'Identifier' && node.name === 'chrome' && !(parent?.type === 'MemberExpression' && parent.object === node)) throw new Error(`${filename}: browser API aliases require security review`);
    if (node.type !== 'MemberExpression') return;
    if (node.computed) throw new Error(`${filename}: computed property access requires security review`);
    const name=node.property.name, full=member(node);
    if (properties.has(name) || name === 'constructor' || full === 'document.title') throw new Error(`${filename}: forbidden property ${full}`);
    if (full?.startsWith('chrome.')) {
      const nested=parent?.type === 'MemberExpression' && parent.object === node;
      if (!(nested ? api.some(allowed=>allowed === full || allowed.startsWith(full+'.')) : api.includes(full))) throw new Error(`${filename}: unapproved browser API ${full}`);
    }
  });
  walk(tree,node=>{
    if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || node.callee.property.name !== 'setAttribute') return;
    const name=node.arguments[0]?.value;
    if (!['data-vfs-active','data-vfs-player','popover','aria-label','title','data-title-no-tooltip'].includes(name)) throw new Error(`${filename}: unapproved or dynamic attribute write`);
  });
}

function checkCss(css) {
  const text=css.replace(/\/\*[\s\S]*?\*\//g,'');
  if (/\\|@import|@font-face|\burl\s*\(|\bimage-set\s*\(|\bpaint\s*\(/i.test(text)) throw new Error('CSS external resources or escapes require security review');
}

function main() {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
  const allowed=new Set(['manifest_version','name','version','description','minimum_chrome_version','key','action','icons','background','content_scripts','content_security_policy']);
  for(const key of Object.keys(manifest)) assert(allowed.has(key),`Unapproved manifest key: ${key}`);
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
  assert(/^\d+(\.\d+){1,3}$/.test(manifest.version),'Invalid version');
  assert.deepEqual(manifest.background,{service_worker:'background.js'});
  assert.equal(manifest.content_scripts.length,1);
  assert.deepEqual(manifest.content_scripts[0],{matches:['https://www.youtube.com/*'],run_at:'document_start',js:['content.js'],css:['player.css'],all_frames:false,world:'ISOLATED'});
  assert.equal(manifest.content_security_policy.extension_pages,"script-src 'self'; object-src 'none'; connect-src 'none'; base-uri 'none'");
  const der=Buffer.from(manifest.key,'base64');
  const publicKey=crypto.createPublicKey({key:der,format:'der',type:'spki'});
  assert.equal(publicKey.asymmetricKeyType,'rsa');
  assert(publicKey.asymmetricKeyDetails.modulusLength>=2048);
  const id=crypto.createHash('sha256').update(der).digest('hex').slice(0,32).split('').map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
  for(const file of ['content.js','background.js']) checkSource(fs.readFileSync(path.join(root,'extension',file),'utf8'),file);
  const css=fs.readFileSync(path.join(root,'vivaldi-ui/youtube-fullscreen.css'),'utf8');checkCss(css);
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  const selector=`@scope (#browser.fullscreen:has(.ExtensionIcon.${id} .button-badge):has(.webpageview.active webview[src^="https://www.youtube.com/"]))`;
  assert(clean.startsWith(selector+' {'),'Browser CSS must use the exact extension badge and active YouTube origin');
  let depth=0;
  for(let i=clean.indexOf('{');i<clean.length;i++){
    if(clean[i]==='{')depth++;if(clean[i]==='}')depth--;
    assert(depth>=0,'Unbalanced CSS');
    if(depth===0){assert.equal(clean.slice(i+1).trim(),'','CSS outside the trusted scope is forbidden');break;}
  }
  assert.equal(depth,0);
  assert(!/aria-label|YouTube •/.test(css),'A page title must not control browser chrome');
  checkCss(fs.readFileSync(path.join(root,'extension/player.css'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
  assert.equal(Object.keys(lock.packages[''].dependencies??{}).length,0,'Runtime dependencies are forbidden');
  for(const [name,pkg] of Object.entries(lock.packages)){
    if(!name)continue;
    assert(pkg.resolved.startsWith('https://registry.npmjs.org/'),`Unexpected dependency source ${name}`);
    assert(pkg.integrity.startsWith('sha512-'),`Missing integrity digest ${name}`);
    assert(pkg.dev,`Production dependency ${name}`);
  }
  for(const file of fs.readdirSync(path.join(root,'.github/workflows'))){
    const text=fs.readFileSync(path.join(root,'.github/workflows',file),'utf8');
    assert(!text.includes('pull_request_target'),'Privileged fork workflows are forbidden');
    for(const match of text.matchAll(/uses:\s*([^\s#]+)/g)) assert(/^[\w-]+\/[\w./-]+@[a-f0-9]{40}$/.test(match[1]),`Action must be pinned to a full commit: ${match[1]}`);
  }
  console.log(`Security policy passed; stable extension ID ${id}`);
}

if(require.main===module)main();
module.exports={checkSource,checkCss};
