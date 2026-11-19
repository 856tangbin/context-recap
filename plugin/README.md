# 会话看板（context-recap board）

右侧栏里的常驻页面：把所有**未归档会话**的 `context-recap` 卡片聚合成一张看板，按
`status` 分组、按 `updated` 排序，不必再去各工作区翻 `.context-recap/` 目录。

## 它读什么

- 会话列表与归档状态：Host 的 Workspace / Session 客户端模型（`useWorkspaces`、`useSessions`），
  所以已归档的会话自动消失，不需要解析 `~/.dsh/storages/workspace.json`。
- 每张卡片：`<会话的工作目录>\.context-recap\<sessionId>.md`，通过 `workspaceFiles.read` 读取
  （只读，越出工作区也可读）。

没有卡片的会话会落在「缺卡片」一组，提示你补卡或归档。

## 怎么打开

右侧栏（⌘/Ctrl 右侧面板）的「+」或引导页里选「会话看板」。标签页本身是一个 page tab，
每个会话一份，互不影响。

## 刷新

页面头部有刷新按钮；切回标签页时不会自动重读，避免无谓的 IO。数据量很小（一次 10 来个文件），
点一下即可。

## 依赖

- DSH 内置服务：`slots`、`locale`、`sidebarRightTabs`、`remote`、`remote.workspaceFiles`、
  `uiWorkspace`、`sessions`、`workspaces`。
- 不依赖任何第三方插件；不注入 Host 代码（`index.js` 为空 `apply`）。
- 需要卡片按 `context-recap` 技能的新格式（YAML frontmatter：`session/title/status/updated/next`）。

## 与脚本版的关系

`context-recap/scripts/board.mjs` 生成的是磁盘上的 `BOARD.md`（可提交、可分享）；本插件是同一份
数据的实时视图，供你在 DSH 里随时扫一眼。两者互不依赖。
