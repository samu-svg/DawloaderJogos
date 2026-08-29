"""Create a ZIP64 store-only archive of a folder (no recompression)."""
import os
import sys
import zipfile

src, dest = sys.argv[1], sys.argv[2]
os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
    for root, _dirs, files in os.walk(src):
        for name in files:
            full = os.path.join(root, name)
            arc = os.path.relpath(full, src).replace("\\", "/")
            zf.write(full, arc)
