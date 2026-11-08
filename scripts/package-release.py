#!/usr/bin/env python3
"""Create an allow-listed release from a clean, reviewed source tree."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
if not re.fullmatch(r'(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){1,3}', VERSION) or any(int(part) > 65535 for part in VERSION.split('.')):
    raise SystemExit('Invalid extension version')
if subprocess.run(['git', 'diff-index', '--quiet', 'HEAD', '--'], cwd=ROOT).returncode:
    raise SystemExit('Release builds require a clean committed source tree')
ALLOWED = [
    'README.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md',
    'extension/manifest.json', 'extension/content.js', 'extension/background.js', 'extension/player.css',
    'extension/icons/16.png', 'extension/icons/32.png', 'extension/icons/48.png', 'extension/icons/128.png',
    'vivaldi-ui/vivaldi-fullscreen.css', 'docs/possible-regression.md', 'docs/security-audit.md', 'docs/performance.md',
]
FILES = [ROOT / name for name in ALLOWED]
for directory in ['extension', 'vivaldi-ui', 'docs']:
    for source in sorted((ROOT / directory).rglob('*')):
        if source.is_symlink():
            raise SystemExit('Symlinks cannot enter a release')
        if not source.is_file():
            continue
        if source.relative_to(ROOT).as_posix() not in ALLOWED:
            raise SystemExit(f'Unexpected release file: {source.relative_to(ROOT)}')
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
ARCHIVE = OUT / f'vivaldi-fullscreen-stay-{VERSION}.zip'
with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED) as package:
    for source in FILES:
        if any(parent.is_symlink() for parent in [source, *source.parents] if parent.is_relative_to(ROOT)) or source.stat().st_size > 512 * 1024:
            raise SystemExit('Unexpected release file or size')
        name = (Path(f'vivaldi-fullscreen-stay-{VERSION}') / source.relative_to(ROOT)).as_posix()
        entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        package.writestr(entry, source.read_bytes())
with zipfile.ZipFile(ARCHIVE) as package:
    assert package.testzip() is None
(OUT / 'SHA256SUMS').write_text(hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() + '  ' + ARCHIVE.name + '\n')
print(f'Built {ARCHIVE.name}: {len(FILES)} allow-listed files, {ARCHIVE.stat().st_size} bytes')
