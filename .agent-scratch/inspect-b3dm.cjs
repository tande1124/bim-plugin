// Unpacks a b3dm -> glb, dumps glTF JSON summary (asset, extensions, materials, textures, images).
const fs = require('fs')
const path = require('path')

function unpackB3dm(buf) {
  const magic = buf.toString('ascii', 0, 4)
  if (magic !== 'b3dm') throw new Error('not b3dm: ' + magic)
  const byteLength = buf.readUInt32LE(8)
  const ftJsonLen = buf.readUInt32LE(12)
  const ftBinLen = buf.readUInt32LE(16)
  const btJsonLen = buf.readUInt32LE(20)
  const btBinLen = buf.readUInt32LE(24)
  const glbStart = 28 + ftJsonLen + ftBinLen + btJsonLen + btBinLen
  const glb = buf.slice(glbStart, byteLength)
  if (glb.toString('ascii', 0, 4) !== 'glTF') throw new Error('no glb inside')
  const glbLen = glb.readUInt32LE(12)
  const json = JSON.parse(parseGlbChunk(glb, 0x4e4f534a).toString('utf8'))
  let binChunk = null
  try { binChunk = parseGlbChunk(glb, 0x004e4942) } catch {}
  return { json, glb, binChunk, glbLen }
}

function parseGlbChunk(glb, wantedType) {
  let off = 12 // skip glTF header
  while (off + 8 <= glb.length) {
    const len = glb.readUInt32LE(off)
    const type = glb.readUInt32LE(off + 4)
    const data = glb.slice(off + 8, off + 8 + len)
    if (type === wantedType) return data
    off += 8 + len + (len % 4)
  }
  throw new Error('chunk not found ' + wantedType.toString(16))
}

const file = process.argv[2]
const buf = fs.readFileSync(file)
const { json } = unpackB3dm(buf)
const s = json
const imgSummary = (s.images || []).map((im, i) => {
  if (im.bufferView !== undefined) {
    const bv = s.bufferViews[im.bufferView]
    const mime = im.mimeType || '?'
    const len = bv.byteLength
    return `img[${i}] bufferView mime=${mime} len=${len}`
  }
  return `img[${i}] uri=${String(im.uri).slice(0, 60)}`
})
console.log('=== file:', path.basename(file))
console.log('asset:', JSON.stringify(s.asset))
console.log('extensionsUsed:', JSON.stringify(s.extensionsUsed), 'extensionsRequired:', JSON.stringify(s.extensionsRequired))
console.log('meshes:', (s.meshes || []).length, 'materials:', (s.materials || []).length,
  'textures:', (s.textures || []).length, 'images:', (s.images || []).length,
  'accessors:', (s.accessors || []).length)
;(s.materials || []).slice(0, 6).forEach((m, i) => {
  console.log(`material[${i}]:`, JSON.stringify(m).slice(0, 400))
})
;(s.textures || []).slice(0, 4).forEach((t, i) => {
  console.log(`texture[${i}]:`, JSON.stringify(t).slice(0, 200))
})
;(s.images || []).slice(0, 4).forEach((im, i) => {
  console.log(`image[${i}]:`, JSON.stringify(im).slice(0, 200))
})
;(s.samplers || []).slice(0, 3).forEach((sp, i) => {
  console.log(`sampler[${i}]:`, JSON.stringify(sp))
})
imgSummary.slice(0, 8).forEach((l) => console.log('  ', l))
