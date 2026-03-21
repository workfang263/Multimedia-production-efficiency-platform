require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OSS = require('ali-oss');
const axios = require('axios');
const os = require('os');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// OSS 客户端
function getOssClient() {
  const region = process.env.OSS_REGION?.startsWith('oss-')
    ? process.env.OSS_REGION
    : process.env.OSS_REGION
      ? `oss-${process.env.OSS_REGION}`
      : 'oss-cn-hangzhou';
  return new OSS({
    region,
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
  });
}

// 生成存储路径：images/2025-03-11/xxx.jpg 或 videos/...
function getObjectKey(filename, type) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = type === 'videos' ? 'videos' : 'images';
  const ext = path.extname(filename) || '.bin';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  return `${dir}/${date}/${name}`;
}

// 生成公网 URL（Bucket 需公共读或使用自定义域名时可替换此处逻辑）
function getPublicUrl(key) {
  const region = process.env.OSS_REGION?.startsWith('oss-')
    ? process.env.OSS_REGION
    : process.env.OSS_REGION
      ? `oss-${process.env.OSS_REGION}`
      : 'oss-cn-hangzhou';
  const bucket = process.env.OSS_BUCKET;
  return `https://${bucket}.${region}.aliyuncs.com/${key}`;
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
}).fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

// POST /api/upload — 上传本地文件
app.post('/api/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        error: 'MISSING_FILE',
        message: err.message || '未检测到文件或解析失败',
      });
    }
    const file = req.files?.file?.[0] || req.files?.image?.[0];
    if (!file) {
      return res.status(400).json({
        error: 'MISSING_FILE',
        message: '请使用字段 file 或 image 上传一个文件',
      });
    }
    const type = req.query.type === 'videos' ? 'videos' : 'images';
    const key = getObjectKey(file.originalname || 'file', type);
    try {
      const client = getOssClient();
      await client.put(key, file.buffer, {
        headers: { 'Content-Type': file.mimetype || 'application/octet-stream' },
      });
      const url = getPublicUrl(key);
      return res.status(200).json({
        url,
        key,
        filename: file.originalname || path.basename(key),
      });
    } catch (e) {
      console.error('OSS upload error:', e);
      return res.status(500).json({
        error: 'UPLOAD_FAILED',
        message: e.message || '上传到 OSS 失败',
      });
    }
  });
});

// POST /api/upload-by-url — 以链接换链
const FETCH_TIMEOUT = 30000;
const MAX_SIZE = 100 * 1024 * 1024;

app.post('/api/upload-by-url', async (req, res) => {
  const { url: singleUrl, urls: multiUrls } = req.body || {};
  const list = singleUrl ? [singleUrl] : Array.isArray(multiUrls) ? multiUrls : null;
  if (!list || list.length === 0) {
    return res.status(400).json({
      error: 'MISSING_URL',
      message: '请提供 body.url 或 body.urls 数组',
    });
  }
  const type = req.query.type === 'videos' ? 'videos' : 'images';
  const results = [];
  const errors = [];
  const client = getOssClient();

  for (const originalUrl of list) {
    if (!originalUrl || typeof originalUrl !== 'string') {
      errors.push({ url: originalUrl, message: '无效的 URL' });
      continue;
    }
    try {
      const resp = await axios.get(originalUrl, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT,
        maxContentLength: MAX_SIZE,
        maxBodyLength: MAX_SIZE,
        validateStatus: () => true,
      });
      if (resp.status !== 200) {
        errors.push({ url: originalUrl, message: `拉取失败: HTTP ${resp.status}` });
        continue;
      }
      const buffer = Buffer.from(resp.data);
      const contentType = resp.headers['content-type'] || 'application/octet-stream';
      const filename = path.basename(new URL(originalUrl).pathname) || 'file';
      const key = getObjectKey(filename, type);
      await client.put(key, buffer, {
        headers: { 'Content-Type': contentType },
      });
      const url = getPublicUrl(key);
      results.push({
        originalUrl,
        url,
        key,
        filename: path.basename(filename) || key.split('/').pop(),
      });
    } catch (e) {
      errors.push({
        url: originalUrl,
        message: e.response ? `HTTP ${e.response.status}` : e.message || '拉取或上传失败',
      });
    }
  }

  if (results.length === 0 && errors.length > 0) {
    return res.status(422).json({
      error: 'UPLOAD_FAILED',
      results: [],
      errors,
    });
  }
  return res.status(200).json({ results, errors });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'oss-upload-service' });
});

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log(`图床后端运行在 http://0.0.0.0:${PORT}`);
  console.log(`本机访问: http://127.0.0.1:${PORT}`);
  console.log(`局域网上传 API: http://${localIP}:${PORT}/api/upload`);
  console.log(`以链接换链 API: http://${localIP}:${PORT}/api/upload-by-url`);
  console.log('');
});
