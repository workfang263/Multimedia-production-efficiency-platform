#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FFmpeg 批量视频生成工具
支持用户上传任意数量图片，选择固定组合，自动生成所有排列的视频
"""

import os
import sys
import subprocess
import itertools
from pathlib import Path
from typing import List, Tuple
import json

class VideoGenerator:
    def __init__(self):
        self.fixed_dir = "images/fixed"
        self.variable_dir = "images/variable"
        self.output_dir = "output"
        self.config_file = "config.json"
        self.ffmpeg_path = "ffmpeg"  # 默认路径，会在check_ffmpeg中更新
        self._ffprobe_path = None

    def _get_ffprobe_path(self) -> str:
        """推断 ffprobe 的路径"""
        if self._ffprobe_path:
            return self._ffprobe_path
        ffmpeg_basename = os.path.basename(self.ffmpeg_path).lower()
        if "ffmpeg" in ffmpeg_basename:
            ffprobe_candidate = self.ffmpeg_path.replace("ffmpeg", "ffprobe")
            if os.path.exists(ffprobe_candidate):
                self._ffprobe_path = ffprobe_candidate
                return self._ffprobe_path
        # 备用：尝试系统路径
        self._ffprobe_path = "ffprobe"
        return self._ffprobe_path

    def get_media_duration(self, file_path: str) -> float:
        """使用 ffprobe 获取媒体文件时长（秒）。失败时返回 None"""
        if not file_path or not os.path.exists(file_path):
            return None
        ffprobe_path = self._get_ffprobe_path()
        try:
            result = subprocess.run(
                [
                    ffprobe_path,
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=nokey=1:noprint_wrappers=1",
                    file_path
                ],
                capture_output=True,
                text=True,
                check=True
            )
            duration_str = result.stdout.strip()
            if duration_str:
                return float(duration_str)
        except (subprocess.CalledProcessError, ValueError, FileNotFoundError):
            pass
        return None
        
    def check_ffmpeg(self):
        """检查FFmpeg是否安装"""
        # 尝试多个可能的FFmpeg路径
        ffmpeg_paths = [
            "ffmpeg",  # 系统PATH中的ffmpeg
            r"C:\ffmpeg\ffmpeg-8.0-essentials_build\bin\ffmpeg.exe",  # 手动安装的路径
            r"C:\ffmpeg\bin\ffmpeg.exe",  # 其他可能的路径
        ]
        
        for ffmpeg_path in ffmpeg_paths:
            try:
                subprocess.run([ffmpeg_path, "-version"], capture_output=True, check=True)
                print(f"[OK] FFmpeg 已安装: {ffmpeg_path}")
                self.ffmpeg_path = ffmpeg_path
                return True
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        
        print("[Error] 错误：未找到FFmpeg，请先安装FFmpeg")
        print("下载地址：https://ffmpeg.org/download.html")
        return False
    
    def setup_directories(self):
        """创建必要的目录"""
        os.makedirs(self.fixed_dir, exist_ok=True)
        os.makedirs(self.variable_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"[OK] 已创建目录：{self.fixed_dir}、{self.variable_dir} 和 {self.output_dir}")
    
    def get_image_files(self, directory: str) -> List[str]:
        """获取指定目录的图片文件列表"""
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        images = []
        
        if os.path.exists(directory):
            for file in os.listdir(directory):
                if Path(file).suffix.lower() in image_extensions:
                    images.append(file)
        
        return sorted(images)
    
    def get_fixed_images(self) -> List[str]:
        """获取固定部分图片"""
        return self.get_image_files(self.fixed_dir)
    
    def get_variable_images(self) -> List[str]:
        """获取可变部分图片"""
        return self.get_image_files(self.variable_dir)
    
    def display_images(self, images: List[str]):
        """显示图片列表"""
        print("\n[Image] 当前图片列表：")
        print("=" * 50)
        for i, img in enumerate(images, 1):
            print(f"{i:2d}. {img}")
        print("=" * 50)
    
    def get_user_selection(self, images: List[str], prompt: str) -> List[str]:
        """获取用户选择的图片"""
        while True:
            try:
                print(f"\n{prompt}")
                print("请输入图片编号（用逗号分隔，如：1,3,5）：")
                selection = input(">>> ").strip()
                
                if not selection:
                    return []
                
                indices = [int(x.strip()) for x in selection.split(',')]
                selected_images = []
                
                for idx in indices:
                    if 1 <= idx <= len(images):
                        selected_images.append(images[idx-1])
                    else:
                        print(f"[Error] 错误：编号 {idx} 超出范围")
                        return []
                
                return selected_images
            except ValueError:
                print("[Error] 错误：请输入有效的数字")
            except KeyboardInterrupt:
                print("\n\n[Exit] 程序已退出")
                sys.exit(0)
    
    def generate_rotation_videos(self, variable_images: List[str], fixed_images: List[str]) -> List[List[str]]:
        """生成轮换视频：每张可变图片作为开头，固定图片按顺序跟随"""
        video_sequences = []
        
        # 为每张可变图片生成一个视频序列
        for start_image in variable_images:
            # 创建以当前可变图片开头的序列，仅保留该图片和全部固定部分
            sequence = [start_image]

            # 添加所有固定图片（按顺序）
            sequence.extend(fixed_images)

            video_sequences.append(sequence)
        
        return video_sequences
    
    def create_video(self, variable_images: List[str], fixed_images: List[str], output_name: str, duration: float = 0.7, music_file: str = None, background_file: str = None, blur_background: bool = False, background_video_file: str = None):
        """使用FFmpeg创建9:16比例的竖屏视频"""
        input_files = []
        filter_complex = []
        
        # 构建完整的图片序列：可变部分 + 固定部分
        image_sequence = variable_images + fixed_images
        
        # 使用更高效的方法处理大量图片
        print(f"[Stats] 处理 {len(image_sequence)} 张图片")
        
        # 为每张图片创建临时视频片段，然后合并
        temp_videos = []
        has_background_image = bool(background_file and os.path.exists(background_file))
        has_background_video = bool(background_video_file and os.path.exists(background_video_file))
        use_background = has_background_image or has_background_video
        for i, img in enumerate(image_sequence):
            # 确定图片路径 - 使用绝对路径
            if not fixed_images:
                img_path = os.path.abspath(os.path.join(self.variable_dir, img))
            else:
                if i < len(variable_images):
                    img_path = os.path.abspath(os.path.join(self.variable_dir, img))
                else:
                    img_path = os.path.abspath(os.path.join(self.fixed_dir, img))
            
            # 检查图片文件是否存在
            if not os.path.exists(img_path):
                print(f"[Error] 图片文件不存在: {img_path}")
                continue
            
            # 为每张图片创建临时视频文件 - 使用绝对路径
            temp_video = os.path.abspath(os.path.join(self.output_dir, f"temp_{i}_{output_name}.mp4"))
            temp_videos.append(temp_video)
            print(f"[Debug] 创建临时文件: {temp_video}")
            
            # 创建单张图片的视频片段（明确禁用音频，确保只有视频流）
            if use_background:
                vf_chain = [
                    "scale=1080:1920:force_original_aspect_ratio=decrease",
                    "setsar=1",
                    "fps=30"
                ]
            else:
                vf_chain = [
                    "scale=1080:1920:force_original_aspect_ratio=decrease",
                    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black",
                    "setsar=1",
                    "fps=30"
                ]

            single_img_cmd = [
                self.ffmpeg_path, "-y",
                "-loop", "1", "-t", str(duration),
                "-i", img_path,
                "-vf", ",".join(vf_chain),
                "-c:v", "libx264",
                "-an",  # 明确禁用音频，确保临时视频只有视频流，不会影响最终音频
                "-pix_fmt", "yuv420p",
                temp_video
            ]
            
            try:
                subprocess.run(single_img_cmd, capture_output=True, text=True, check=True, timeout=60)
            except subprocess.TimeoutExpired:
                print(f"[Warn] 图片 {i+1} 处理超时，跳过")
                continue
            except subprocess.CalledProcessError as e:
                print(f"[Warn] 图片 {i+1} 处理失败: {e.stderr}")
                continue
        
        # 创建文件列表用于concat - 使用绝对路径
        concat_file = os.path.abspath(os.path.join(self.output_dir, f"concat_{output_name}.txt"))
        with open(concat_file, 'w', encoding='utf-8') as f:
            for temp_video in temp_videos:
                if os.path.exists(temp_video):
                    # 使用绝对路径
                    abs_path = os.path.abspath(temp_video)
                    f.write(f"file '{abs_path}'\n")
                    print(f"[Debug] 添加到concat: {abs_path}")
        
        # 使用concat合并所有视频片段
        # concat demuxer 默认只处理视频流（因为临时视频已经使用 -an 禁用了音频）
        # 但为了确保，我们在concat时明确指定只映射视频流
        input_files = ["-f", "concat", "-safe", "0", "-i", concat_file]
        
        # 计算视频总时长
        total_duration = len(image_sequence) * duration
        
        # 添加背景图片
        background_input_index = None
        if background_file and os.path.exists(background_file):
            input_files.extend(["-loop", "1", "-i", background_file])
            background_input_index = 1
        
        # 添加背景视频
        background_video_input_index = None
        if background_video_file and os.path.exists(background_video_file):
            input_files.extend(["-i", background_video_file])
            background_video_input_index = 1 + (1 if background_input_index is not None else 0)
        
        # 添加背景音乐
        music_input_index = None
        if music_file and os.path.exists(music_file):
            input_files.extend(["-i", music_file])
            music_input_index = 1 + (1 if background_input_index is not None else 0) + (1 if background_video_input_index is not None else 0)
        
        print(f"[Debug] 处理模式：总时长 {total_duration} 秒，背景图片={background_input_index}, 背景视频={background_video_input_index}, 音乐={music_input_index}")
        
        # 初始化filter_complex列表
        filter_complex = []
        
        # 处理背景图/视频，优先使用背景视频
        background_label = None
        if background_video_input_index is not None:
            filter_complex.append(
                f"[{background_video_input_index}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                f"crop=1080:1920,setpts=PTS-STARTPTS,setsar=1,loop=loop=-1:size=100,"
                f"trim=duration={total_duration},fps=30[bg_video]"
            )
            background_label = "[bg_video]"
        elif background_input_index is not None:
            blur_filter = ",gblur=sigma=3" if blur_background else ""
            filter_complex.append(
                f"[{background_input_index}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                f"crop=1080:1920{blur_filter},setpts=PTS-STARTPTS,setsar=1,"
                f"loop=loop=-1:size=100,trim=duration={total_duration},fps=30[bg_image]"
            )
            background_label = "[bg_image]"
        
        # 主视频流（来自concat）
        main_video = "0:v"
        
        if background_label:
            foreground_scale = 0.85
            filter_complex.append(
                f"[{main_video}]scale=iw*{foreground_scale}:ih*{foreground_scale}:flags=lanczos,setsar=1[fg_scaled]"
            )
            filter_complex.append(f"{background_label}[fg_scaled]overlay=(W-w)/2:(H-h)/2:shortest=1[final_video]")
            final_video = "[final_video]"
        else:
            final_video = main_video
        
        if use_background:
            print(f"[Debug] 使用背景: {background_label}, 滤镜链: {';'.join(filter_complex)}")
        else:
            print(f"[Debug] 未使用背景，滤镜链: {';'.join(filter_complex)}")
        
        # 处理背景音乐
        audio_filter = None
        if music_input_index is not None:
            music_duration = self.get_media_duration(music_file)
            pad_duration = 0.0
            if music_duration is not None:
                pad_duration = max(total_duration - music_duration, 0.0)
                print(
                    f"[Music] 音频处理：索引={music_input_index}, 视频总时长={total_duration}秒, 音乐文件={music_file}, "
                    f"原始音乐时长≈{round(music_duration, 2)}秒, 需补静音 {round(pad_duration, 2)}秒"
                )
            else:
                print(
                    f"[Music] 音频处理：索引={music_input_index}, 视频总时长={total_duration}秒, 音乐文件={music_file}, "
                    "原始音乐时长未知，默认不循环"
                )

            filter_chain = [f"[{music_input_index}:a]asetpts=PTS-STARTPTS", "aresample=44100"]
            if pad_duration > 0.0:
                filter_chain.append(f"apad=pad_dur={total_duration}")
            filter_chain.append(f"atrim=0:{total_duration}")
            audio_filter = ",".join(filter_chain) + "[music]"
            filter_complex.append(audio_filter)
            print(f"[Music] 音频将连续播放 {total_duration} 秒，不会每张图片重置")
        
        # 构建输出映射
        # FFmpeg 支持直接使用 filter_complex 输出的标签（带方括号）作为 -map 参数
        # 或者使用输入流标识符（如 "0:v"）
        if music_input_index is not None:
            # 有音乐：映射视频流和音频流
            if final_video.startswith("["):
                output_mapping = ["-map", final_video, "-map", "[music]"]
            else:
                output_mapping = ["-map", "0:v", "-map", "[music]"]
        else:
            # 无音乐：只映射视频流
            if final_video.startswith("["):
                output_mapping = ["-map", final_video]
            else:
                output_mapping = ["-map", "0:v"]
        
        output_path = os.path.abspath(os.path.join(self.output_dir, f"{output_name}.mp4"))
        
        cmd = [
            self.ffmpeg_path,
            "-y",  # 覆盖输出文件
            *input_files,
        ]
        print(f"[Debug] FFmpeg 输入参数: {input_files}")
        # 仅当存在滤镜时再添加 -filter_complex
        if filter_complex:
            cmd.extend(["-filter_complex", ";".join(filter_complex)])
        cmd.extend([
            *output_mapping,
            "-c:v", "libx264",
            "-preset", "fast",  # 使用更快的编码预设
            "-crf", "28",  # 稍微降低质量以提高速度
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-threads", "4",  # 限制线程数
        ])
        
        # 添加音频编码参数（如果有音乐）
        if music_input_index is not None:
            cmd.extend([
                "-c:a", "aac",  # 音频编码为 AAC
                "-b:a", "192k",  # 音频比特率 192kbps（高质量）
                "-ar", "44100",  # 音频采样率 44.1kHz
                "-ac", "2",  # 立体声
            ])
        
        # 添加时长限制（确保输出时长正确）
        # 注意：不使用 -shortest，因为我们已经通过 atrim 确保音频时长与视频一致
        cmd.extend([
            "-t", str(total_duration),  # 明确指定输出时长
            output_path
        ])
        
        try:
            print(f"[Video] 正在生成视频：{output_name}.mp4")
            print(f"[Debug] FFmpeg命令前8个参数：{' '.join(cmd[:8])}")
            print(f"[Debug] 输出映射：{' '.join(output_mapping)}")
            if music_input_index is not None:
                print(f"[Music] 音频编码参数：-c:a aac -b:a 192k -ar 44100 -ac 2")
            print(f"[Debug] 预计处理时间：{total_duration}秒视频，约需{total_duration//2}秒")
            
            # 减少超时时间到3分钟
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=180)
            print(f"[OK] 视频生成成功：{output_path}")
            
            # 清理临时文件
            self.cleanup_temp_files(temp_videos, concat_file)
            return True
        except subprocess.TimeoutExpired:
            print(f"[Error] 视频生成超时：{output_name} (超过3分钟)")
            self.cleanup_temp_files(temp_videos, concat_file)
            return False
        except subprocess.CalledProcessError as e:
            print(f"[Error] 视频生成失败：{output_name}")
            print(f"错误信息：{e.stderr}")
            self.cleanup_temp_files(temp_videos, concat_file)
            return False
    
    def cleanup_temp_files(self, temp_videos, concat_file):
        """清理临时文件"""
        try:
            # 删除临时视频文件
            for temp_video in temp_videos:
                if os.path.exists(temp_video):
                    os.remove(temp_video)
            
            # 删除concat文件
            if os.path.exists(concat_file):
                os.remove(concat_file)
            
            print("[Clean] 已清理临时文件")
        except Exception as e:
            print(f"[Warn] 清理临时文件失败: {e}")
    
    def save_config(self, prefix_images: List[str], fixed_images: List[str], duration: float):
        """保存配置到文件"""
        # 计算组合数，避免内存溢出
        if prefix_images:
            if len(prefix_images) <= 10:  # 只有图片数量较少时才计算排列数
                total_combinations = len(list(itertools.permutations(prefix_images)))
            else:
                total_combinations = len(prefix_images)  # 轮换模式：n张图片生成n个视频
        else:
            total_combinations = 1
            
        config = {
            "prefix_images": prefix_images,
            "fixed_images": fixed_images,
            "duration": duration,
            "total_combinations": total_combinations
        }
        
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        print(f"[OK] 配置已保存到 {self.config_file}")
    
    def load_config(self):
        """加载配置"""
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def show_usage_guide(self):
        """显示使用指南"""
        print("""
[Video] FFmpeg 批量视频生成工具使用指南
=====================================

[Steps] 使用步骤：
1. 将固定部分图片放入 'images/fixed' 文件夹（可选）
2. 将可变部分图片放入 'images/variable' 文件夹
3. 运行程序，程序自动读取两个文件夹的图片
4. 程序自动生成轮换视频（每张图片作为开头）

[Path] 目录结构：
├── images/
│   ├── fixed/        # 固定部分图片（视频结尾）
│   └── variable/     # 可变部分图片（视频开头）
├── output/           # 生成的视频输出目录
├── config.json       # 配置文件
└── video_generator.py

[Tip] 轮换模式：
- 每张图片都会作为开头生成一个视频
- 其余图片按固定顺序跟随
- n张图片生成n个视频

[Config] 支持的图片格式：JPG, PNG, BMP, TIFF, WEBP
[Camera] 输出格式：MP4 (H.264编码)
[Mobile] 视频比例：9:16 (竖屏，适合手机观看)
[Image] 分辨率：1080x1920 (自动适配并居中)
        """)
    
    def run(self):
        """主程序运行"""
        print("[Video] FFmpeg 批量视频生成工具")
        print("=" * 40)
        
        # 检查FFmpeg
        if not self.check_ffmpeg():
            return
        
        # 创建目录
        self.setup_directories()
        
        # 显示使用指南
        self.show_usage_guide()
        
        # 获取固定部分图片
        fixed_images = self.get_fixed_images()
        
        # 获取可变部分图片
        variable_images = self.get_variable_images()
        if not variable_images:
            print(f"[Error] 在 {self.variable_dir} 目录中未找到图片文件")
            print("请将可变部分的图片文件放入该目录后重新运行")
            return
        
        # 处理固定部分为空的情况
        if not fixed_images:
            print(f"[Warn]  {self.fixed_dir} 目录为空，将使用可变部分图片进行轮播")
            print(f"[OK] 找到 {len(variable_images)} 张可变图片")
            self.display_images(variable_images)
            
            # 显示图片组合说明
            print("\n" + "="*50)
            print("[Note] 图片组合说明：")
            print(f"[Video] 可变部分（{len(variable_images)}张）：将生成所有排列组合进行轮播")
            
            # 如果图片数量较多，提供快速测试选项
            if len(variable_images) > 5:
                print(f"\n[Tip] 提示：您有 {len(variable_images)} 张图片，建议先进行快速测试")
                test_choice = input("是否使用前5张图片进行快速测试？(y/N): ").lower()
                if test_choice == 'y':
                    variable_images = variable_images[:5]
                    print(f"[OK] 已选择前5张图片进行测试：{variable_images}")
        else:
            print(f"[OK] 找到 {len(fixed_images)} 张固定图片")
            self.display_images(fixed_images)
            print(f"[OK] 找到 {len(variable_images)} 张可变图片")
            self.display_images(variable_images)
            
            # 显示图片组合说明
            print("\n" + "="*50)
            print("[Note] 图片组合说明：")
            print(f"[Target] 固定部分（{len(fixed_images)}张）：将按顺序作为视频结尾")
            print(f"[Video] 可变部分（{len(variable_images)}张）：将生成所有排列组合作为视频开头")
            
            # 如果图片数量较多，提供快速测试选项
            if len(variable_images) > 5:
                print(f"\n[Tip] 提示：您有 {len(variable_images)} 张可变图片，建议先进行快速测试")
                test_choice = input("是否使用前5张图片进行快速测试？(y/N): ").lower()
                if test_choice == 'y':
                    variable_images = variable_images[:5]
                    print(f"[OK] 已选择前5张图片进行测试：{variable_images}")
        
        # 设置每张图片显示时长
        try:
            duration = float(input("\n[Timer]  请输入每张图片显示时长（秒，默认0.7）：") or "0.7")
        except ValueError:
            duration = 0.7
        
        # 生成轮换视频
        video_sequences = self.generate_rotation_videos(variable_images, fixed_images)
        
        print(f"\n[Stats] 将生成 {len(video_sequences)} 个视频（轮换模式）：")
        for i, sequence in enumerate(video_sequences, 1):
            print(f"  {i}. {' → '.join(sequence)}")
        
        # 确认生成
        confirm = input(f"\n[Confirm] 确认生成 {len(video_sequences)} 个视频？(y/N)：").lower()
        if confirm != 'y':
            print("[Exit] 已取消生成")
            return
        
        # 生成视频
        print(f"\n[Start] 开始生成视频...")
        success_count = 0
        total_videos = len(video_sequences)
        
        for i, sequence in enumerate(video_sequences, 1):
            # 显示进度
            progress = (i / total_videos) * 100
            print(f"[Progress] 进度: {i}/{total_videos} ({progress:.1f}%) - 正在生成视频 {i}")
            
            # 使用首张图片的名称作为视频文件名
            first_image_name = sequence[0].split('.')[0]  # 去掉扩展名
            video_name = first_image_name
            
            # 分离可变部分和固定部分
            if not fixed_images:
                # 如果固定部分为空，整个序列都是可变部分
                if self.create_video(sequence, [], video_name, duration):
                    success_count += 1
            else:
                # 正常情况：分离可变部分和固定部分
                var_part = [img for img in sequence if img in variable_images]
                fixed_part = [img for img in sequence if img in fixed_images]
                if self.create_video(var_part, fixed_part, video_name, duration):
                    success_count += 1
        
        # 保存配置
        self.save_config(variable_images, fixed_images, duration)
        
        print(f"\n[Success] 完成！成功生成 {success_count}/{len(video_sequences)} 个视频")
        print(f"[Path] 视频保存在：{os.path.abspath(self.output_dir)}")

if __name__ == "__main__":
    generator = VideoGenerator()
    generator.run()
