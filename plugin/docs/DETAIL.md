# 会话看板

在右侧栏常驻一页，把当前所有**未归档会话**的 `context-recap` 卡片按状态聚合成一张看板。

## 数据来源

| 数据 | 来源 |
| --- | --- |
| 会话与工作目录 | `useWorkspaces()` 快照：`items[*].sessionIds` 是会话全集，`items[*].path` 是工作目录 |
| 已归档集合 | `useWorkspaces()` 快照的 `archivedSessionIds` |
| 会话标题兜底 | `useSessions()` 快照的 `byId[*].displayTitle`、`cwd` |
| 卡片内容 | `ctx.remote.workspaceFiles.read(sessionId, <cwd>\.context-recap\<sessionId>.md)` |

卡片格式见 `context-recap` 技能的 `references/recap-format.md`：YAML frontmatter 提供
`status` / `updated` / `next` / `blocked_on`，正文三段提供细节。旧卡片没有 frontmatter 时，
从正文回捞「状态」「最后更新」，所以历史卡片也能显示。

## 排序与分组

状态决定顺序：⛔ 阻塞 → ▶ 进行中（`updated` 倒序，超过 3 天标「已 N 天未动」）→
⏸ 已完成。组与组之间只留空白，不再渲染分组标题行。

- 进行中的行不显示状态字：转环、圆环与渐变底已经说明它在跑。
- 已完成与阻塞在行尾用「小圆点 + 灰字」标出，不占版面。
- 已完成默认折叠，组上方有「展开已完成 · N」；展开后按钮留在组头，再点收起。
  展开状态存在 `localStorage`（`contextRecapBoard.showDone`），切换会话或整页刷新都会保持。

空会话、只有一两句话的会话不会出现；没有卡片的会话直接不展示。

## 交互

- **双击**一行跳到那个会话（`uiWorkspace.openSession`）。单击不响应，避免误点。
- 当前所在的会话行会高亮：色签「当前」、标题加粗、底色加深、同色描边。
- 正在运行的会话在标题前转一个 10px 的圆环（状态色，0.8s 一圈）。
- 进行中绿、已完成灰，行底是左侧浓、向右淡出的渐变。

## 刷新策略

- 打开标签页时读一次。
- 头部刷新按钮重读。
- 归档集合变化时自动重读（归档一个会话，看板立刻少一行）。

不做轮询：卡片是 Agent 在每轮收尾时写的，看板只需要「看一眼时是新的」。
