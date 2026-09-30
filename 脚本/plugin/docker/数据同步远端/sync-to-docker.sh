#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    printf '%b[INFO]%b %s\n' "$GREEN" "$NC" "$1"
}

log_warn() {
    printf '%b[WARN]%b %s\n' "$YELLOW" "$NC" "$1"
}

log_error() {
    printf '%b[ERROR]%b %s\n' "$RED" "$NC" "$1" >&2
}

usage() {
    cat <<EOF
用法: $0 <容器名或ID> <本地路径> <容器目录> [选项]

选项:
  -d, --delete             删除容器目录中的旧内容后同步
  -e, --exclude <模式>     排除文件模式，多个模式使用逗号分隔
  -b, --backup <容器目录>  同步前将目标内容备份到容器内目录
  -v, --verbose            显示详细的本地文件整理信息
  -h, --help               显示帮助

示例:
  $0 my-app ./data /app/data --exclude '.git,node_modules' --backup /backup
EOF
}

if [[ $# -lt 3 ]]; then
    usage
    exit 1
fi

CONTAINER="$1"
LOCAL_PATH="$2"
CONTAINER_PATH="$3"
DELETE_TARGET=0
BACKUP_DIR=""
VERBOSE=0
EXCLUDE_PATTERNS=()

shift 3
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--delete)
            DELETE_TARGET=1
            shift
            ;;
        -e|--exclude)
            if [[ $# -lt 2 || -z "$2" ]]; then
                log_error "$1 需要排除模式"
                exit 1
            fi
            IFS=',' read -r -a PATTERNS <<< "$2"
            for pattern in "${PATTERNS[@]}"; do
                [[ -n "$pattern" ]] && EXCLUDE_PATTERNS+=("$pattern")
            done
            shift 2
            ;;
        -b|--backup)
            if [[ $# -lt 2 || -z "$2" ]]; then
                log_error "$1 需要容器内备份目录"
                exit 1
            fi
            BACKUP_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            usage
            exit 1
            ;;
    esac
done

if ! command -v docker >/dev/null 2>&1; then
    log_error "未找到 docker 命令"
    exit 1
fi

if [[ ! -e "$LOCAL_PATH" ]]; then
    log_error "本地路径 '$LOCAL_PATH' 不存在"
    exit 1
fi

if [[ "$CONTAINER_PATH" != /* ]]; then
    log_error "容器路径必须是绝对路径"
    exit 1
fi

if [[ "$DELETE_TARGET" -eq 1 && "$CONTAINER_PATH" == "/" ]]; then
    log_error "禁止对容器根目录使用 --delete"
    exit 1
fi

if [[ -n "$BACKUP_DIR" && "$BACKUP_DIR" != /* ]]; then
    log_error "容器内备份目录必须是绝对路径"
    exit 1
fi

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    log_error "容器 '$CONTAINER' 不存在"
    exit 1
fi

if [[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER")" != "true" ]]; then
    log_warn "容器 '$CONTAINER' 未运行，正在启动"
    docker start "$CONTAINER" >/dev/null
fi

TEMP_DIR=$(mktemp -d)
PAYLOAD_DIR="$TEMP_DIR/payload"
STAGE_PATH="/tmp/sync-to-docker-$$-$RANDOM"
STAGE_CREATED=0
mkdir -p "$PAYLOAD_DIR"

cleanup() {
    exit_code=$?
    trap - EXIT
    rm -rf "$TEMP_DIR"
    if [[ "$STAGE_CREATED" -eq 1 ]]; then
        docker exec "$CONTAINER" sh -c 'rm -rf "$1"' sh "$STAGE_PATH" >/dev/null 2>&1 || true
    fi
    exit "$exit_code"
}
trap cleanup EXIT

if [[ "${#EXCLUDE_PATTERNS[@]}" -gt 0 ]]; then
    if ! command -v rsync >/dev/null 2>&1; then
        log_error "使用 --exclude 需要安装 rsync"
        exit 1
    fi
    RSYNC_ARGS=(-a)
    [[ "$VERBOSE" -eq 1 ]] && RSYNC_ARGS+=(-v)
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        RSYNC_ARGS+=("--exclude=$pattern")
    done
    if [[ -d "$LOCAL_PATH" ]]; then
        rsync "${RSYNC_ARGS[@]}" "$LOCAL_PATH/" "$PAYLOAD_DIR/"
    else
        rsync "${RSYNC_ARGS[@]}" "$LOCAL_PATH" "$PAYLOAD_DIR/"
    fi
elif [[ -d "$LOCAL_PATH" ]]; then
    cp -a "$LOCAL_PATH/." "$PAYLOAD_DIR/"
else
    cp -a "$LOCAL_PATH" "$PAYLOAD_DIR/"
fi

if [[ -n "$BACKUP_DIR" ]]; then
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR%/}/${CONTAINER}_backup_${BACKUP_TIMESTAMP}"
    log_info "备份容器内容到 $BACKUP_PATH"
    docker exec "$CONTAINER" sh -c '
        set -e
        if [ -d "$1" ]; then
            mkdir -p "$2"
            tar -C "$1" -cf - . | tar -C "$2" -xf -
        fi
    ' sh "$CONTAINER_PATH" "$BACKUP_PATH"
fi

log_info "上传同步内容到容器临时目录"
docker exec "$CONTAINER" sh -c 'mkdir -p "$1"' sh "$STAGE_PATH"
STAGE_CREATED=1
tar -C "$PAYLOAD_DIR" -cf - . | docker exec -i "$CONTAINER" tar -C "$STAGE_PATH" -xf -

log_info "同步 $LOCAL_PATH -> $CONTAINER:$CONTAINER_PATH"
docker exec "$CONTAINER" sh -c '
    set -e
    target=$1
    stage=$2
    delete_target=$3
    mkdir -p "$target"
    if [ "$delete_target" = "1" ]; then
        rm -rf "$target"/* "$target"/.[!.]* "$target"/..?*
    fi
    tar -C "$stage" -cf - . | tar -C "$target" -xf -
    rm -rf "$stage"
' sh "$CONTAINER_PATH" "$STAGE_PATH" "$DELETE_TARGET"
STAGE_CREATED=0

log_info "同步完成"