#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import hashlib
import time
import urllib.parse
from datetime import datetime
from qcloud_cos import CosConfig
from qcloud_cos import CosS3Client

def parse_arguments():
    """解析命令行参数，支持多种格式"""
    print(f"Debug: sys.argv = {sys.argv}", file=sys.stderr)
    
    image_path = None
    directory_name = None
    
    # 清理参数：处理转义字符和占位符
    cleaned_args = []
    for arg in sys.argv[1:]:
        if arg:
            # 替换双反斜杠为单反斜杠
            cleaned_arg = arg.replace('\\\\', '\\')
            cleaned_args.append(cleaned_arg)
    
    # 查找图片路径（支持多种模式）
    for arg in cleaned_args:
        # 检查是否是图片文件（根据扩展名）
        if arg.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.awebp')):
            image_path = arg
            print(f"Debug: Found image by extension: {image_path}", file=sys.stderr)
            break
    
    # 如果没有通过扩展名找到，尝试其他方法
    if not image_path:
        for arg in cleaned_args:
            # 检查是否是 Typora 临时图片
            if 'typora-user-images' in arg:
                image_path = arg
                print(f"Debug: Found Typora image: {image_path}", file=sys.stderr)
                break
    
    # 如果仍然没有找到，尝试第一个非占位符参数
    if not image_path and cleaned_args:
        for arg in cleaned_args:
            if arg and not arg.startswith('{'):
                # 假设第一个非占位符参数是图片路径
                image_path = arg
                print(f"Debug: Assuming first non-placeholder is image: {image_path}", file=sys.stderr)
                break
    
    # 查找目录名参数
    if len(cleaned_args) > 1:
        # 尝试找到第二个非图片参数作为目录名
        for arg in cleaned_args[1:]:
            if arg and arg != image_path:
                # 检查是否为Markdown文件
                if arg.lower().endswith(('.md', '.markdown')):
                    directory_name = arg
                    print(f"Debug: Found markdown file as directory source: {directory_name}", file=sys.stderr)
                else:
                    directory_name = arg
                    print(f"Debug: Found directory name: {directory_name}", file=sys.stderr)
                break
    
    return image_path, directory_name

def load_config():
    """加载配置文件"""
    config = {}
    config_paths = [
        os.path.expanduser('~/.typora_upload_config'),
        os.path.expanduser('~/.config/typora_upload_config'),
        'typora_upload_config.txt'
    ]
    
    for config_path in config_paths:
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            if '=' in line:
                                key, value = line.split('=', 1)
                                config[key.strip()] = value.strip()
                print(f"Debug: Loaded config from {config_path}", file=sys.stderr)
                break
            except Exception as e:
                print(f"Debug: Failed to load config {config_path}: {e}", file=sys.stderr)
    
    return config

def extract_dir_from_md_file(md_file_path):
    """从Markdown文件中提取上传目录配置"""
    if not md_file_path or not os.path.exists(md_file_path):
        return None
    
    try:
        with open(md_file_path, 'r', encoding='utf-8') as f:
            # 读取前10行查找配置
            for i in range(10):
                line = f.readline()
                if not line:
                    break
                line = line.strip()
                # 查找 <!-- upload_dir: 目录名 --> 格式的注释
                if line.startswith('<!--') and 'upload_dir:' in line:
                    # 提取目录名
                    import re
                    match = re.search(r'upload_dir:\s*([^->]+)', line)
                    if match:
                        dir_name = match.group(1).strip()
                        print(f"Debug: Found upload_dir in MD file: {dir_name}", file=sys.stderr)
                        return dir_name
    except Exception as e:
        print(f"Debug: Error reading MD file {md_file_path}: {e}", file=sys.stderr)
    
    return None

def find_md_file_from_args():
    """从参数中查找可能的Markdown文件路径"""
    for arg in sys.argv[1:]:
        if not arg or arg.startswith('{') or 'typora-user-images' in arg:
            continue
        # 检查是否是.md文件
        if arg.lower().endswith(('.md', '.markdown')):
            if os.path.exists(arg):
                return arg
            # 也可能是相对路径或文件名
            elif '.' in arg and not os.path.isabs(arg):
                # 尝试在当前目录查找
                cwd = os.getcwd()
                possible_path = os.path.join(cwd, arg)
                if os.path.exists(possible_path):
                    return possible_path
    return None

def extract_dir_from_image_path(image_path):
    """从图片路径中提取上传目录（img/后面的部分）"""
    if not image_path:
        return None
    
    # 标准化路径分隔符为/
    normalized_path = image_path.replace('\\', '/')
    
    # 查找 'img/' 在路径中的位置
    img_index = normalized_path.find('img/')
    if img_index == -1:
        # 尝试 'img\\'（Windows路径）
        img_index = normalized_path.find('img\\')
    
    if img_index != -1:
        # 提取 img/ 后面的部分
        sub_path = normalized_path[img_index + 4:]  # 4 = len('img/')
        # 移除文件名，只保留目录部分
        if '/' in sub_path:
            dir_part = sub_path[:sub_path.rfind('/')]
        elif '\\' in sub_path:
            dir_part = sub_path[:sub_path.rfind('\\')]
        else:
            dir_part = ''  # 只有文件名，没有目录
        
        if dir_part:
            # 返回路径，保持原有的目录结构
            return dir_part.replace('\\', '/')
    
    return None

def get_md_file_name(directory_name=None, config=None, image_path=None):
    """获取目录名"""
    # 1. 优先使用命令行指定的目录名
    if directory_name:
        print(f"Debug: Using specified directory name: {directory_name}", file=sys.stderr)
        # 如果目录名是文件路径，提取文件名（不含扩展名）
        if '.' in directory_name and (os.path.sep in directory_name or '/' in directory_name):
            name = os.path.splitext(os.path.basename(directory_name))[0]
        else:
            name = directory_name
        return name
    
    # 2. 从图片路径中提取 img/ 后面的部分
    if image_path:
        dir_from_img_path = extract_dir_from_image_path(image_path)
        if dir_from_img_path:
            print(f"Debug: Using directory from img/ path: {dir_from_img_path}", file=sys.stderr)
            return dir_from_img_path
    
    # 3. 使用图片所在目录的名称
    if image_path and os.path.exists(image_path):
        dir_name = os.path.dirname(image_path)
        if dir_name:
            # 规范化路径，处理 '.' 和 '..'
            norm_dir = os.path.normpath(dir_name)
            base_dir = os.path.basename(norm_dir)
            if base_dir and base_dir not in ('.', '..'):
                print(f"Debug: Using image directory name: {base_dir}", file=sys.stderr)
                return base_dir
    
    # 4. 尝试从Markdown文件内的注释提取
    md_file_path = find_md_file_from_args()
    if md_file_path:
        dir_from_comment = extract_dir_from_md_file(md_file_path)
        if dir_from_comment:
            return dir_from_comment
        
        # 5. 从文件名自动提取（不含扩展名）
        file_name = os.path.basename(md_file_path)
        name_without_ext = os.path.splitext(file_name)[0]
        print(f"Debug: Using filename as directory: {name_without_ext}", file=sys.stderr)
        return name_without_ext
    
    # 6. 尝试从配置文件获取
    if config and md_file_path:
        doc_name = os.path.basename(md_file_path)
        if doc_name in config:
            print(f"Debug: Found in config: {doc_name} -> {config[doc_name]}", file=sys.stderr)
            return config[doc_name]
    
    # 7. 尝试从环境变量获取
    upload_dir = os.getenv('TYPORA_UPLOAD_DIR')
    if upload_dir:
        print(f"Debug: Using env TYPORA_UPLOAD_DIR: {upload_dir}", file=sys.stderr)
        return upload_dir
    
    # 8. 默认目录
    print(f"Debug: No directory specified, using 'typora_images'", file=sys.stderr)
    return "typora_images"

def upload_to_cos(image_path, md_file_name=None):
    """上传图片到腾讯云COS"""
    secret_id = os.getenv('COS_SECRET_ID')
    secret_key = os.getenv('COS_SECRET_KEY')
    if not secret_id or not secret_key:
        print("Error: COS_SECRET_ID and COS_SECRET_KEY environment variables must be set", file=sys.stderr)
        return 1
    region = 'ap-shanghai'
    bucket = 'image-1304658407'
    
    if not md_file_name:
        md_file_name = "default"
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_str = hashlib.md5(str(time.time()).encode()).hexdigest()[:6]
    ext = os.path.splitext(image_path)[1].lower() or '.png'
    filename = f"{timestamp}_{random_str}{ext}"
    key = f"{md_file_name}/{filename}"
    
    config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    client = CosS3Client(config)
    
    try:
        with open(image_path, 'rb') as f:
            response = client.put_object(
                Bucket=bucket,
                Body=f,
                Key=key,
                EnableMD5=False
            )
        encoded_key = urllib.parse.quote(key, safe='/')
        url = f"https://{bucket}.cos.{region}.myqcloud.com/{encoded_key}"
        print(url)
        return 0
    except Exception as e:
        print(f"上传失败: {str(e)}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Typora Image Upload to Tencent COS", file=sys.stderr)
        print("=" * 40, file=sys.stderr)
        print("", file=sys.stderr)
        print("Usage: python upload_cos.py <image_path> [directory_name_or_md_file]", file=sys.stderr)
        print("", file=sys.stderr)
        print("Directory Selection Methods (优先级从高到低):", file=sys.stderr)
        print("1. 命令行指定: python upload_cos.py <image> <directory>", file=sys.stderr)
        print("2. 从图片路径中提取 img/ 后面的部分 (如: img/前端/项目构建/image.png → 前端/项目构建)", file=sys.stderr)
        print("3. 使用图片所在目录的名称", file=sys.stderr)
        print("4. Markdown文件内注释: <!-- upload_dir: 目录名 -->", file=sys.stderr)
        print("5. 从Markdown文件名自动提取", file=sys.stderr)
        print("6. 配置文件 (~/.typora_upload_config): 文档名.md=目录名", file=sys.stderr)
        print("7. 环境变量: TYPORA_UPLOAD_DIR=目录名", file=sys.stderr)
        print("8. 默认: 'typora_images'", file=sys.stderr)
        print("", file=sys.stderr)
        print("Typora Configuration Examples:", file=sys.stderr)
        print("  - 自动从文档名: python upload_cos.py \"{0}\" \"{1}\"", file=sys.stderr)
        print("  - 固定目录: python upload_cos.py \"{0}\" \"my_project\"", file=sys.stderr)
        print("  - 仅图片: python upload_cos.py \"{0}\"", file=sys.stderr)
        sys.exit(1)
    
    image_path, directory_name = parse_arguments()
    
    if not image_path:
        print(f"Error: No valid image path found. Arguments: {sys.argv}", file=sys.stderr)
        print(f"", file=sys.stderr)
        print(f"Typora Configuration Help:", file=sys.stderr)
        print(f"  1. Open Typora Settings (Ctrl+,)", file=sys.stderr)
        print(f"  2. Go to 'Image' section", file=sys.stderr)
        print(f"  3. Set 'Upload Image' to 'Custom Command'", file=sys.stderr)
        print(f"  4. Enter one of these commands (Recommended: first one):", file=sys.stderr)
        print(f"     - python \"{os.path.abspath(__file__)}\" \"{{0}}\"", file=sys.stderr)
        print(f"     - python \"{os.path.abspath(__file__)}\" \"{{imagePath}}\"", file=sys.stderr)
        print(f"     - python \"{os.path.abspath(__file__)}\" \"{{0}}\" \"{{1}}\"", file=sys.stderr)
        print(f"", file=sys.stderr)
        print(f"Note: Make sure the Python path is correct and Typora has permission to execute the script.", file=sys.stderr)
        sys.exit(1)
    
    # 加载配置文件
    config = load_config()
    
    md_file_name = get_md_file_name(directory_name, config, image_path)
    
    sys.exit(upload_to_cos(image_path, md_file_name))