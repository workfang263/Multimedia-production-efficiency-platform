# Ronghe Platform：Docker Compose 部署说明（学习向）

> **安全提示**：请勿把真实公网 IP、域名、密码、API Key 写进本仓库；公网访问请在服务器本地 **`.env`** 中配置（该文件已被 `.gitignore` 忽略）。文档与 `env.example` 中一律使用占位符（如 `YOUR_PUBLIC_IP`）。

## 这套文件在解决什么问题？

1. **一次定义、重复执行**  
   `docker-compose.yml` 把 MySQL、网关、视频服务、图床、Nginx 的镜像/构建方式、环境变量、依赖顺序写在一起。你在任意机器上只要 `docker compose up -d`，得到的是同一套拓扑。

2. **网络与主机名**  
   容器里访问 MySQL 时，主机名写 **`mysql`**（compose 里的服务名），不要写 `127.0.0.1`。原因：每个容器有独立网络命名空间，`127.0.0.1` 指向自己，而不是宿主机或其它容器。Docker Compose 会为这些服务创建默认网络，并用内置 DNS 把 `mysql` 解析到 MySQL 容器的 IP。

3. **为何 Nginx 单独一个容器**  
   默认把宿主 **8081** 映射到容器内 **80**（`8081:80`），**宿主 80 可留给其他项目**；访问 **`http://IP:8081`**。Nginx 负责：静态 `dist`、把 `/api` 转到网关。网关不直接暴露给公网也可以（当前 compose 里网关只有 `expose`，没有 `ports`，外网只打 Nginx）。

4. **为何 MySQL 要 `healthcheck` + `depends_on: condition: service_healthy`**  
   应用容器若比数据库先启动，第一次连库会失败。健康检查通过后，再启动依赖方，减少「启动竞态」。

5. **为何 Node 镜像里用 `npm ci --omit=dev`**  
   生产镜像不需要 devDependencies，镜像更小、攻击面更小；`ci` 依据 lock 文件可复现构建。

6. **为何 Python 用 gunicorn**  
   Flask 内置服务器单进程、不适合生产。gunicorn 作为 WSGI 服务器，可配置 worker 与超时（视频处理往往耗时较长，`--timeout 300`）。

## 你需要自行对齐的两处（否则易 502）

1. **Nginx `location /api/` 与 Express 路由**  
   若网关实际没有 `/api` 前缀，需要改 `nginx/default.conf.template` 里 `proxy_pass` 与 `location`，使路径与后端一致。

2. **video-service 的 gunicorn 入口**  
   `Dockerfile` 默认 `app:app`。若你的 Flask 实例在别的文件或变量名不同，修改 `CMD` 最后一段。

3. **CORS 与公网访问**  
   用 **`http://服务器公网IP:8081`** 打开前端时，浏览器对 **POST** 等请求会带 **`Origin`**（含端口 **8081**）。`api-gateway` 默认白名单只有 localhost、部分内网；未包含时会 **403**。请在项目根 **`.env`** 中设置 **`CORS_EXTRA_ORIGINS=http://你的IP:8081`**（若同一 IP 还有无端口访问可一并写上，多个用英文逗号）。修改 **`.env` 或网关代码后**需 **`docker compose up -d --build api-gateway`**。网关已用 **`URL.origin`** 归一化比较，**`http://IP` 与 `http://IP:80` 视为同一来源**，但 **`http://IP:8081` 需单独写入**（端口不同则 Origin 不同）。

4. **video-service 的外部模块 `video_generator`**  
   该模块不在本仓库内。部署到 Docker 后，请将本机 `video_generator.py` 所在目录同步到 **`video-service/vendor/ffmpeg/`**（使存在 `vendor/ffmpeg/video_generator.py`），或在 compose 中为 `video-service` 设置环境变量 **`VIDEO_GENERATOR_DIR`**。详见 **`video-service/vendor/README.md`**。未配置时容器可启动，但视频相关接口会返回错误。

5. **拼图「生成并上传外链」报左侧图片不存在**  
   素材由网关 `fetch-image` 写入 **api-gateway** 容器内 `/app/public/temp`，而拼接在 **video-service** 内读盘。两容器文件系统默认不共享，需在 **`docker-compose.yml`** 中为二者挂载同一命名卷到 **`/app/public/temp`**，并设置 **`STITCH_TEMP_DIR=/app/public/temp`**（仓库已配置）。更新后执行 **`docker compose up -d --build`**。这与是否填写图床无关；图床用于上传成品外链，前提是本地拼接已成功写出文件。

6. **图片拼接缩略图不显示（`/temp/...` 裂开）**  
   批量添加 URL 后，前端用 **`/temp/会话ID/文件名`** 做预览，文件实际在 **api-gateway** 容器内。Nginx 若只配了 **`/api/`** 反代、未把 **`/temp/`** 转到网关，浏览器请求会落到 **`try_files` → `index.html`**，`<img>` 收到的是 HTML，缩略图全裂。仓库内 **`nginx/default.conf.template`** 已增加 **`location /temp/`**（及 **`/uploads/`**）反代到 **`api-gateway`**；修改后需 **`docker compose restart nginx`**（或 `up -d` 重载配置）。

## 建议由你执行的命令（不在此自动执行）

```bash
cd /path/to/ronghe-platform   # 换成你机器上的项目目录，勿在文档中写死服务器路径
cp env.example .env
# 编辑 .env：强密码、CORS_EXTRA_ORIGINS（公网访问时填 http://你的公网IP:8081，勿提交 .env）

docker compose build
docker compose up -d
docker compose ps
```

验证：

```bash
curl -I http://127.0.0.1:8081/
docker compose logs --tail=50 api-gateway
```

若 `frontend/dist` 不存在，Nginx 会 403/404，请先按 `frontend/README.md` 放置构建产物。

## 云服务器：启停系统、与 Cursor 的关系

### 关 Cursor 会不会把网站关掉？

**不会。**  
Cursor 是你电脑上的**编辑器**；融合平台跑在 **云服务器**的 **Docker 容器**里。关掉 Cursor、合上笔记本，只要**云主机没关机**、**Docker 服务在跑**，别人仍可通过 `http://公网IP:8081` 访问本融合平台站点。

### 在云服务器上怎么「开 / 关」这套系统？

先 SSH 登录服务器，进入项目目录（示例）：

```bash
cd /path/to/ronghe-platform
```

| 目的 | 命令 |
|------|------|
| **启动**（后台运行，常用） | `docker compose up -d` |
| **停止**（停容器，网络与卷默认保留，数据一般在卷里） | `docker compose stop` |
| **停止并删除容器**（卷如 MySQL 数据通常仍保留，除非加 `-v`） | `docker compose down` |
| **看是否在跑** | `docker compose ps` |
| **改代码/`.env` 后重建** | `docker compose up -d --build` |

说明：`docker-compose.yml` 里各服务有 **`restart: unless-stopped`**：容器**进程异常退出**时，Docker 会**自动重启**该容器。若你曾手动 **`docker compose stop`** / **`down`** 停过栈，则不会自动再拉起来，需要再执行 **`docker compose up -d`**。

**云主机整台重启（断电、内核更新）后**：一般会先启动 **Docker 服务**，再按策略恢复**之前处于运行状态且未被「手动停止」**的容器；为保险起见，维护后执行一次 **`docker compose ps`**，若有不齐再 **`docker compose up -d`**。

### 想让程序在云服务器上尽量 24 小时可用，要做啥？

| 要点 | 说明 |
|------|------|
| **程序跑在哪** | 必须跑在**云服务器**上（你已用 `docker compose up -d` 部署）。**你电脑关机不影响**，运营通过浏览器访问 **`http://公网IP:8081`**（或你以后改的映射端口）即可。 |
| **进程挂了谁重启** | 容器内进程崩溃导致容器退出时，**Docker 会按 `restart` 策略重启容器**，一般无需你手工干预。 |
| **Docker 服务要开机自启** | 云服务器重启后，要先有 **Docker 引擎**（`dockerd`）。常见 Linux 上执行：`systemctl enable docker`（多数云镜像已默认 enable）。可用 `systemctl is-enabled docker` 查看。 |
| **机器本身要一直在** | 选**包年包月/按量但长期开**的云主机；避免误关机、欠费停机；内存过小可能导致 OOM 杀进程，可适当升配。 |
| **可选进阶** | 监控告警（磁盘满、容器退出）、定期备份 MySQL 卷、HTTPS 与防火墙；需要「开机必执行某条 compose」时可写 **systemd** 或 **cron @reboot**（非必须，视机房策略而定）。 |

### 之前说的「第 4 点」可能指两种（避免混淆）

1. **若指对话里「上线后还要做的事」列表里的第 4 条**  
   一般指 **备份与运维**：定期备份数据库（`mysql_data` 卷）、重要配置；与 Cursor 无关。

2. **若指本文档前面「你需要自行对齐」里的第 4 条**  
   指的是 **`video_generator` 模块**：视频相关功能依赖 `video-service/vendor/ffmpeg/video_generator.py`；与启停命令无关。

## 自动化测试（Vitest + 冒烟脚本）

### 服务器上没有 `npm` 时（推荐）

只需已安装 **Docker**，在项目根目录执行：

```bash
./scripts/run-frontend-tests-docker.sh   # Vitest（容器内 npm ci + npm run test）
./scripts/run-smoke-docker.sh            # HTTP 冒烟（需 compose 已 up、Nginx 映射宿主 8081）
# 测公网访问时：
SMOKE_BASE_URL=http://你的公网IP:8081 ./scripts/run-smoke-docker.sh
```

首次会拉取 `node:20-alpine` 镜像，属正常现象。

### 本机已安装 Node/npm 时

```bash
cd frontend && npm install && npm run test
npm run test:smoke
```

1. **前端单元测试**  
   验证工具函数等；不依赖业务容器。

2. **整站 HTTP 冒烟**  
   默认探测 `http://127.0.0.1:8081` 的 `/`、`/api/health`、`/api/services/status`、`/api/image-links`。

   退出码 `0` 表示检查通过；`videoGeneration` 非 `healthy` 时会失败，请对照 `docker compose logs video-service`。
