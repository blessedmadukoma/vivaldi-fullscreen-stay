#!/usr/bin/env python3
"""Run a pinned, checksum-verified Gitleaks binary. No credentials are used."""
import hashlib
import io
import os
import platform
from pathlib import Path
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
VERSION = "8.30.1"
TARGETS = {
    ("Darwin", "arm64"): ("darwin_arm64", "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"),
    ("Linux", "x86_64"): ("linux_x64", "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"),
}

def binary():
    target = TARGETS.get((platform.system(), platform.machine()))
    if not target:
        raise SystemExit("Pinned Gitleaks binary is not configured for this platform")
    name, digest = target
    cache = ROOT / ".cache" / f"gitleaks-{VERSION}-{name}"
    archive = cache / "download.tar.gz"
    executable = cache / "gitleaks"
    cache.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        url = f"https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_{name}.tar.gz"
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read(30 * 1024 * 1024)
        if hashlib.sha256(data).hexdigest() != digest:
            raise SystemExit("Gitleaks download checksum mismatch")
        archive.write_bytes(data)
    data = archive.read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit("Cached Gitleaks archive checksum mismatch")
    # Extract only the expected regular file, without trusting archive paths.
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as package:
        entry = package.getmember("gitleaks")
        if not entry.isfile() or entry.size > 30 * 1024 * 1024:
            raise SystemExit("Unexpected Gitleaks archive entry")
        executable.write_bytes(package.extractfile(entry).read())
    executable.chmod(0o700)
    return executable

if __name__ == "__main__":
    command = [str(binary()), "git", "--redact", "--no-banner"]
    command += ["--pre-commit", "--staged"] if "--staged" in sys.argv else ["--log-opts=--all"]
    raise SystemExit(subprocess.call(command, cwd=ROOT, env={**os.environ, "GITLEAKS_ENABLE_LOG": "false"}))
