@echo off
set COS_SECRET_ID=your_secret_id_here
set COS_SECRET_KEY=your_secret_key_here
python "%~dp0upload_cos.py" %*
