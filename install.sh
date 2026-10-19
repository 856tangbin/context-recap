#!/bin/sh
# 安装 context-recap 技能。
# 用法：
#   sh install.sh
#   sh install.sh --global-instruction
set -eu

install_global=0
for arg in "$@"; do
  case "$arg" in
    --global-instruction) install_global=1 ;;
    --help|-h) echo "用法: sh install.sh [--global-instruction]"; exit 0 ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
skill_name="context-recap"
snippet="$root/AGENTS.md.template"

begin_marker='<!-- context-recap:begin -->'
end_marker='<!-- context-recap:end -->'

if [ ! -f "$root/SKILL.md" ]; then
  echo "找不到 SKILL.md：$root" >&2
  exit 1
fi
if [ ! -f "$snippet" ]; then
  echo "找不到 AGENTS.md.template：$snippet" >&2
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

# 只装技能本体：SKILL.md + references/
mkdir -p "$dest"
cp "$root/SKILL.md" "$dest/SKILL.md"
if [ -d "$root/references" ]; then
  cp -R "$root/references" "$dest/references"
fi

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
  echo "请加 --global-instruction 重跑，或手工把 AGENTS.md.template 的内容合并进："
  echo "  $global_file"
fi

echo ""
echo "不需要开侧边栏、也不依赖任何侧边栏插件：摘要就是回答末尾的一段引用块。"
echo "新开一个对话、提一个**实质任务**验证；寒暄和单步确认会被有意跳过。"
