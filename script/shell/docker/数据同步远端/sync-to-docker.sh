#!/bin/bash
# sync-to-docker.sh - 同步本地数据到 Docker 容器
# 用法：./sync-to-docker.sh <容器名> <本地路径> <容器路径>

set -e  # 遇到错误退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
if [ $# -lt 3 ]; then
    echo "用法: $0 <容器名或ID> <本地路径> <容器路径>"
    echo "示例: $0 my-app ./data /app/data"
    echo "可选参数:"
    echo "  -d, --delete    删除目标多余文件"
    echo "  -e, --exclude   排除文件模式"
    echo "  -b, --backup    备份目标文件"
    echo "  -v, --verbose   详细输出"
    exit 1
fi

# 解析参数
CONTAINER="$1"
LOCAL_PATH="$2"
CONTAINER_PATH="$3"
DELETE_FLAG=""
EXCLUDE_PATTERNS=""
BACKUP_DIR=""
VERBOSE=""

shift 3
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--delete)
            DELETE_FLAG="--delete"
            shift
            ;;
        -e|--exclude)
            EXCLUDE_PATTERNS="$2"
            shift 2
            ;;
        -b|--backup)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="-v"
            shift
            ;;
        *)
            log_error "未知参数: $1"
            exit 1
            ;;
    esac
done

# 检查容器是否存在
if ! docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    log_error "容器 '$CONTAINER' 不存在"
    exit 1
fi

# 检查容器是否运行
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    log_warn "容器 '$CONTAINER' 未运行，尝试启动..."
    docker start "$CONTAINER" || {
        log_error "无法启动容器 '$CONTAINER'"
        exit 1
    }
    sleep 2
fi

# 检查本地路径
if [ ! -e "$LOCAL_PATH" ]; then
    log_error "本地路径 '$LOCAL_PATH' 不存在"
    exit 1
fi

# 备份目标文件（如果指定）
if [ -n "$BACKUP_DIR" ]; then
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/${CONTAINER}_backup_$BACKUP_TIMESTAMP"
    
    log_info "备份容器文件到: $BACKUP_PATH"
    docker exec "$CONTAINER" sh -c "
        if [ -d '$CONTAINER_PATH' ]; then
            mkdir -p '$BACKUP_PATH' &&
            cp -r '$CONTAINER_PATH'/* '$BACKUP_PATH/' 2>/dev/null || true
        fi
    " || log_warn "备份可能不完整"
fi

# 构建排除参数
EXCLUDE_ARGS=""
if [ -n "$EXCLUDE_PATTERNS" ]; then
    IFS=',' read -ra PATTERNS <<< "$EXCLUDE_PATTERNS"
    for pattern in "${PATTERNS[@]}"; do
        EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude='$pattern'"
    done
fi

# 执行同步
log_info "开始同步: $LOCAL_PATH -> $CONTAINER:$CONTAINER_PATH"

# 方法1: 使用 docker cp（简单直接）
if [ -z "$DELETE_FLAG" ] && [ -z "$EXCLUDE_ARGS" ]; then
    log_info "使用 docker cp 同步..."
    docker cp "$LOCAL_PATH" "${CONTAINER}:${CONTAINER_PATH}" 2>/dev/null || {
        # 如果失败，尝试先创建目录
        docker exec "$CONTAINER" mkdir -p "$(dirname "$CONTAINER_PATH")"
        docker cp "$LOCAL_PATH" "${CONTAINER}:${CONTAINER_PATH}"
    }
else
    # 方法2: 使用 tar + docker exec（支持排除和删除）
    log_info "使用 tar 同步（支持高级选项）..."
    
    # 创建临时目录
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    # 复制到临时目录（应用排除规则）
    if [ -n "$EXCLUDE_ARGS" ]; then
        eval "rsync -a $VERBOSE $EXCLUDE_ARGS '$LOCAL_PATH/' '$TEMP_DIR/'"
    else
        cp -r "$LOCAL_PATH"/* "$TEMP_DIR/" 2>/dev/null || true
    fi
    
    # 传输到容器
    cd "$TEMP_DIR" && tar cf - . | docker exec -i "$CONTAINER" tar xf - -C "$CONTAINER_PATH"
    
    # 如果需要删除多余文件
    if [ -n "$DELETE_FLAG" ]; then
        log_info "清理容器中多余文件..."
        docker exec "$CONTAINER" sh -c "
            cd '$CONTAINER_PATH'
            find . -type f | while read file; do
                if [ ! -f '$TEMP_DIR/\$file' ]; then
                    rm -f \"\$file\"
                fi
            done
            find . -type d -empty -delete
        "
    fi
fi

log_info "同步完成！"