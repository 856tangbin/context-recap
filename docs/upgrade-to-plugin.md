# 从 Skill 升级为侧边栏 Tab 插件

当前版本用技能 + `sidebar_open` 实现，已经能拿到主要价值。想更进一步时的路线记录在这里，
**摘要的内容契约（SKILL.md 里那四个问题）不用改，只把「写文件 + 手动打开」换成「插件渲染」。**

## 什么时候值得升级

- 希望**必然**每轮触发，不依赖模型是否加载了技能；
- 想要比 Markdown 更强的呈现：时间线、多轮意图对比、状态徽标、点击跳回对话、按会话隔离；
- 想做成可发布给别人装的插件。

## 关键事实（已在本机核实）

- 侧边栏插件 `dsh-better-sidebar@0.26.0` 已安装在
  `~/.dsh/profiles/desktop/node_modules/dsh-better-sidebar`。
- 它暴露 `ctx.betterSidebar` 服务，提供 `registerTab` 与 `registerFileViewer` 两个扩展点，
  内置 6 个 tab 与第三方插件走同一套 API（见其 `README.md` 的「服务化扩展」章节，或包内
  `docs/external-plugin-guide.md`）。
- 注册形态：

  ```ts
  import type {} from 'dsh-better-sidebar'   // 触发 ctx.betterSidebar 类型合并

  export const inject = ['betterSidebar']

  export function apply(ctx: Context) {
    ctx.effect(() => ctx.betterSidebar.registerTab({
      id: 'context-recap:main',
      title: '问题背景',
      component: ({ scope }) => <RecapView sessionId={scope.sessionId} />,
    }))
  }
  ```

- 插件按 DSH 官方规范组织：`package.json` 里 `dsh.bundle.patch` 指向 `cordis.patch.yml`，
  `dsh.client.inject` 声明依赖的客户端能力（含 `@deepseek-ai/dsh-client-ui-sidebar-right`），
  无 default 导出、host/client 双 bundle。
- 构建链：`tsdown`；typecheck 用 `tsc --noEmit`；基线 peer 版本 `@deepseek-ai/*@0.2.0-rc.*`。
- 安装：`dsh plugin --profile desktop add <包名或路径>`，bundle 的 patch 会自动插入挂载行。

## 参考实现（同类插件，可直接读源码）

- `YesSanSan/dsh-conversation-outline` —— 对话大纲页：按轮次结构化展示、一键跳转、LLM 一句话标题。
  和本需求最接近。
- `Andor-Z/dsh-turn-outline` —— 轮次轨迹页，零 LLM、只读。
- `yq04/dsh-turn-review` —— 逐回合审查 agent 改动。
- GitHub topic [`dsh-better-sidebar`](https://github.com/topics/dsh-better-sidebar) 下还有 28+ 个插件。

## 建议的落地顺序

1. 先用当前 Skill 版本跑一两周，确认摘要里到底该写哪几行——**这一步定的是产品，不是代码**。
2. 把确认后的字段固化成 `RecapData` 类型（例如 `{ why, goal, status, done[], blocked[], next[] }`）。
3. 写 host 侧：会话消息 → `RecapData`。两种取数方式：
   - 零 LLM：取用户消息 + 助手末段文本做结构化拼接，成本为零；
   - LLM：调用一次模型生成一句意图标题（`dsh-conversation-outline` 的做法）。
4. 写 client 侧 `RecapView`，用 `registerTab` 注册；数据经插件的 `/recap/api/*` 路由按会话拉取。
5. 加一个设置项开关与「关闭纯闲聊摘要」的阈值，避免噪音。
