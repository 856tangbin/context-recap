#!/bin/sh
# 安装 context-recap：技能 +（可选）全局指令。
# 用法：
#   sh scripts/install.sh                       # 只装技能
#   sh scripts/install.sh --global-instruction  # 装技能 + 写全局指令 $DSH_HOME/AGENTS.md
set -eu

install_global=0
for arg in "$@"; do
  case "$arg" in
    --global-instruction) install_global=1 ;;
    --help|-h) echo "用法: sh scripts/install.sh [--global-instruction]"; exit 0 ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
src="$repo_root/skill"
snippet="$repo_root/instructions/AGENTS.md"
skill_name="context-recap"

begin_marker='<!-- context-recap:begin -->'
end_marker='<!-- context-recap:end -->'

if [ ! -f "$src/SKILL.md" ]; then
  echo "找不到技能源目录（缺少 SKILL.md）：$src" >&2
  exit 1
fi
if [ ! -f "$snippet" ]; then
  echo "找不到全局指令片段：$snippet" >&2
  exit 1
fi

if [ -n "${DSH_HOME:-}" ]; then
  dsh_home="$DSH_HOME"
else
  dsh_home="$HOME/.dsh"
fi

dest="$dsh_home/skills/$skill_name"
global_file="$dsh_home/AGENTS.md"

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
echo "已安装技能。清单："
# 不要把 $dest 拼进 sed 表达式：Windows 路径里的 \1（例如 \17791）会被当成反向引用，
# sed 报 "Invalid back reference" 并让 set -e 以退出码 1 结束脚本。先 cd 再用相对路径。
( cd "$dest" && find . -type f | sed 's|^\./|  |' )

if [ "$install_global" = "1" ]; then
  mkdir -p "$dsh_home"
  if [ -f "$global_file" ] && grep -qF "$begin_marker" "$global_file"; then
    # 已有区块 → 原地替换（幂等）。块内容经 blkfile 读入，避免 awk -v 解释转义序列。
    awk -v b="$begin_marker" -v e="$end_marker" -v blkfile="$snippet" '
      BEGIN { while ((getline line < blkfile) > 0) blk = blk line "\n" }
      $0 == b { printf "%s\n%s", b, blk; skip = 1; next }
      $0 == e { print e; skip = 0; next }
      !skip { print }
    ' "$global_file" > "$global_file.tmp"
    mv "$global_file.tmp" "$global_file"
    action="已更新 AGENTS.md 里已有的 context-recap 区块"
  else
    # 追加区块；文件不存在时下面的重定向会直接创建它
    if [ -s "$global_file" ]; then printf '\n' >> "$global_file"; fi
    {
      printf '%s\n' "$begin_marker"
      cat "$snippet"
      printf '%s\n' "$end_marker"
    } >> "$global_file"
    action="已在 AGENTS.md 末尾追加上区块（文件不存在则新建）"
  fi

  echo ""
  echo "$action："
  echo "  $global_file"
  echo "  区块由 <!-- context-recap:begin --> / <!-- context-recap:end --> 标记，可重复执行（幂等）。"
  echo "  这会影响**所有**会话的收尾行为；不想要时删掉这两个标记之间的内容即可。"
else
  echo ""
  echo "只装了技能。若要让摘要**每轮必然触发**（不再依赖模型自己决定加载技能），"
  echo "请加 --global-instruction 重跑，或手工把 instructions/AGENTS.md 的内容合并进："
  echo "  $global_file"
fi

echo ""
echo "接下来检查两件事："
echo "  1. DSH 设置里打开「模型可在侧边栏打开文件（side card）」。"
echo "  2. 右侧边栏插件（dsh-better-sidebar 或自带侧边栏）处于启用状态。"
echo "验证时请用一个**实质任务**（例如「看看这个文件夹里有什么」）；"
echo "按当前配置，寒暄和单步确认会被有意跳过。"
