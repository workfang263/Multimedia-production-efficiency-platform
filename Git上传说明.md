# Git 上传说明

## 📋 .gitignore 文件内容总结

你的 `.gitignore` 文件排除了以下内容：

### 1. 依赖包文件夹（体积大，可重新安装）
- `node_modules/` - 所有 Node.js 依赖包
- `frontend/node_modules/`
- `api-gateway/node_modules/`
- `video-service/node_modules/`

### 2. 构建产物（可重新构建）
- `frontend/dist/` - 前端构建后的文件
- `frontend/build/`
- `*.zip` - 压缩文件

### 3. 输出文件（运行时生成）
- `output/` - 生成的视频文件
- `video-service/output/`
- `*.mp4` - 视频文件

### 4. 上传文件（用户数据）
- `uploads/` - 用户上传的文件
- `api-gateway/uploads/`
- `video-service/uploads/`
- `api-gateway/public/temp/` - 临时文件

### 5. 环境变量文件（敏感信息）
- `.env` - **重要：包含 API 密钥等敏感信息**
- `.env.local`
- `*.env`

### 6. 日志文件（运行时生成）
- `*.log` - 所有日志文件
- `logs/`

### 7. Python 缓存文件
- `__pycache__/` - Python 编译缓存
- `*.pyc` - Python 字节码文件

### 8. 系统文件
- `.DS_Store` - macOS 系统文件
- `Thumbs.db` - Windows 缩略图
- `desktop.ini` - Windows 配置

### 9. 运行时数据文件（用户会话信息）
- `api-gateway/batch_data.json` - 包含 JWT token
- `api-gateway/global_counter.json` - 运行时计数器
- `api-gateway/image_links.json` - 图片链接数据

### 10. IDE 和编辑器文件
- `.vscode/` - VS Code 配置
- `.idea/` - IntelliJ IDEA 配置

### 11. 临时文件
- `*.tmp`、`*.temp`、`*.cache`

---

## ✅ 会被上传到 GitHub 的内容

### 源代码文件
- ✅ 所有 `.js`、`.py`、`.vue`、`.json` 等源代码
- ✅ `package.json`、`requirements.txt` 等配置文件
- ✅ 所有文档（`.md` 文件）
- ✅ 启动脚本（`.bat` 文件）
- ✅ `env.example` - 环境变量示例文件（**重要**）

### 项目结构
- ✅ `api-gateway/` - API 网关代码
- ✅ `frontend/` - 前端代码
- ✅ `video-service/` - 视频服务代码
- ✅ `启动脚本/` - 启动脚本
- ✅ `新需求方案和文档/` - 文档
- ✅ `pinjie/` - 开发文档

---

## ❌ 不应该上传的内容（已通过 .gitignore 排除）

### 🔴 绝对不能上传的敏感信息：
1. **`.env` 文件** - 包含真实的 API 密钥、密码等
2. **`batch_data.json`** - 包含用户 JWT token
3. **`global_counter.json`** - 运行时数据
4. **`image_links.json`** - 用户数据

### 🟡 不应该上传的大文件：
1. **`node_modules/`** - 依赖包（体积大，可重新安装）
2. **`output/`** - 生成的视频文件
3. **`uploads/`** - 用户上传的文件
4. **`*.log`** - 日志文件

---

## 👥 别人使用你的 GitHub 代码需要什么

### 1. 前置要求（必须安装）
- ✅ **Node.js** (v16+) - 运行前端和 API 网关
- ✅ **Python** (v3.8+) - 运行视频服务
- ✅ **FFmpeg** - 视频处理工具
- ✅ **Git** - 克隆代码

### 2. 必须配置的文件

#### `.env` 文件（必须创建）
```bash
# 从示例文件创建
copy env.example .env
```

**需要配置的内容：**
- `PORT` - API 网关端口（默认: 18081）
- `FRONTEND_URL` - 前端地址（默认: http://localhost:18080）
- `VIDEO_GENERATION_URL` - 视频服务地址（默认: http://localhost:19000）
- `IMGFI_API_KEY` - **可选**，如果使用图片外链功能需要
- `SECRET_KEY` - 应用密钥（可以随机生成）
- `JWT_SECRET` - JWT 密钥（可以随机生成）

#### VideoGenerator 路径（通常不必改）
- 核心模块 **`video_generator.py`** 位于 **`video-service/vendor/ffmpeg/`**，已随仓库提供。
- 仅在自定义位置时设置环境变量 **`VIDEO_GENERATOR_DIR`**（指向包含 `video_generator.py` 的目录）。
- **FFmpeg** 仍需在系统中安装并可用（PATH）。

### 3. 安装依赖（必须）
```bash
# 安装 Node.js 依赖
npm install
cd frontend && npm install && cd ..
cd api-gateway && npm install && cd ..

# 安装 Python 依赖
cd video-service
pip install -r requirements.txt
cd ..
```

### 4. 启动服务
```bash
start_demo.bat
```

---

## 📝 上传前检查清单

在 `git add .` 之前，运行 `git status` 检查：

### ✅ 应该看到的文件：
- 源代码文件（`.js`、`.py`、`.vue`）
- 配置文件（`package.json`、`requirements.txt`）
- 文档文件（`.md`）
- `env.example`（环境变量示例）

### ❌ 不应该看到的文件：
- `node_modules/` 文件夹
- `.env` 文件
- `output/`、`uploads/` 文件夹
- `*.log` 文件
- `batch_data.json`、`global_counter.json` 等运行时数据

---

## 🎯 总结

### 你会上传的：
- ✅ 所有源代码
- ✅ 配置文件（`package.json` 等）
- ✅ `env.example`（环境变量模板）
- ✅ 文档和说明

### 你不会上传的（已排除）：
- ❌ `.env`（真实配置，包含敏感信息）
- ❌ `node_modules/`（依赖包，体积大）
- ❌ `output/`、`uploads/`（用户数据）
- ❌ 运行时数据文件（包含用户会话信息）
- ❌ 日志文件

### 别人需要做的：
1. 克隆代码
2. 安装 Node.js、Python、FFmpeg
3. 运行 `npm install` 安装依赖
4. 创建 `.env` 文件（从 `env.example` 复制）
5. 确认 FFmpeg 已安装；如需自定义 VideoGenerator 目录则设置 `VIDEO_GENERATOR_DIR`
6. 启动服务

---

**你的配置是正确的，可以安全上传！** ✅

