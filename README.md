# context-recap

**让每次回答都带上「我当初为什么要问」。**

一个 DSH 技能：每次回答结束时，在正文末尾用一段引用块补上「为什么问、目标、进度、下一步」。
半天后回到这个会话，滑到底就能想起上下文。

**零依赖**：不写文件、不开侧边栏、不需要任何插件，也不额外调用工具 —— 它就是回答的一部分。

## 它长什么样

> **问题背景** · 状态：进行中
>
> - **为什么问这个**：同时挂了三个 Agent 排查线上问题，每个都要半小时以上才回，等回来我忘了当初要做什么。
> - **目标**：让每次回答结束时都能看到「这问题是为什么、做到哪了」。
> - **现在的进度**：改为行内引用块；技能、安装脚本、README 已同步。
> - **下一步**：新开一个对话提个实质任务，看回答末尾。

标题与列表之间那条空的 `>` 不能省 —— 少了它，连续多行引用会被 Markdown 合并成一整段。

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

装完**新开一个对话**、提一个**实质任务**，看回答末尾。

不想用脚本也行：把 `SKILL.md` 放进 `~/.dsh/skills/context-recap/`，
再把 `AGENTS.md.template` 的内容追加进 `~/.dsh/AGENTS.md`。

## 为什么还要装一条全局指令

因为它必须**每轮都触发**，而技能做不到这件事。

技能目录每轮只是把名字和描述放进系统提示，**是否加载由模型自己决定**。实测：新对话里
`context-recap` 明明在技能目录中，两轮下来 0 次工具调用，什么都没出现。

分工是：**技能负责「写成什么样」，全局指令负责「必须写」。** 指令写进 `~/.dsh/AGENTS.md`，
DSH 会把它注入每一个会话的系统提示。

- 影响**所有**会话；不想要了，删掉 `<!-- context-recap:begin -->` 与
  `<!-- context-recap:end -->` 之间的内容即可。
- 脚本是**幂等**的，重复执行只会原地替换，不会叠加；你原有的全局指令会保留。

## 前提

没有。不需要开侧边栏、不需要装任何侧边栏插件、不需要额外权限 —— 它只是回答格式。

## 只想给某个项目用？

DSH 也会读**工作区里**的 `AGENTS.md`。把 `AGENTS.md.template` 复制成 `<项目根>/AGENTS.md`
即可，不必动全局配置。

（模板用 `.template` 扩展名正是为了这个：文件一旦叫 `AGENTS.md`，别人把本仓库 clone 进工作区时
会被 DSH 自动注入。）

## 开销

约 3–5 行输出。**没有工具调用、没有额外模型往返、没有文件写入。**
寒暄和单步确认默认跳过。

## 目录

```
SKILL.md              技能本体（格式规范 + 正反例）
AGENTS.md.template    写进 ~/.dsh/AGENTS.md 的全局指令（保证每轮触发）
install.ps1           Windows 安装（-GlobalInstruction）
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
