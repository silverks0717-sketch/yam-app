#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "没有检测到 Node.js。"
  echo "请先安装 Node.js LTS 版本，然后再次双击 start.command。"
  echo "下载地址：https://nodejs.org/"
  echo
  read "?按回车键关闭窗口..."
  exit 1
fi

PORT="${PORT:-4321}"
echo "正在启动 YAM..."
echo "浏览器地址：http://localhost:${PORT}"
echo

(
  sleep 1
  open "http://localhost:${PORT}" >/dev/null 2>&1
) &
PORT="$PORT" node server.js
