# dsh-context-recap

让每次回答都带上「我当初为什么要问」。

一个 DeepSeek Harness（DSH）用的轻量扩展：**每次回答结束时，把「问题背景 + 目标 + 当前进度」
写成一份短摘要，显示在右侧边栏。** 半天以后回到这个会话，看一眼侧边栏就能重新想起上下文。

---

## 快速开始（拿到别人的仓库）

```powershell
git clone https://github.com/856tangbin/dsh-context-recap.git
cd dsh-context-recap
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install.ps1 -GlobalInstruction
```

装完**新开一个对话**、提一个**实质任务**，看右侧边栏有没有出现「问题背景」标签页。
细节、前提检查和 macOS/Linux 写法见下面的[安装](#安装)一节。

## 它解决什么问题

人做大模型在做的事时也需要背景。当你同时挂几个 Agent 跑任务，它们动辄半小时到几小时才回，
等你回来时，经常已经忘了：

- 当初**为什么**提这个问题；
- 想**达成什么**；
- 它现在**做到哪一步**了。

这个扩展把这三件事固定在右侧边栏的一个标签页里，随每轮回答刷新，不用回头翻聊天记录。

## 摘要长什么样

```markdown
# 问题背景摘要

> 最后更新：2026-10-16 13:20 · 状态：进行中

## 为什么问这个
同时挂了三个 Agent 帮我排查线上问题，每个都要半小时以上才回，
过一阵子我自己忘了当初为什么要问。

## 目标
让每次回答结束时自动显示「这问题是为什么、做到哪了」。

## 现在的进度
- 已完成：确认 sidebar_open 工具可用；dsh-better-sidebar@0.26.0 已安装。
- 未完成：还没验证 .md 预览是否自动刷新。

## 下一步
- 用实质任务在新会话里验证一次。
```

## 关键：只装技能**不够**，默认行为要写进全局指令

这是实测出来的结论，不是推测。

DSH 的技能目录每轮都会把所有技能的名字和描述放进系统提示，但**是否加载某个技能、是否执行
它，完全由模型自己决定**。实测（解压会话日志 `session-7e3bfb5d` 逐条核对）：

| 轮次 | 输入 | 模型输出 | 工具调用 |
|---|---|---|---|
| turn 1 | `你好` | 「你好！有什么可以帮你的吗？…」 | 无 |
| turn 2 | `回复我: pigon` | `pigon`（2 tokens） | 无 |

技能 `context-recap` **确实在**那个会话的技能目录里，但模型一次都没加载它 —— 没有 `skill`
调用，没有 `sidebar_open`，也没有写文件。两轮又恰好都是「纯寒暄 / 单步确认」，就算加载了，
按技能自身的规则也会跳过。

结论：**技能负责"怎么写"，全局指令负责"必须写"。** 两者叠加才是可用状态：

| | 技能 | 全局指令 |
|---|---|---|
| 载体 | `~/.dsh/skills/context-recap/SKILL.md` | `~/.dsh/AGENTS.md` |
| 作用 | 定义摘要格式、正反例、边界 | 声明"每轮回答结束都要做"这个默认行为 |
| 生效方式 | 模型按需加载 | **注入每一个会话的系统提示**（DSH 的全局指令，由 `dsh-agent-instructions` 读取） |
| 单独使用 | ❌ 不保证触发 | ⚠️ 能触发，但格式细节靠技能补全 |

## 安装

### 方式一：脚本（推荐）

```powershell
# Windows：装技能 + 写全局指令（推荐，完整效果）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install.ps1 -GlobalInstruction

# 只要技能，不动全局配置
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install.ps1
```

为什么带 `-ExecutionPolicy Bypass`：脚本没有数字签名，而**不同环境下生效的执行策略可能拒绝加载它**。
实测遇到过即使 `Get-ExecutionPolicy` 显示 `RemoteSigned`，直接 `& .\scripts\install.ps1` 仍然报
「未对文件进行数字签名」。`Bypass` 只作用于这一个子进程，不改你的机器设置。
若你更愿意改文件而不是改调用方式，也可以先 `Unblock-File scripts\install.ps1` 再直接运行。

```sh
# macOS / Linux
sh scripts/install.sh --global-instruction
sh scripts/install.sh                        # 只装技能
```

脚本行为：

- 把 `skill/` 复制到 `~/.dsh/skills/context-recap/`；已存在时先备份到 `~/.dsh/skills-backup/`
  （**不能**备份在 `skills/` 里 —— 那下面每个子目录都会被当成一个技能扫描）。
- `-GlobalInstruction` / `--global-instruction`：把 `instructions/AGENTS.md.template` 的内容合并进
  `~/.dsh/AGENTS.md`，用 `<!-- context-recap:begin -->` / `<!-- context-recap:end -->` 标记包住。
  **幂等**：重复执行是原地替换，不会叠加；你原有的全局指令会被保留在后面。
  不想要了，删掉这两个标记之间的内容即可。

### 方式二：手工

1. 把 `skill/` 复制成 `~/.dsh/skills/context-recap/`（必须含 `SKILL.md`）。
2. 把 `instructions/AGENTS.md.template` 的内容追加进 `~/.dsh/AGENTS.md`。

### 只想给某一个项目用？

DSH 也会读**工作区里**的 `AGENTS.md`，并把它作为该目录范围的指令注入。所以只想给某个项目装上时，
把 `instructions/AGENTS.md.template` 复制成 `<项目根>/AGENTS.md` 就行，不必动全局配置。

（片段之所以用 `.template` 扩展名，正是这条规则的反面：它一旦叫 `AGENTS.md`，别人把本仓库
clone 进工作区时，DSH 会当场把它当成那个目录的指令自动注入 —— 这是实测踩到过的副作用。）

### 前提检查

1. DSH 设置里 **「模型可在侧边栏打开文件（side card）」需要打开** —— 靠 `sidebar_open`
   把摘要送进侧边栏，这个开关关着就送不进去。
2. 右侧边栏插件（`dsh-better-sidebar` 或 DSH 自带侧边栏）已启用 —— 负责渲染 Markdown 预览。

### 验证方法

用一个**实质任务**开一轮新对话，例如「看看这个文件夹里有什么」。按当前配置，
寒暄（`你好`）和单步确认（`回复我:pigon`）会被有意跳过，用它们验证会看不到东西。

## 它花多少 token（实测）

在真实会话（`session-de424f7e`，一轮 8 个 step）上量出来的：

| 项目 | 量 | 是否随轮数累积 |
|---|---|---|
| 全局指令块 | 1,300 B / 610 字符，常驻系统提示 | 否（稳定前缀，走缓存） |
| 额外模型往返 | 约 3 次（取会话标识 / write / sidebar_open） | 否（每轮固定） |
| 摘要正文 | 约 300–700 output tokens | **是**，作为工具参数永久留在历史里 |

关键事实：**没有额外的"总结" API 调用**，也不会重读一遍历史 —— 摘要由同一个 agent 在同一轮里
顺手写出来，历史本来就在它的上下文里。那一轮的缓存读高达 228K tokens，但那是 agent 循环里
每一步重发上下文造成的，**和有没有摘要无关**。

## 为什么不是插件

| | 技能 + 全局指令（本仓库） | 侧边栏 Tab 插件 |
|---|---|---|
| 开发成本 | 一个 `SKILL.md` + 一段指令 | tsdown + React + cordis patch + profile 安装 |
| 版本风险 | 零（不碰 DSH 内部 API） | 依赖 `@deepseek-ai/dsh-client-ui-*` 的 rc 版本对齐 |
| 渲染 | 侧边栏原生 Markdown 预览 | 自定义 React，可做时间线 / 跳转 / 徽标 |
| 触发 | 全局指令注入系统提示，每轮可见 | 事件驱动，**必然**触发 |
| 迭代 | 改文本即可 | 改代码要重新 build + 重载 |

先用这一版拿到主要价值，把「摘要写哪几行」这个产品契约固定下来；等确认需要自动触发和更强界面，
再按 [`docs/upgrade-to-plugin.md`](docs/upgrade-to-plugin.md) 升级 —— 摘要的内容契约不用改，
只换渲染层。

## 使用

装好之后不需要手动调用。想随时刷新侧边栏，说一句「刷新侧边栏」即可。

摘要**按会话分开写**：当前工作区根目录下的 `.context-recap/<DSH_SESSION_ID>.md`。
文件名就是 DSH 注入给工具进程的环境变量 `DSH_SESSION_ID`（它同时也是会话日志的目录名）。

**为什么按会话分文件**：侧边栏按路径去重 —— 一个会话一个固定路径，就始终复用同一个标签页；
而同一工作区里并行跑的其它 Agent 各有各的文件，不会互相覆盖。建议在工作区 `.gitignore` 里加一行：

```
.context-recap/
```

## 目录结构

```
dsh-context-recap/
├── skill/
│   ├── SKILL.md                    # 技能本体（触发条件 + 执行步骤 + 格式规范）
│   └── references/
│       └── recap-format.md         # 模板、正例、反例、长度参考
├── instructions/
│   └── AGENTS.md.template          # 全局指令片段（声明"每轮都要做"这个默认行为）
├── scripts/
│   ├── install.ps1                 # Windows 安装（-GlobalInstruction 开关）
│   └── install.sh                  # macOS / Linux 安装（--global-instruction 开关）
├── docs/
│   └── upgrade-to-plugin.md        # 升级为侧边栏 Tab 插件的路线
├── LICENSE
└── README.md
```

## 已知取舍

- **不自动刷新**：侧边栏 Markdown 预览可能需要点一下刷新；发现内容不更新就说「刷新侧边栏」。
  另外右侧栏没展开时，`sidebar_open` 会**排队**（返回 queued），展开之后才可见。
- **有额外开销**：每个实质回合多约 3 次模型往返（取会话标识 / 写文件 / `sidebar_open`）加
  约 300–700 输出 tokens；实测见上一节。这也是寒暄和单步确认默认跳过的原因。
- **全局指令影响所有会话**：`~/.dsh/AGENTS.md` 是全局的。只想给某个项目用，见上面「只想给
  某一个项目用？」。
- **`.context-recap/` 会攒文件**：每个会话一个。它们只是临时工作产物，定期清理即可。

## 开发注意

- `scripts/install.ps1` 含中文，**必须保存为 UTF-8 with BOM**。Windows PowerShell 5.1 会把无 BOM
  的 UTF-8 当 ANSI 读：不仅乱码，成对的 GBK 字节还会吃掉行尾引号与换行，把下一行整行吞进字符串
  字面量。用编辑器/工具改完请确认 BOM 还在。
- `SKILL.md` 与 `~/.dsh/AGENTS.md` 相反：**不要加 BOM**，DSH 按 UTF-8 读它们。
- `scripts/install.sh` 保持 **LF** 行尾（`.gitattributes` 已固定），否则 POSIX 上会
  `bad interpreter`。
- 不要把目标路径拼进 `sed` 表达式：Windows 路径里的 `\1`（如 `C:\Users\17791`）会被当成反向
  引用，报 `Invalid back reference`。
- 安装脚本的备份目录必须在 `skills/` **之外**。
- `instructions/AGENTS.md.template` **必须保留 `.template` 扩展名**：DSH 会把工作区里任何
  名为 `AGENTS.md` 的文件当作该目录范围的指令自动注入，改名是为了不让别人 clone 本仓库时
  被动加载它。
- `scripts/install.ps1` 未签名。调用方用 `powershell -ExecutionPolicy Bypass -File` 最稳；
  直接 `& .\scripts\install.ps1` 在部分环境下会被 `PSSecurityException` 拦下（实测过
  `RemoteSigned` 下也报「未对文件进行数字签名」）。

## License

MIT
