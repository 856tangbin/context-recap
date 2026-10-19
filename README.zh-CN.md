# context-recap

[English](README.md) | 简体中文

## 概述

`context-recap` 是一个面向 DSH（DeepSeek Harness）的轻量技能。它在每次实质性回答的末尾附加一段
结构化摘要，记录该轮交互的动因、目标、完成度与后续动作，用以降低长时间任务及多会话并行场景下的
上下文遗忘成本：当用户在数小时后返回某一会话时，无需回溯完整对话即可恢复对任务背景的认知。

该技能不产生文件、不访问侧边栏、不调用任何工具，仅改变回答的文本结构，因此不依赖额外插件或权限。

## 输出规范

摘要以 Markdown 引用块（blockquote）形式置于正文末尾，由一行标题、一个空引用行与四项列表构成：

```markdown
> **问题背景** · 状态：进行中
>
> - **为什么问这个**：同时启动三个代理排查线上故障，返回延迟均超过三十分钟，事后已遗忘原始诉求。
> - **目标**：使每轮回答均可呈现该问题的动因与当前完成度。
> - **现在的进度**：摘要形式已改为行内引用块；技能与安装脚本已同步。
> - **下一步**：在新会话中提交一项实质性任务并检查输出。
```

约束条件：

1. 标题行与列表之间必须保留一个仅含 `>` 的空引用行。Markdown 将连续引用行合并为同一段落，
   缺少该空行会导致四项内容渲染为一段。
2. 四项各占一行、各一句，整块不超过五行。
3. 状态取值限定为 `进行中`、`已完成`、`受阻` 之一。
4. 陈述须为可核查的事实，包含路径、数值或错误信息原文；不得重复回答正文内容。
5. 摘要块内部不得使用标题语法，以免改变文档大纲层级。

## 触发条件

默认于所有实质性回答结束时生成。下列情形不生成，且不作说明：

- 纯寒暄、单步确认等无实质信息负载的交互；
- 任务尚未完成的中间回合（工具调用未收敛、结果不完整）；
- 用户明确要求省略。

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

1. 将 `SKILL.md` 复制至 `~/.dsh/skills/context-recap/`；
2. 将 `AGENTS.md.template` 的内容追加至 `~/.dsh/AGENTS.md`。

### 验证

新建会话并提交一项实质性任务，检查回答末尾是否出现上述引用块。

## 运行机制

该技能由两个组件协同实现，二者职责不同：

| 组件 | 载体 | 职责 |
|---|---|---|
| 技能 | `~/.dsh/skills/context-recap/SKILL.md` | 定义输出格式、写作要求与豁免条件 |
| 全局指令 | `~/.dsh/AGENTS.md` 中的标记区块 | 将该行为声明为默认行为，保证逐轮生效 |

仅部署技能不足以保证触发。DSH 每轮仅将技能的标识与描述注入系统提示，是否加载由模型自行判定。
实测结果为：新建会话中 `context-recap` 已存在于技能目录，但两轮交互共产生 0 次工具调用，
亦无任何摘要输出。因此需由全局指令承载「必须执行」这一约束；全局指令由 DSH 注入每个会话的系统提示。

全局指令区块以 `<!-- context-recap:begin -->` 与 `<!-- context-recap:end -->` 界定。
安装脚本对该区块执行替换而非追加，故可重复执行。移除该区块即解除全局生效。

## 适用范围与约束

- 不依赖侧边栏、`dsh-better-sidebar`、side card 设置或任何额外插件。
- 依赖支持 `AGENTS.md` 全局指令与技能目录的 DSH 版本。
- 项目级应用：将 `AGENTS.md.template` 复制为项目根目录下的 `AGENTS.md`，即可将行为限定于单个项目。
  模板以 `.template` 为扩展名即出于此考虑：若命名为 `AGENTS.md`，该文件会在仓库被克隆至工作区时
  被 DSH 识别为目录级指令并自动注入。

## 开销

每次实质性回答增加约 3 至 5 行输出。不引入工具调用、模型往返或文件写入。

## 目录结构

```
SKILL.md              技能本体：输出规范、写作要求与正反例
AGENTS.md.template    全局指令片段：声明默认行为
install.ps1           Windows 安装脚本
install.sh            macOS / Linux 安装脚本
README.md             英文文档（默认展示）
README.zh-CN.md       中文文档
```

## 维护说明

- `SKILL.md` 与 `AGENTS.md.template` 须为无 BOM 的 UTF-8 编码。
- `install.ps1` 含中文，须保存为 UTF-8 with BOM。Windows PowerShell 5.1 以 ANSI 解码无 BOM 的
  UTF-8 文件，成对 GBK 字节将吞并行尾引号与换行，导致相邻语句被并入字符串字面量。
- `install.sh` 须保持 LF 行尾（由 `.gitattributes` 固定）。
- 安装脚本未签名，建议以 `powershell -NoProfile -ExecutionPolicy Bypass -File` 调用。
- 备份目录须位于 `skills/` 之外：`skills/` 下的每个子目录均会被识别为一个技能。

## 维护记录

- `v0.1.0`：提出以技能加全局指令实现，摘要写入工作区文件并显示于侧边栏。
- `v0.2.0`：仓库结构收敛为单一技能目录，移除插件式分层。
- `v0.3.0`：摘要改为回答末尾的行内引用块，移除侧边栏、文件写入与全部外部依赖。

## 许可

MIT
