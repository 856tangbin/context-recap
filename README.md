# dsh-context-recap

让每次回答都带上「我当初为什么要问」。

一个 DeepSeek Harness（DSH）用的轻量技能：**每次回答结束时，把「问题背景 + 目标 + 当前进度」
写成一份短摘要，显示在右侧边栏。** 半天以后回到这个会话，看一眼侧边栏就能重新想起上下文。

---

## 它解决什么问题

人做大模型在做的事时也需要背景。当你同时挂几个 Agent 跑任务，它们动辄半小时到几小时才回，
等你回来时，经常已经忘了：

- 当初**为什么**提这个问题；
- 想**达成什么**；
- 它现在**做到哪一步**了。

这个技能把这三件事固定在右侧边栏的一个标签页里，随每轮回答刷新，不用回头翻聊天记录。

## 摘要长什么样

```markdown
# 问题背景摘要

> 最后更新：2026-10-16 14:20 · 状态：进行中

## 为什么问这个
同时挂了三个 Agent 帮我排查线上问题，每个都要半小时以上才回，
过一阵子我自己忘了当初为什么要问。

## 目标
让每次回答结束时自动显示「这问题是为什么、做到哪了」。

## 现在的进度
- 已完成：确认 sidebar_open 工具可用；dsh-better-sidebar@0.26.0 已安装。
- 未完成：还没验证 .md 预览是否自动刷新。

## 下一步
- 写安装脚本并实测。
```

## 为什么是 Skill，而不是插件

| | Skill（本仓库，已选） | 侧边栏 Tab 插件 |
|---|---|---|
| 开发成本 | 一个 `SKILL.md`，写完即用 | TS + tsdown + React + cordis patch + profile 安装 |
| 版本风险 | 无（不碰 DSH 内部 API） | 依赖 `@deepseek-ai/dsh-client-ui-*` 的 rc 版本对齐 |
| 渲染 | 侧边栏原生 Markdown 预览 | 自定义 React 界面，可做时间线 / 跳转 / 徽标 |
| 触发 | 由模型按技能目录决定是否加载 | 由事件驱动，**必然**每轮触发 |
| 迭代 | 改文本即可 | 改代码需重新 build + 重载 |

结论：**先用 Skill 拿到 90% 的价值，把「摘要写什么」这件事固定下来**；等用顺了、确实想要
自动触发和更强的界面，再按 [`docs/upgrade-to-plugin.md`](docs/upgrade-to-plugin.md) 升级成
`dsh-better-sidebar` 的 Tab 插件——届时摘要的内容契约不用改，只换渲染层。

## 安装

### 方式一：脚本（推荐）

```powershell
# Windows
pwsh -File scripts/install.ps1
```

```sh
# macOS / Linux
sh scripts/install.sh
```

脚本把 `skill/` 复制到 `~/.dsh/skills/context-recap/`。已存在时会先备份为
`context-recap.bak-<时间戳>`。

### 方式二：手动

把 `skill/` 整个目录复制成 `%USERPROFILE%\.dsh\skills\context-recap\`（macOS/Linux 为
`~/.dsh/skills/context-recap/`）。目录里必须有 `SKILL.md`。

### 前提检查

1. DSH 设置里 **「模型可在侧边栏打开文件（side card）」需要打开**——技能靠 `sidebar_open`
   工具把摘要送进侧边栏，这个开关关着就送不进去。
2. 右侧边栏插件（`dsh-better-sidebar` 或 DSH 自带侧边栏）已启用——负责渲染 Markdown 预览。

### 可选：让它「每轮必触发」

技能由模型按目录决定是否加载，正常情况下任务结束时都会加载。如果你希望万无一失，把下面这段
加进你的**全局指令 / 项目 `AGENTS.md`**（常驻系统提示，不依赖模型主动加载）：

```markdown
每次回答结束时，按 context-recap 技能写 `.context-recap.md` 并调用 sidebar_open 显示到侧边栏。
纯闲聊和单步确认可以跳过。
```

## 使用

不需要手动调用。任务结束时它自己生效。想随时看，说一句「看下侧边栏」即可重写。

摘要固定写在当前工作区根目录的 `.context-recap.md`——**固定路径**是为了让侧边栏复用同一个
标签页，而不是每轮新开一个。建议在工作区 `.gitignore` 里加一行：

```
.context-recap.md
```

## 目录结构

```
dsh-context-recap/
├── skill/
│   ├── SKILL.md                    # 技能本体（触发条件 + 执行步骤 + 格式规范）
│   └── references/
│       └── recap-format.md         # 模板、正例、反例、长度参考
├── scripts/
│   ├── install.ps1                 # Windows 安装
│   └── install.sh                  # macOS / Linux 安装
├── docs/
│   └── upgrade-to-plugin.md        # 升级为侧边栏 Tab 插件的路线
├── LICENSE
└── README.md
```

## 已知取舍

- **共用一份摘要**：同一工作区共用一个 `.context-recap.md`，记录的是「这个工作区当前在解决什么」。
  同一工作区里跑多个互不相关的任务时，技能会改用 `.context-recap/<短标识>.md` 区分。
- **不自动刷新**：侧边栏 Markdown 预览可能需要点一下刷新；如果发现内容不更新，直接说
  「刷新侧边栏」，技能会重新 `sidebar_open` 聚焦该标签页。
- **有额外开销**：每轮多一次文件写入和一次 `sidebar_open` 调用；这也是它默认允许在纯闲聊时跳过
  的原因。

## License

MIT
