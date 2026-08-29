"""Read Xbox 360 Title ID from default.xex (XEX2 execution info header)."""
import os
import struct
import sys


def title_id_from_xex(path: str) -> str | None:
    with open(path, "rb") as f:
        data = f.read(min(os.path.getsize(path), 2_000_000))
    if data[:4] != b"XEX2":
        return None
    opt_count = struct.unpack(">I", data[20:24])[0]
    exec_off = None
    for i in range(opt_count):
        off = 24 + i * 8
        hid, val = struct.unpack(">II", data[off : off + 8])
        if hid == 0x00040006:
            exec_off = val
            break
    if exec_off is None:
        return None
    tid = struct.unpack(">I", data[exec_off + 0x0C : exec_off + 0x10])[0]
    return f"{tid:08X}"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: read-xex-titleid.py <path-to-default.xex>", file=sys.stderr)
        sys.exit(1)
    tid = title_id_from_xex(sys.argv[1])
    if not tid:
        sys.exit(2)
    print(tid)
