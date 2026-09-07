/**
 * 本地数据静态服务（带 CORS）
 * 用法：node data-server.js
 * 目录下的文件
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 3000
const DATA_DIR = path.resolve(__dirname, '..')

const MIME_TYPES = {
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.b3dm': 'application/octet-stream',
  '.pnts': 'application/octet-stream',
  '.i3dm': 'application/octet-stream',
  '.cmpt': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ktx2': 'image/ktx2',
  '.exr': 'image/x-exr',
  '.hdr': 'image/vnd.radiance',
}

http.createServer((req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const filePath = path.join(DATA_DIR, urlPath)

  // 防止路径穿越
  if (!filePath.startsWith(DATA_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`Not Found: ${urlPath}`)
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    })
    res.end(data)
  })
}).listen(PORT, () => {
  console.log(`数据服务已启动: http://127.0.0.1:${PORT}`)
  console.log(`数据目录: ${DATA_DIR}`)
})
