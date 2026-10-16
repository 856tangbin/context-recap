#!/bin/sh
# 安装 context-recap 技能到 DSH 技能目录。
# 用法：sh scripts/install.sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
src="$script_dir/../skill"
skill_name="context-recap"

if [ ! -f "$src/SKILL.md" ]; then
  echo "找不到技能源目录（缺少 SKILL.md）：$src" >&2
  exit 1
fi

if [ -n "${DSH_HOME:-}" ]; then
  dsh_home="$DSH_HOME"
else
  dsh_home="$HOME/.dsh"
fi

dest="$dsh_home/skills/$skill_name"

echo "DSH 主目录 : $dsh_home"
echo "技能目标   : $dest"

# 备份必须放在 skills 目录之外：skills 下的每个子目录都会被当成一个技能扫描，
# 留一个 context-recap.bak-* 会往技能目录里塞进一个同名垃圾技能。
if [ -e "$dest" ]; then
  backup_root="$dsh_home/skills-backup"
  mkdir -p "$backup_root"
  backup="$backup_root/$skill_name.bak-$(date +%Y%m%d-%H%M%S)"
  echo "已存在同名技能，备份为：$backup"
  mv "$dest" "$backup"
fi

mkdir -p "$dest"
cp -R "$src/." "$dest/"

echo ""
echo "已安装。清单："
# 不要把 $dest 拼进 sed 表达式：Windows 路径里的 \1（例如 \17791）会被当成反向引用，
# sed 报 "Invalid back reference" 并让 set -e 以退出码 1 结束脚本。先 cd 再用相对路径。
( cd "$dest" && find . -type f | sed 's|^\./|  |' )

echo ""
echo "接下来检查两件事："
echo "  1. DSH 设置里打开「模型可在侧边栏打开文件（side card）」。"
echo "  2. 右侧边栏插件（dsh-better-sidebar 或自带侧边栏）处于启用状态。"
echo "新技能通常在下一次会话开始时可被加载；已在运行的会话可新开一轮对话验证。"
