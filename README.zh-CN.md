# context-recap

[English](README.md) | 简体中文

## 概述

`context-recap` 是一个面向 DSH（DeepSeek Harness）的轻量技能。它在每条实质性回答结束时，
把本轮的结构化摘要（动因、目标、完成度、后续动作）写进工作区里的
`.context-recap/<会话标识>.md`，并把这个文件在右侧边栏打开；回答正文里**不再出现**任何与摘要有关的内容。

这样摘要**可见、可长期留存，但不占用模型上下文**：文件躺在磁盘上，不进入对话历史；
用户几小时后回到会话，扫一眼侧边栏就能想起任务背景。摘要的模板与正反例见
`references/recap-format.md`。

## 运作方式

一次回答结束时做三件事：

1. **取会话标识** —— 读环境变量 `DSH_SESSION_ID`（形如 `session-85a54419-3338-…`），
   每个会话只取一次并记住；取不到就退化成 `_unknown.md`。
2. **写摘要** —— 写到工作区根目录的 `.context-recap/<会话标识>.md`，20 行以内。
   路径按会话固定，同一工作区并行跑的多个 Agent 互不覆盖，侧边栏也按路径复用同一个标签页。
3. **显示** —— 调 `sidebar_open`，`target` 填同一路径，`title` 填「问题背景」。
   正文**不要**出现任何摘要相关内容：不贴内容、不写回执、不写「已写入…」这类收尾句。

## 摘要格式

```markdown
# 问题背景摘要

> 最后更新：2026-10-26 10:15 · 状态：进行中

## 为什么问这个
一到两句：现实中的起因、痛点。不要复述问题字面。

## 目标
要达成什么，怎样算完成。

## 现在的进度
- 已确认 / 已完成：关键结论（带具体数字、路径、文件名）
- 未完成 / 受阻：卡在哪，缺什么

## 下一步
一到三条具体动作。
```

约束：

1. 中文，**20 行以内**，短句，可以用列表。
2. 写事实：带数字、路径、错误原文；不写形容词。
3. 目标是可验证的（「跑通 X 并输出 Y」），不是「把 X 做好」。
4. 状态取值限定为 `进行中`、`已完成`、`受阻`。
5. 只写一次 —— 写完不要读回来校验、不要重写第二遍。

## 触发条件

默认于所有实质性回答结束时生成。下列情形不生成，且不作说明：

- 纯寒暄、单步确认等无实质信息负载的交互；
- 任务尚未完成的中间回合（工具调用未收敛、结果不完整）；
- 用户明确要求省略。

用户想中途查看时，说一句「看下侧边栏」即可，随时重写。

## 安装

### 方式一：安装脚本（推荐）

全局指令区块的合并属于幂等操作，故推荐使用脚本方式。

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

### 方式二：手动安装

1. 将 `SKILL.md` 与 `references/` 复制至 `~/.dsh/skills/context-recap/`；
2. 将 `AGENTS.md.template` 的内容追加至 `~/.dsh/AGENTS.md`。

### 验证

新建会话并提交一项实质性任务，检查：工作区出现 `.context-recap/<会话标识>.md`、
右侧边栏弹出该文件、回答正文里没有任何摘要相关内容。

## 运行机制

该技能由两个组件协同实现，二者职责不同：

| 组件 | 载体 | 职责 |
|---|---|---|
| 技能 | `~/.dsh/skills/context-recap/SKILL.md` | 定义执行步骤、文件路径、摘要格式与边界 |
| 全局指令 | `~/.dsh/AGENTS.md` 中的标记区块 | 将该行为声明为默认行为，保证逐轮生效 |

仅部署技能不足以保证触发。DSH 每轮仅将技能的标识与描述注入系统提示，是否加载由模型自行判定。
实测结果：新建会话中 `context-recap` 已存在于技能目录，但两轮交互共产生 0 次工具调用，
亦无任何摘要输出。因此需由全局指令承载「必须执行」这一约束；全局指令由 DSH 注入每个会话的系统提示。

全局指令区块以 `<!-- context-recap:begin -->` 与 `<!-- context-recap:end -->` 界定。
安装脚本对该区块执行替换而非追加，故可重复执行。移除该区块即解除全局生效。

## 依赖与降级

- `sidebar_open` 工具由侧边栏插件注册提供 —— 目前为 `dsh-better-sidebar`，该插件同时提供
  `/sidebar/ws/agent-opens` 推送通道；未安装此类插件时该工具不存在。已针对 `dsh-better-sidebar@0.28.2` 验证。
- 该工具另依赖设置项「模型可在侧边栏打开文件（side card）」为开启状态。
- 若 `sidebar_open` 被拒绝或不可用：说明原因，并退化为在回复末尾用引用块贴出摘要，不要反复重试。
- 若工作区不可写（只读 / 沙箱拒绝 `write`）：同样退化为正文引用块，并在回复里说明。
- 若 shell 不可用、读不到 `DSH_SESSION_ID`：使用 `.context-recap/_unknown.md`，不要重试。

## 适用范围与约束

- 摘要文件是临时工作产物，不是交付物：不要 `present` 它，也不要为它单独搭目录结构。
- 若工作区是 git 仓库，首次生成时提醒用户把 `.context-recap/` 加进 `.gitignore`（只说一次）。
- 依赖支持 `AGENTS.md` 全局指令与技能目录的 DSH 版本。
- 项目级应用：将 `AGENTS.md.template` 复制为项目根目录下的 `AGENTS.md`，即可将行为限定于单个项目。
  模板以 `.template` 为扩展名即出于此考虑：若命名为 `AGENTS.md`，该文件会在仓库被克隆至工作区时
  被 DSH 识别为目录级指令并自动注入。

## 开销

每条实质性回答：正文不增加摘要相关输出、一次 `write`、一次 `sidebar_open`；
每个会话额外一次读取 `DSH_SESSION_ID` 的 shell 调用。摘要文本落在磁盘上，不占提示 token。

## 目录结构

```
SKILL.md                    技能本体：执行步骤、摘要格式、维护与边界
AGENTS.md.template          全局指令片段：声明默认行为
references/recap-format.md  摘要模板与正反例
install.ps1                 Windows 安装脚本
install.sh                  macOS / Linux 安装脚本
README.md                   英文文档
README.zh-CN.md             中文文档（默认展示）
```

## 维护说明

- `SKILL.md`、`AGENTS.md.template`、`references/*.md` 须为无 BOM 的 UTF-8 编码。
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

## 许可

MIT
