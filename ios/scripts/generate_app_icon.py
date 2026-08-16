#!/usr/bin/env python3
import math
import struct
import zlib
from pathlib import Path

W = H = 1024
NAVY = (11, 31, 51)
GOLD = (198, 146, 43)
CREAM = (244, 240, 232)
WHITE = (255, 255, 255)

pixels = bytearray(NAVY * (W * H))

def set_pixel(x, y, color):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        pixels[i:i+3] = bytes(color)

def rect(x0, y0, x1, y1, color):
    x0, y0, x1, y1 = map(int, (x0, y0, x1, y1))
    row = bytes(color) * max(0, x1 - x0)
    for y in range(max(0, y0), min(H, y1)):
        i = (y * W + max(0, x0)) * 3
        pixels[i:i+len(row)] = row[:max(0, min(W, x1) - max(0, x0)) * 3]

def wave(center, amplitude, period, thickness, color, start=140, end=900):
    for x in range(start, end):
        y = int(center + amplitude * math.sin((x - start) * 2 * math.pi / period))
        for yy in range(y - thickness // 2, y + thickness // 2):
            set_pixel(x, yy, color)

# Containers — mirrors the Android navy/gold shipping identity.
rect(275, 305, 425, 430, GOLD)
rect(445, 305, 595, 430, GOLD)
rect(615, 305, 755, 430, GOLD)
rect(360, 450, 510, 575, GOLD)
rect(530, 450, 680, 575, GOLD)

# Ship hull.
for y in range(590, 735):
    t = (y - 590) / 145
    left = int(190 + 100 * t)
    right = int(835 - 75 * t)
    rect(left, y, right, y + 1, CREAM)

# Sea waves.
wave(800, 22, 210, 28, GOLD)
wave(900, 16, 205, 20, WHITE, 195, 840)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)

raw = bytearray()
stride = W * 3
for y in range(H):
    raw.append(0)
    raw.extend(pixels[y * stride:(y + 1) * stride])

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")

out = Path(__file__).resolve().parents[1] / "AlRifaiShipping" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-1024.png"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(png)
print(out)
