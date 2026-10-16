<#
  安装 context-recap 技能到 DSH 技能目录。
  用法：pwsh -File scripts/install.ps1
#>
[CmdletBinding()]
param(
  # 覆盖 DSH 主目录（默认取 $env:DSH_HOME，其次 $env:USERPROFILE\.dsh）
  [string]$DshHome
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path (Split-Path -Parent $scriptDir) 'skill'
$skillName = 'context-recap'

if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
  throw "找不到技能源目录（缺少 SKILL.md）：$src"
}

if (-not $DshHome) {
  if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME } else { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
}

$skillsDir = Join-Path $DshHome 'skills'
$dest = Join-Path $skillsDir $skillName

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
Write-Host "已安装。清单：" -ForegroundColor Green
Get-ChildItem $dest -Recurse -File | ForEach-Object {
  Write-Host ("  " + $_.FullName.Substring($dest.Length + 1))
}

Write-Host ''
Write-Host '接下来检查两件事：'
Write-Host '  1. DSH 设置里打开「模型可在侧边栏打开文件（side card）」。'
Write-Host '  2. 右侧边栏插件（dsh-better-sidebar 或自带侧边栏）处于启用状态。'
Write-Host '新技能通常在下一次会话开始时可被加载；已在运行的会话可新开一轮对话验证。'
