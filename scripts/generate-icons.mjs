import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - size / 2
      const dy = y + 0.5 - size / 2
      const inside = Math.hypot(dx, dy) < size * 0.38
      const i = row + 1 + x * 3
      if (inside) {
        raw[i] = 15
        raw[i + 1] = 118
        raw[i + 2] = 110
      } else {
        raw[i] = 246
        raw[i + 2] = 238
        raw[i + 1] = 243
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const size of [16, 48, 128]) {
  writeFileSync(`public/icons/icon${size}.png`, png(size))
}
