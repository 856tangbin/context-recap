<#
  安装 context-recap：技能 +（可选）全局指令。
  用法：
    pwsh -File scripts/install.ps1                       # 只装技能
    pwsh -File scripts/install.ps1 -GlobalInstruction    # 装技能 + 写全局指令 $DshHome\AGENTS.md

  注意：本文件含中文，必须保存为 **UTF-8 with BOM**。
  Windows PowerShell 5.1 会把无 BOM 的 UTF-8 当 ANSI 读：不仅乱码，成对的 GBK 字节还会吃掉
  行尾引号与换行，把下一行整行吞进字符串字面量。改动后请确认 BOM 仍在。
#>
[CmdletBinding()]
param(
  # 覆盖 DSH 主目录（默认取 $env:DSH_HOME，其次 $env:USERPROFILE\.dsh）
  [string]$DshHome,
  # 把「回答收尾」规则合并进 $DshHome\AGENTS.md —— DSH 的全局指令，注入每一个会话
  [switch]$GlobalInstruction
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$src = Join-Path $repoRoot 'skill'
$snippet = Join-Path $repoRoot 'instructions\AGENTS.md'
$skillName = 'context-recap'

$beginMarker = '<!-- context-recap:begin -->'
$endMarker = '<!-- context-recap:end -->'

if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
  throw "找不到技能源目录（缺少 SKILL.md）：$src"
}
if (-not (Test-Path $snippet)) {
  throw "找不到全局指令片段：$snippet"
}

if (-not $DshHome) {
  if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME } else { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
}

$skillsDir = Join-Path $DshHome 'skills'
$dest = Join-Path $skillsDir $skillName
$globalFile = Join-Path $DshHome 'AGENTS.md'

Write-Host "DSH 主目录 : $DshHome"
Write-Host "技能目标   : $dest"

# 备份必须放在 skills 目录之外：skills 下的每个子目录都会被当成一个技能扫描，
# 留一个 context-recap.bak-* 会往技能目录里塞进一个同名垃圾技能。
if (Test-Path $dest) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupRoot = Join-Path $DshHome 'skills-backup'
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backup = Join-Path $backupRoot "$skillName.bak-$stamp"
  Write-Host "已存在同名技能，备份为：$backup"
  Move-Item -LiteralPath $dest -Destination $backup
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $dest -Recurse -Force

Write-Host ''
Write-Host '已安装技能。清单：' -ForegroundColor Green
Get-ChildItem $dest -Recurse -File | ForEach-Object {
  Write-Host ("  " + $_.FullName.Substring($dest.Length + 1))
}

if ($GlobalInstruction) {
  $body = (Get-Content -LiteralPath $snippet -Raw -Encoding UTF8).Trim()
  $block = "$beginMarker`r`n$body`r`n$endMarker"
  $escBegin = [regex]::Escape($beginMarker)
  $escEnd = [regex]::Escape($endMarker)
  $pattern = "(?s)$escBegin.*?$escEnd"

  if (Test-Path $globalFile) {
    $raw = Get-Content -LiteralPath $globalFile -Raw -Encoding UTF8
    if ([regex]::IsMatch($raw, $pattern)) {
      $new = [regex]::Replace($raw, $pattern, { param($m) $block })
      $action = '已更新 AGENTS.md 里已有的 context-recap 区块'
    }
    else {
      $new = $raw.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
      $action = '已在 AGENTS.md 末尾追加上区块'
    }
  }
  else {
    $new = $block + "`r`n"
    $action = '已新建 AGENTS.md'
  }

  # 全局指令由 DSH 按 UTF-8 读取：不写 BOM（与 SKILL.md 同理）
  [System.IO.File]::WriteAllText($globalFile, $new, (New-Object System.Text.UTF8Encoding($false)))

  Write-Host ''
  Write-Host "$action：" -ForegroundColor Green
  Write-Host "  $globalFile"
  Write-Host '  区块由 <!-- context-recap:begin --> / <!-- context-recap:end --> 标记，可重复执行（幂等）。'
  Write-Host '  这会影响**所有**会话的收尾行为；不想要时删掉这两个标记之间的内容即可。'
}
else {
  Write-Host ''
  Write-Host '只装了技能。若要让摘要**每轮必然触发**（不再依赖模型自己决定加载技能），'
  Write-Host '请加 -GlobalInstruction 重跑，或手工把 instructions\AGENTS.md 的内容合并进：'
  Write-Host "  $globalFile"
}

Write-Host ''
Write-Host '接下来检查两件事：'
Write-Host '  1. DSH 设置里打开「模型可在侧边栏打开文件（side card）」。'
Write-Host '  2. 右侧边栏插件（dsh-better-sidebar 或自带侧边栏）处于启用状态。'
Write-Host '验证时请用一个**实质任务**（例如「看看这个文件夹里有什么」）；'
Write-Host '按当前配置，寒暄和单步确认会被有意跳过。'
