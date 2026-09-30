#!/bin/bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "用法: $0 <容器名或ID>" >&2
    exit 1
fi

CONTAINER="$1"

if ! command -v docker >/dev/null 2>&1; then
    echo "未找到 docker 命令" >&2
    exit 1
fi

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "容器 '$CONTAINER' 不存在" >&2
    exit 1
fi

docker inspect --format '{{range .Mounts}}{{printf "%s\t%s\t%t\n" .Source .Destination .RW}}{{end}}' "$CONTAINER" |
while IFS=$'\t' read -r source destination read_write; do
    [[ -z "$source" || -z "$destination" ]] && continue
    mount_spec="${source}:${destination}"
    [[ "$read_write" == "false" ]] && mount_spec="${mount_spec}:ro"
    printf -- '-v %q\n' "$mount_spec"
done