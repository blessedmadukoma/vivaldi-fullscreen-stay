const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
function fixture(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vfs-package-'));
  for(const dir of ['extension','vivaldi-ui','docs','scripts'])fs.cpSync(path.join(root,dir),path.join(tmp,dir),{recursive:true});
  for(const file of ['README.md','LICENSE','CHANGELOG.md','SECURITY.md'])fs.copyFileSync(path.join(root,file),path.join(tmp,file));
  const git=(...args)=>{const r=spawnSync('git',args,{cwd:tmp,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
  git('init','-q');git('config','core.hooksPath',path.join(tmp,'empty-hooks'));git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','Fixture');
  const build=()=>spawnSync('python3',['scripts/package-release.py'],{cwd:tmp,encoding:'utf8'});
  return {tmp,git,build,close:()=>fs.rmSync(tmp,{recursive:true,force:true})};
}
test('Release builds are deterministic and reject extra data files',()=>{
  const f=fixture();try{
    assert.equal(f.build().status,0);const first=fs.readFileSync(path.join(f.tmp,'dist/SHA256SUMS'),'utf8');
    assert.equal(f.build().status,0);assert.equal(fs.readFileSync(path.join(f.tmp,'dist/SHA256SUMS'),'utf8'),first);
    fs.writeFileSync(path.join(f.tmp,'extension/credentials.json'),'{}');assert.notEqual(f.build().status,0);
  }finally{f.close();}
});
test('Release builds reject dirty tracked files, symlinks and invalid version paths',()=>{
  const f=fixture();try{
    fs.appendFileSync(path.join(f.tmp,'README.md'),'\nUnreviewed change');assert.notEqual(f.build().status,0);
    f.git('restore','README.md');fs.symlinkSync(path.join(f.tmp,'README.md'),path.join(f.tmp,'extension/extra.md'));assert.notEqual(f.build().status,0);
    fs.unlinkSync(path.join(f.tmp,'extension/extra.md'));
    fs.writeFileSync(path.join(f.tmp,'extension/manifest.json'),JSON.stringify({version:'../../outside'}));assert.notEqual(f.build().status,0);
  }finally{f.close();}
});
