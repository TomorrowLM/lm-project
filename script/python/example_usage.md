# Typora 图片上传示例

<!-- upload_dir: my_project_images -->

## 使用方法

### 方法1：文档内注释（推荐）
在 Markdown 文件开头添加：
```markdown
<!-- upload_dir: 目录名 -->
```
图片将上传到 COS 的 `images/目录名/` 目录下。

### 方法2：Typora 配置
在 Typora 设置中配置图片上传命令：
```
python "D:\work\demo\script\python\upload_cos.py" "{0}" "{1}"
```

### 方法3：环境变量
设置环境变量：
```bash
set TYPORA_UPLOAD_DIR=my_project
```

### 方法4：配置文件
编辑 `typora_upload_config.txt`：
```
my_document.md=project_a
other_note.md=project_b
```

## 测试图片
![测试图片](test.png)