# U盘拷贝项目指南

## 📦 拷贝方式

### 方式一：完整拷贝（简单但文件大）

**直接拷贝整个文件夹**，但建议排除以下大文件夹：

#### ❌ 可以排除的文件夹（节省空间）：
- `node_modules/` - 所有 node_modules 文件夹（体积很大，可以重新安装）
- `frontend/node_modules/` 
- `api-gateway/node_modules/`
- `frontend/dist/` - 构建产物（可以重新构建）
- `output/` - 生成的视频文件
- `video-service/output/`
- `uploads/` - 用户上传的文件
- `api-gateway/uploads/`
- `video-service/uploads/`
- `__pycache__/` - Python 缓存
- `*.log` - 日志文件

#### ✅ 必须拷贝的文件夹：
- `api-gateway/` - 但排除 `node_modules/` 和 `uploads/`
- `frontend/` - 但排除 `node_modules/` 和 `dist/`
- `video-service/` - 但排除 `__pycache__/`、`output/`、`uploads/`
- `启动脚本/`
- `新需求方案和文档/`
- `pinjie/`
- 所有 `.json`、`.js`、`.py`、`.vue`、`.md`、`.bat` 等源代码文件

---

### 方式二：精简拷贝（推荐，文件小）

只拷贝源代码和配置文件，排除所有可重新生成的文件。

---

## 🚀 拷贝后在新电脑上的操作步骤

### 1. 检查环境

确保笔记本已安装：
- ✅ Node.js (v16+)
- ✅ Python (v3.8+)
- ✅ FFmpeg

### 2. 安装依赖

```bash
# 进入项目目录
cd D:\ronghe-platform  # 或你拷贝到的路径

# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend
npm install
cd ..

# 安装 API 网关依赖
cd api-gateway
npm install
cd ..

# 安装视频服务依赖（Python）
cd video-service
pip install -r requirements.txt
cd ..
```

**或者使用一键安装：**
```bash
npm run install:all
```

### 3. 配置环境变量

```bash
# 复制示例配置文件
copy env.example .env
```

编辑 `.env` 文件，配置：
- 端口（如果被占用）
- API 密钥（如果需要）
- 其他配置

### 4. VideoGenerator 与 FFmpeg 路径

- **`video_generator.py`** 已随仓库放在 **`video-service/vendor/ffmpeg/`**，一般**无需再改 `app.py`**。
- 若需使用本机另一份 `video_generator.py`，可设置环境变量 **`VIDEO_GENERATOR_DIR`** 指向包含该文件的目录。
- **FFmpeg 可执行文件**需安装并加入系统 PATH（或按 `video-service/README.md` 使用 `FFMPEG_PATH` 等说明）。

#### 修改启动脚本中的路径（如果有硬编码）：

检查以下文件，修改其中的路径：
- `start_all_services.bat`
- `启动脚本/启动服务.bat`
- `video-service/start.bat`

**或者直接使用 `start_demo.bat`**（已使用相对路径，不需要修改）

### 5. 启动服务

```bash
start_demo.bat
```

或手动启动各个服务。

---

## ⚠️ 注意事项

### 1. 文件路径问题

- 如果项目中有硬编码的绝对路径（如 `D:\ronghe-platform`），需要修改
- `start_demo.bat` 使用相对路径，不需要修改

### 2. 环境变量

- `.env` 文件不会被拷贝（在 `.gitignore` 中）
- 需要在新电脑上重新创建 `.env` 文件

### 3. 依赖安装

- `node_modules` 文件夹很大（可能几GB），建议不拷贝，重新安装
- Python 依赖也需要重新安装

### 4. FFmpeg 路径

- 确保 FFmpeg 已安装
- 修改 `video-service/app.py` 中的 FFmpeg 路径
- 或设置系统环境变量

### 5. 端口占用

- 如果端口被占用，修改 `.env` 文件中的端口配置

---

## 📊 文件大小估算

### 完整拷贝（包含 node_modules）：
- 可能 **5-10 GB** 或更大

### 精简拷贝（排除 node_modules）：
- 大约 **50-200 MB**（取决于你的文档和上传文件）

---

## 💡 推荐方案

**建议使用精简拷贝：**

1. 拷贝时排除 `node_modules/`、`output/`、`uploads/` 等大文件夹
2. 在新电脑上运行 `npm install` 重新安装依赖
3. 这样文件小，传输快，而且依赖版本更准确

---

## 🔧 快速检查清单

拷贝完成后，在新电脑上：

- [ ] 安装 Node.js、Python、FFmpeg
- [ ] 运行 `npm install` 安装依赖
- [ ] 创建 `.env` 文件
- [ ] 确认 `video-service/vendor/ffmpeg/video_generator.py` 存在（或使用 `VIDEO_GENERATOR_DIR`）
- [ ] 运行 `start_demo.bat` 测试

---

**祝迁移顺利！** 🎉

