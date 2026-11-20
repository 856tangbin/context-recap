# 会话看板（context-recap board）

右侧栏里的常驻页面：把所有**未归档会话**的 `context-recap` 卡片聚合成一张看板，按
`status` 排序，不必再去各工作区翻 `.context-recap/` 目录。

## 它读什么

- 会话全集与归档状态：Host 的 Workspace 客户端模型（`useWorkspaces()` 的 `items[*].sessionIds`
  与 `archivedSessionIds`），所以已归档的会话自动消失，不需要解析 `~/.dsh/storages/workspace.json`。
- 会话标题兜底：`useSessions()` 快照的 `displayTitle` / `cwd`。
- 每张卡片：`<会话的工作目录>\.context-recap\<sessionId>.md`，通过 `workspaceFiles.read` 读取
  （只读，越出工作区也可读）。

没有卡片的会话不会出现在看板里，空会话与只有一两句话的会话也会被跳过，避免占版面。

## 怎么打开

右侧栏（⌘/Ctrl 右侧面板）的「+」或引导页里选「会话看板」。标签页本身是一个 page tab，
每个会话一份，互不影响。

## 交互

- 双击一行打开那个会话；单击不响应，防止滑一下鼠标就跳走。
- 当前所在的会话行有「当前」色签、加深底色与描边，一眼能认出来。
- 正在运行的会话标题前有转环；进行中绿、已完成灰，行底是向左淡出的渐变。
- 已完成默认折叠；查看已完成会话时自动展开，组上方按钮可手动切换当前视图。

## 刷新

页面头部有刷新按钮；切回标签页时不会自动重读，避免无谓的 IO。数据量很小，点一下即可。

## 依赖

- DSH 内置服务：`slots`、`locale`、`sidebarRightTabs`、`remote`、`remote.workspaceFiles`、
  `uiWorkspace`。
  （`sessions` / `workspaces` 只是 slot 的 standardProps，不是可注入的 cordis 服务，写进
  `inject` 会让插件永远等待。）
- 不依赖任何第三方插件；不注入 Host 代码（`index.js` 为空 `apply`）。
- 需要卡片按 `context-recap` 技能的新格式（YAML frontmatter：`session/title/status/updated/next`）。

## 与脚本版的关系

`context-recap/scripts/board.mjs` 生成的是磁盘上的 `BOARD.md`（可提交、可分享）；本插件是同一份
数据的实时视图，供你在 DSH 里随时扫一眼。两者互不依赖。
