# 会话看板

在右侧栏常驻一页，把当前所有**未归档会话**的 `context-recap` 卡片按状态聚合成一张看板。

## 数据来源

| 数据 | 来源 |
| --- | --- |
| 会话列表、工作目录 | `useSessions()` 客户端快照（`byId[*].cwd`、`displayTitle`） |
| 已归档集合 | `useWorkspaces()` 客户端快照（`archivedSessionIds`） |
| 卡片内容 | `ctx.remote.workspaceFiles.read(sessionId, <cwd>\.context-recap\<sessionId>.md)` |

卡片格式见 `context-recap` 技能的 `references/recap-format.md`：YAML frontmatter 提供
`status` / `updated` / `next` / `blocked_on`，正文四段提供细节。旧卡片没有 frontmatter 时，
从正文回捞「状态」「最后更新」，所以历史卡片也能显示。

## 分组

| 组 | 条件 |
| --- | --- |
| ⛔ 阻塞 | `status: blocked`，显示 `blocked_on` |
| ▶ 进行中 | `status: doing`（缺省），`updated` 倒序，超过 3 天标「已 N 天未动」 |
| ⏸ 已完成 | `status: done`，提示可以归档 |
| ❓ 缺卡片 | 未归档但找不到卡片，建议补卡或归档 |

点击一行会跳到那个会话（`uiWorkspace.openSession`）。

## 刷新策略

- 打开标签页时读一次。
- 头部刷新按钮重读。
- 归档集合变化时自动重读（归档一个会话，看板立刻少一行）。

不做轮询：卡片是 Agent 在每轮收尾时写的，看板只需要「看一眼时是新的」。
