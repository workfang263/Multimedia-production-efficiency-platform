# VideoGenerator 模块目录

本目录用于存放 **`video_generator.py`**（FFmpeg 批量视频生成核心类），供 `video-service/app.py` 通过 `sys.path` 导入。

## 默认行为

- 仓库已包含一份 **`video_generator.py`**，克隆后即可使用（仍需本机安装 **FFmpeg** 并能在 PATH 中找到，或通过环境变量指定）。
- 若你本机有更新版本，可覆盖本目录中的 `video_generator.py`，或设置环境变量指向其他目录（见下）。

## 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `VIDEO_GENERATOR_DIR` | 包含 `video_generator.py` 的目录的**绝对路径** |
| `FFMPEG_VENDOR_DIR` | 与上一项相同，二选一 |

示例（PowerShell）：

```powershell
$env:VIDEO_GENERATOR_DIR = "D:\my-custom\ffmpeg"
python app.py
```

Docker Compose 中可在 `video-service` 服务的 `environment` 里设置 `VIDEO_GENERATOR_DIR`。

## 与 `VIDEO_GENERATOR_FIXES.md` 的关系

若需按文档修改 GOP、`-shortest` 等，请编辑 **本目录下的** `video_generator.py`（或你通过 `VIDEO_GENERATOR_DIR` 指向的那份）。
