# context-recap

**让每次回答都带上「我当初为什么要问」。**

一个 DSH 技能：每次回答结束时，把「问题背景 + 目标 + 当前进度」写成一份短摘要，显示在右侧边栏。
半天后回到这个会话，看一眼侧边栏就能想起上下文 —— 不用回头翻聊天记录。

## 装它

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

装完**新开一个对话**、提一个**实质任务**（例如「看看这个文件夹里有什么」），看右侧边栏有没有
出现「问题背景」标签页。

不想用脚本也行：把目录复制成 `~/.dsh/skills/context-recap/`（里面必须有 `SKILL.md`），
再把 `AGENTS.md.template` 的内容追加进 `~/.dsh/AGENTS.md`。

## 为什么还要装一条全局指令

因为它**必须**每轮都触发，而技能做不到这件事。

技能目录每轮只是把名字和描述放进系统提示，**是否加载由模型自己决定**。实测：新对话里
`context-recap` 明明在技能目录中，两轮下来 0 次工具调用，什么都没出现。

所以分工是：**技能负责「怎么写」，全局指令负责「必须写」。** 指令写进 `~/.dsh/AGENTS.md`，
DSH 会把它注入每一个会话的系统提示。

- 影响**所有**会话；不想要了，删掉 `<!-- context-recap:begin -->` 和
  `<!-- context-recap:end -->` 之间的内容即可。
- 脚本是**幂等**的，重复执行只会原地替换，不会叠加；你原有的全局指令会保留。

## 它写什么、写到哪

写在当前工作区根目录下，**每个会话一份**：

```
<工作区>/.context-recap/<DSH_SESSION_ID>.md
```

文件名就是 DSH 注入给工具进程的会话标识（同时也是会话日志的目录名）。所以同一个工作区里
并行跑多个 Agent，各自的摘要互不覆盖；侧边栏按路径去重，每个会话复用自己那个标签页。

摘要长这样：

```markdown
# 问题背景摘要

> 最后更新：2026-10-16 14:21 · 状态：进行中

## 为什么问这个
同时挂了三个 Agent 排查线上问题，每个都要半小时以上才回，过一阵子我忘了当初为什么要问。

## 目标
让每次回答结束时自动显示「这问题是为什么、做到哪了」。

## 现在的进度
- 已完成：确认 sidebar_open 可用；dsh-better-sidebar@0.26.0 已安装。
- 未完成：还没验证 .md 预览是否自动刷新。

## 下一步
- 用实质任务在新会话里验证一次。
```

建议在工作区 `.gitignore` 里加一行 `.context-recap/`。

## 前提

1. DSH 设置里打开 **「模型可在侧边栏打开文件（side card）」** —— 关着的话摘要送不进侧边栏。
2. 右侧边栏插件（`dsh-better-sidebar` 或 DSH 自带侧边栏）已启用 —— 负责渲染 Markdown。

验证请用**实质任务**。按默认配置，纯寒暄（`你好`）和单步确认（`回复我:x`）会被有意跳过。

## 只想给某个项目用？

DSH 也会读**工作区里**的 `AGENTS.md`。把 `AGENTS.md.template` 复制成 `<项目根>/AGENTS.md`
即可，不必动全局配置。

（模板用 `.template` 扩展名正是为了这个：文件一旦叫 `AGENTS.md`，别人把本仓库 clone 进工作区时
会被 DSH 自动注入。）

## 开销

每个实质回合多约 3 次模型往返、300–700 输出 tokens。**没有额外的「总结」API 调用** ——
摘要是同一个 agent 在同一轮顺手写出来的。寒暄和单步确认默认跳过。

## 目录

```
SKILL.md              技能本体（DSH 只认这个文件）
references/           摘要格式模板与正反例
AGENTS.md.template    要写进 ~/.dsh/AGENTS.md 的全局指令片段
install.ps1           Windows 安装（--GlobalInstruction）
install.sh            macOS / Linux 安装（--global-instruction）
```

## 维护注意

- `SKILL.md`、`AGENTS.md.template`：**不要加 BOM**，DSH 按 UTF-8 读它们。
- `install.ps1`：含中文，**必须 UTF-8 with BOM**。PowerShell 5.1 会把无 BOM 的 UTF-8 当 ANSI 读，
  成对的 GBK 字节会吃掉行尾引号与换行。改完请确认 BOM 还在。
- `install.sh`：保持 **LF** 行尾（`.gitattributes` 已固定）。
- 安装脚本未被签名，调用时用 `powershell -NoProfile -ExecutionPolicy Bypass -File` 最稳。
- 备份目录必须在 `skills/` **之外**（`skills/` 下每个子目录都会被当成一个技能扫描）。

## License

MIT
