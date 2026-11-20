# context-recap

[English](README.md) | 简体中文

## 概述

`context-recap` 是一个面向 DSH（DeepSeek Harness）的轻量技能。它在每条实质性回答结束时，
把本轮的结构化摘要（目标、进度、下一步）写成一张**卡片**存进工作区里的
`.context-recap/<会话标识>.md`。卡片就是看板的数据源，写完**不单独展示** ——
不弹侧边栏，回答正文里也不出现任何与摘要有关的内容；要看时打开右侧栏「看板」。

卡片中的 frontmatter 让摘要变得可聚合：按需运行 `scripts/board.mjs`，就能把所有**未归档**会话的卡片
汇总成一张 `.context-recap/BOARD.md` 看板，按「阻塞 → 进行中 → 已完成 → 缺卡片」排序，
一眼看出手头同时在推进什么。摘要与看板都落在磁盘上，**不占用模型上下文**。

## 运作方式

一次回答结束时做两件事：

1. **取会话标识** —— 读环境变量 `DSH_SESSION_ID`（形如 `session-85a54419-3338-…`），
   每个会话只取一次并记住；取不到就退化成 `_unknown.md`。
2. **写卡片** —— 写到工作区根目录的 `.context-recap/<会话标识>.md`：开头是 frontmatter，
   正文三段、10 行以内。卡片已存在时只改有变化的字段和段落，不整卡重写。
   路径按会话固定，同一工作区并行跑的多个 Agent 互不覆盖。

**不要展示**：不调 `sidebar_open`，正文不贴摘要、不写回执——写进卡片就等于写进了看板。

## 卡片格式

````markdown
---
session: session-85a54419-3338-4ce4-a218-49af2136486f
title: 给 context-recap 加全局看板
status: doing
updated: 2026-11-19 12:30
next: 改完文档后重装技能验证
blocked_on:
---

## 目标
一句话：要达成什么、怎样算完成。

## 进度
- 已完成：结论（带数字、路径、错误原文）。
- 未完成：卡在哪、缺什么。

## 下一步
一到两条具体动作。
````

| 字段 | 必填 | 说明 |
|---|---|---|
| `session` | 是 | 会话标识，与文件名一致 |
| `title` | 是 | 一句话标题，≤ 30 字 |
| `status` | 是 | `doing` 进行中 / `blocked` 受阻 / `done` 已完成未归档 |
| `updated` | 是 | 本地时间 `YYYY-MM-DD HH:mm`，看板按它排序 |
| `next` | 否 | 下一步一句话 |
| `blocked_on` | 否 | `status: blocked` 时的卡点 |

约束：

1. 正文中文，**10 行以内**（frontmatter 不计），短句，可以用列表；起因不明显时加一行 `## 为什么`。
2. 写事实：带数字、路径、错误原文；不写形容词。
3. 目标是可验证的（「跑通 X 并输出 Y」），不是「把 X 做好」。
4. 卡片已存在就增量更新；**只写一次**，写完不要读回来校验。

## 看板

卡片铺在各工作区里，看板把它们拉平。命令：

```powershell
node "$env:USERPROFILE\.dsh\skills\context-recap\scripts\board.mjs"
```

脚本做四件事，全程无 LLM 调用：

1. 读 `~/.dsh/storages/workspace.json`，取「未归档」的会话集合（`archivedSessionIds` 之外）；
2. 到各工作区 `<workspace.path>\.context-recap\<会话 id>.md` 找卡片；
3. 按 `⛔ 阻塞 → ▶ 进行中（updated 倒序，超 3 天标「已 N 天未动」）→ ⏸ 已完成未归档 → ❓ 缺卡片` 分组排序；
4. 写 `<当前目录>\.context-recap\BOARD.md` 并打印，随后 `sidebar_open` 显示（`title` 填「会话看板」）。

常用参数：

| 参数 | 说明 |
|---|---|
| `--all` | 展开折叠的会话（默认折叠：14 天以前的缺卡会话、空会话、只有一两句话的会话） |
| `--json` | 输出 JSON（给脚本用），不写文件 |
| `--no-write` | 只打印，不写 `BOARD.md` |
| `--days N` / `--missing-days N` | 调整「不活跃」与「折叠」的阈值 |
| `--home PATH` / `--out PATH` | 覆盖 `~/.dsh` 与输出路径 |

缺卡片的会话不会凭空编造摘要：看板按会话日志 mtime 兜底活跃度，并提示「去那个会话补一份」。
空会话（0 条用户消息）和只有一两句话的会话（≤1 条）默认折叠成一行统计，不占「缺卡片」的位置。

### 右侧栏常驻看板（可选插件）

想让看板常驻在右侧栏，可以安装配套插件 `context-recap-board`（随本仓库分发，代码在 `plugin/` 目录）：

- 安装：`plugin_manager` 的 `install_bundle`，target 填插件目录的绝对路径；安装后刷新页面。
- 使用：右侧栏 → 引导页「看板」→ 点卡片跳到对应会话，右上角刷新。
- 数据：与 `board.mjs` 同源 —— 读 `.context-recap/<会话 id>.md` 卡片加 `~/.dsh/storages/workspace.json`
  的归档集合；不写文件、不调 LLM。
- 取舍：脚本产出 `BOARD.md` 快照（可提交、可被其它工具读取）；插件是常驻视图（打开即刷新）。

## 触发条件

- **卡片**：默认于所有实质性回答结束时更新，**不弹侧边栏、正文不提摘要**。以下情形跳过且不作说明：
  纯寒暄、单步确认；任务尚未完成的中间回合；用户明确要求省略。用户想中途查看时打开右侧栏「看板」即可。
- **看板**：插件 tab 常驻、打开即读；需要 `BOARD.md` 快照时按需运行脚本 —— 用户问
  「我现在都在忙什么 / 所有会话 / 全局 / 看板」，或需要汇总多个并行会话时。不每轮跑。

## 安装

### 方式一：安装脚本（推荐）

```powershell
# Windows
git clone https://github.com/856tangbin/context-recap.git
cd context-recap
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -GlobalInstruction
```

```sh
# macOS / Linux
git clone https://github.com/856tangbin/context-recap.git
cd context-recap
sh install.sh --global-instruction
```

脚本会安装 `SKILL.md`、`references/`、`scripts/`，并把全局指令区块写入 `~/.dsh/AGENTS.md`。
区块的合并是幂等的，可重复执行。

### 方式二：手动安装

1. 将 `SKILL.md`、`references/`、`scripts/` 复制至 `~/.dsh/skills/context-recap/`；
2. 将 `AGENTS.md.template` 的内容追加至 `~/.dsh/AGENTS.md`。

### 验证

新建会话并提交一项实质性任务，检查：工作区出现带 frontmatter 的
`.context-recap/<会话标识>.md`，且回答正文里没有任何摘要相关内容（也不会弹出侧边栏）。
再让模型「看下全局」，检查 `.context-recap/BOARD.md` 生成且分组正确；装了插件则刷新页面，
右侧栏引导页应出现「看板」。

## 运行机制

该技能由两个组件协同实现，二者职责不同：

| 组件 | 载体 | 职责 |
|---|---|---|
| 技能 | `~/.dsh/skills/context-recap/SKILL.md` | 定义执行步骤、卡片格式、看板命令与边界 |
| 全局指令 | `~/.dsh/AGENTS.md` 中的标记区块 | 将该行为声明为默认行为，保证逐轮生效 |

仅部署技能不足以保证触发。DSH 每轮仅将技能的标识与描述注入系统提示，是否加载由模型自行判定。
实测结果：新建会话中 `context-recap` 已存在于技能目录，但两轮交互共产生 0 次工具调用，
亦无任何摘要输出。因此需由全局指令承载「必须执行」这一约束；全局指令由 DSH 注入每个会话的系统提示。

全局指令区块以 `<!-- context-recap:begin -->` 与 `<!-- context-recap:end -->` 界定。
安装脚本对该区块执行替换而非追加，故可重复执行。移除该区块即解除全局生效。

## 依赖与降级

- 卡片本身**不调用** `sidebar_open`；只有按需生成 `BOARD.md` 快照时才用它打开看板
  （DSH 内置工具，无需第三方侧边栏插件；需设置项「模型可在侧边栏打开文件（side card）」开启）。
- 看板需要 Node.js（`node` 在 `PATH`）；缺失时可用 DSH 自带的 Electron 运行：
  `$env:ELECTRON_RUN_AS_NODE='1'; & $env:DSH_NODE_EXECUTABLE <board.mjs 的路径>`。
- 看板读取 `~/.dsh/storages/workspace.json`（DSH 内部格式；脚本对 `tables.workspaces` 与
  `global.workspaces` 两种布局都做了容错）。非 DSH 环境或文件不可读时看板不可用，只写卡片。
- 若工作区不可写（只读 / 沙箱拒绝 `write`）：在回复里简短说明一句，不要反复重试。
- 若 shell 不可用、读不到 `DSH_SESSION_ID`：使用 `.context-recap/_unknown.md`，不要重试。

## 适用范围与约束

- 卡片是临时工作产物，不是交付物：不要 `present` 它，也不要为它单独搭目录结构。
- `.context-recap/BOARD.md` 是生成物：不要手改，改卡片后重跑脚本。
- 归档 ≠ 删除：会话归档后卡片保留在磁盘上，只是不再进看板。
- 若工作区是 git 仓库，首次生成时提醒用户把 `.context-recap/` 加进 `.gitignore`（只说一次）。
- 依赖支持 `AGENTS.md` 全局指令与技能目录的 DSH 版本。
- 项目级应用：将 `AGENTS.md.template` 复制为项目根目录下的 `AGENTS.md`，即可将行为限定于单个项目。
  模板以 `.template` 为扩展名即出于此考虑：若命名为 `AGENTS.md`，该文件会在仓库被克隆至工作区时
  被 DSH 识别为目录级指令并自动注入。

## 开销

- 每条实质性回答：正文不增加摘要相关输出、一次 `write`（增量更新），不弹侧边栏；
  每个会话额外一次读取 `DSH_SESSION_ID` 的 shell 调用。
- 看板插件打开 tab 时只读卡片与 JSON，无网络请求、无 LLM 调用；`BOARD.md` 快照只在按需时生成。

## 目录结构

```
SKILL.md                    技能本体：步骤、卡片格式、看板命令、边界
AGENTS.md.template          全局指令片段：声明默认行为与看板触发
references/recap-format.md  卡片模板与正反例、旧卡片兼容说明
scripts/board.mjs           聚合脚本：读未归档会话 → 扫卡片 → 生成 BOARD.md
plugin/                     可选插件：右侧栏常驻「看板」tab（独立安装）
install.ps1                 Windows 安装脚本
install.sh                  macOS / Linux 安装脚本
README.md                   英文文档
README.zh-CN.md             中文文档（默认展示）
```

## 维护说明

- `SKILL.md`、`AGENTS.md.template`、`references/*.md`、`scripts/*.mjs` 须为无 BOM 的 UTF-8 编码。
- `install.ps1` 含中文，须保存为 UTF-8 with BOM。Windows PowerShell 5.1 以 ANSI 解码无 BOM 的
  UTF-8 文件，成对 GBK 字节将吞并行尾引号与换行，导致相邻语句被并入字符串字面量。
- `install.sh` 须保持 LF 行尾（由 `.gitattributes` 固定）。
- 安装脚本未签名，建议以 `powershell -NoProfile -ExecutionPolicy Bypass -File` 调用。
- 备份目录须位于 `skills/` 之外：`skills/` 下的每个子目录均会被识别为一个技能。

## 维护记录

- `v0.1.0`：提出以技能加全局指令实现，摘要写入工作区文件并显示于侧边栏（插件式布局）。
- `v0.2.0`：仓库结构收敛为单一技能目录，移除插件式分层；摘要路径定为
  `.context-recap/<DSH_SESSION_ID>.md`。
- `v0.3.0`：摘要改为回答末尾的行内引用块，移除侧边栏、文件写入与全部外部依赖。
- `v0.4.0`：恢复侧边栏方案 —— 写入 `.context-recap/<会话标识>.md` 并调用 `sidebar_open` 显示，
  正文完全不提摘要（不贴内容、不写回执）；侧边栏由 DSH 内置工具提供而非第三方插件；补齐 shell / 侧边栏 / 只读工作区
  三种降级路径。
- `v0.5.0`：卡片引入 frontmatter（`title` / `status` / `updated` / `next` / `blocked_on`），支持增量更新；
  新增 `scripts/board.mjs` 聚合所有未归档会话生成 `BOARD.md` 看板（阻塞 / 进行中 / 已完成 / 缺卡片四组，
  旧卡片自动回捞状态）；安装脚本改为同时复制 `scripts/`。
- `v0.6.0`：看板升级为唯一展示面 —— 卡片不再弹侧边栏、正文不再复述摘要；正文压缩为
  目标 / 进度 / 下一步三段、10 行以内；空会话与只有一两句话的会话默认折叠（`--all` 展开）；
  配套右侧栏常驻看板插件并入 `plugin/`，随仓库分发。
- `v0.6.1`：看板视觉与交互定稿 —— 点线签列表、进行中绿 / 已完成灰的渐变底、运行中转环、
  双击打开、当前会话高亮；已完成默认折叠且切换按钮置于组头，展开状态跨会话与刷新保持；
  无卡片的会话不再展示。

## 许可

MIT
