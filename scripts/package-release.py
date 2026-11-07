#!/usr/bin/env python3
"""Create an allow-listed release from a clean, reviewed source tree."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
FILES = [ROOT / name for name in ['README.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md']]
for directory in ['extension', 'vivaldi-ui', 'docs']:
    for source in sorted((ROOT / directory).rglob('*')):
        if source.is_symlink():
            raise SystemExit('Symlinks cannot enter a release')
        if not source.is_file():
            continue
        if source.suffix not in {'.js', '.json', '.css', '.png', '.md'} or source.name.startswith('.'):
            raise SystemExit(f'Unexpected release file: {source.relative_to(ROOT)}')
        FILES.append(source)
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
ARCHIVE = OUT / f'youtube-fullscreen-stay-{VERSION}.zip'
with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED) as package:
    for source in FILES:
        if source.is_symlink() or source.stat().st_size > 512 * 1024:
            raise SystemExit('Unexpected release file or size')
        name = (Path(f'youtube-fullscreen-stay-{VERSION}') / source.relative_to(ROOT)).as_posix()
        entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        package.writestr(entry, source.read_bytes())
with zipfile.ZipFile(ARCHIVE) as package:
    assert package.testzip() is None
(OUT / 'SHA256SUMS').write_text(hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() + '  ' + ARCHIVE.name + '\n')
print(f'Built {ARCHIVE.name}: {len(FILES)} allow-listed files, {ARCHIVE.stat().st_size} bytes')
