/**
 * The right-Sidebar board page: every unarchived Session's context-recap card,
 * grouped by status and ordered by recency.
 *
 * Data comes from the Client models, not from files on the Host:
 * - `useSessions()` gives each Session's working directory and fallback title.
 * - `useWorkspaces()` gives the archived set, so archived Sessions drop out.
 * - `workspaceFiles.read` reads `<cwd>\.context-recap\<sessionId>.md` (read-only,
 *   allowed outside the Session's own workspace).
 *
 * Nothing is polled: the page reads on mount, on refresh, and whenever the
 * archived set changes.
 */
window.__ModuleLoader__.load({
  id: '@local/context-recap-board',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'contextRecapBoard'
    const TAB_ID = 'context-recap-board'
    const KIND = 'context-recap-board'
    const STALE_DAYS = 3

    const zh = {
      'tab.title': '看板',
      'tab.description': '所有未归档会话的卡片，按状态排序',
      'ui.refresh': '刷新',
      'ui.loading': '正在读取卡片…',
      'ui.empty': '没有未归档的会话',
      'ui.error': '读取失败',
      'ui.open': '打开会话',
      'ui.stale': '天未动',
      'ui.updated': '更新于',
      'ui.count': '个未归档会话',
      'ui.missingHint': '没有卡片：补一张卡片，或把这个会话归档',
      'ui.doneHint': '已完成，可以归档',
      'ui.showMissing': '显示没有卡片的会话',
      'ui.hideMissing': '收起没有卡片的会话',
      'group.blocked': '阻塞',
      'group.doing': '进行中',
      'group.done': '已完成',
      'group.missing': '缺卡片',
      'time.justNow': '刚刚',
      'time.minutesAgo': '分钟前',
      'time.hoursAgo': '小时前',
      'time.daysAgo': '天前',
    }

    const en = {
      'tab.title': 'Board',
      'tab.description': 'Every unarchived Session card, ordered by status',
      'ui.refresh': 'Refresh',
      'ui.loading': 'Reading cards…',
      'ui.empty': 'No unarchived Sessions',
      'ui.error': 'Read failed',
      'ui.open': 'Open Session',
      'ui.stale': 'days idle',
      'ui.updated': 'updated',
      'ui.count': 'unarchived Sessions',
      'ui.missingHint': 'No card: write one, or archive this Session',
      'ui.doneHint': 'Done — ready to archive',
      'ui.showMissing': 'Show Sessions without a card',
      'ui.hideMissing': 'Hide Sessions without a card',
      'group.blocked': 'Blocked',
      'group.doing': 'In progress',
      'group.done': 'Done',
      'group.missing': 'Missing card',
      'time.justNow': 'just now',
      'time.minutesAgo': 'min ago',
      'time.hoursAgo': 'h ago',
      'time.daysAgo': 'd ago',
    }

    const S = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        lineHeight: 1.55,
      },
      head: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderBottom: '1px solid var(--dsw-alias-border-l2)',
        flex: '0 0 auto',
      },
      headTitle: { fontWeight: 600, fontSize: 13 },
      headMeta: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
        flex: '1 1 auto',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      refresh: {
        flex: '0 0 auto',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        cursor: 'pointer',
      },
      body: { flex: '1 1 auto', overflowY: 'auto', padding: '6px 8px 14px' },
      group: { margin: '10px 0 4px', padding: '0 4px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, letterSpacing: 0.2 },
      row: {
        display: 'flex',
        gap: 8,
        padding: '7px 8px',
        margin: '2px 0',
        borderRadius: 8,
        background: 'var(--dsw-alias-card-fill)',
        cursor: 'pointer',
      },
      glyph: { flex: '0 0 auto', width: 16, textAlign: 'center', fontSize: 12, lineHeight: '20px' },
      main: { flex: '1 1 auto', minWidth: 0 },
      title: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      meta: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      desc: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11.5,
        marginTop: 2,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      next: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      blocked: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 11, marginTop: 2 },
      hint: { padding: '18px 12px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, textAlign: 'center' },
      err: { color: 'var(--dsw-alias-state-error-primary)' },
      footer: { padding: '4px 12px 10px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, flex: '0 0 auto' },
      more: {
        display: 'block',
        width: '100%',
        margin: '12px 0 0',
        padding: '7px 10px',
        border: '1px dashed var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        borderRadius: 6,
        fontSize: 12,
        textAlign: 'left',
        cursor: 'pointer',
      },
    }

    // ---------------------------------------------------------------- cards

    function splitFrontmatter(text) {
      const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(text)
      if (!m) return { meta: {}, body: text }
      const meta = {}
      for (const raw of m[1].split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.charAt(0) === '#') continue
        const at = line.indexOf(':')
        if (at <= 0) continue
        const key = line.slice(0, at).trim()
        let value = line.slice(at + 1).trim()
        if (value.length >= 2) {
          const first = value.charAt(0)
          const last = value.charAt(value.length - 1)
          if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1)
        }
        if (value !== '') meta[key] = value
      }
      return { meta, body: text.slice(m[0].length) }
    }

    function sectionText(body, names) {
      const lines = String(body).split(/\r?\n/)
      const out = []
      let active = false
      for (const line of lines) {
        const head = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
        if (head) {
          if (active) break
          const title = head[2].trim()
          active = names.some(function (name) { return title === name || title.indexOf(name) === 0 })
          continue
        }
        if (active) out.push(line)
      }
      return out.join('\n')
    }

    function labeledValue(body, labels) {
      const lines = String(body).split(/\r?\n/)
      for (const line of lines) {
        const m = /^\s*[-*]?\s*\*\*([^*]+)\*\*\s*[：:]\s*(.*)$/.exec(line)
        if (m && labels.indexOf(m[1].trim()) >= 0) return m[2].trim()
      }
      return ''
    }

    function firstMeaningful(text) {
      const lines = String(text || '').split(/\r?\n/)
      for (const raw of lines) {
        const line = raw.trim().replace(/^[-*]\s+/, '')
        if (line && line !== '—' && line !== '-') return line
      }
      return ''
    }

    function parseTime(value) {
      const text = String(value || '').trim()
      if (!text) return 0
      const iso = text.replace(' ', 'T')
      const stamp = Date.parse(iso)
      if (!Number.isNaN(stamp)) return stamp
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
      if (day) return Date.parse(text + 'T00:00:00')
      return 0
    }

    function normalizeStatus(value) {
      const text = String(value || '').trim().toLowerCase()
      if (!text) return 'doing'
      if (text === 'done' || text === '已完成' || text === '完成' || text === 'finished') return 'done'
      if (text === 'blocked' || text === '受阻' || text === '阻塞' || text === 'stuck') return 'blocked'
      return 'doing'
    }

    function cardPath(cwd, id) {
      return String(cwd).replace(/[\\/]+$/, '') + '\\.context-recap\\' + id + '.md'
    }

    function buildRow(candidate, text, missing) {
      if (missing || !String(text || '').trim()) {
        return { id: candidate.id, title: candidate.fallbackTitle, workspaceTitle: candidate.workspaceTitle, status: 'missing', updated: 0, next: '', blockedOn: '', goal: '', cwd: candidate.cwd }
      }
      const split = splitFrontmatter(text)
      const meta = split.meta
      const body = split.body
      const goal = meta.goal || firstMeaningful(sectionText(body, ['目标', 'Goal']))
      const next = meta.next || firstMeaningful(sectionText(body, ['下一步', 'Next']))
      const blockedOn = meta.blocked_on || meta.blockedOn || ''
      const status = meta.status ? normalizeStatus(meta.status) : normalizeStatus(labeledValue(body, ['状态', 'Status']))
      const updated = parseTime(meta.updated) || parseTime(labeledValue(body, ['最后更新', 'Last updated', 'Updated']))
      return {
        id: candidate.id,
        title: meta.title || goal || candidate.fallbackTitle,
        workspaceTitle: candidate.workspaceTitle,
        status: status,
        updated: updated,
        next: next,
        blockedOn: blockedOn,
        goal: goal,
        cwd: candidate.cwd,
      }
    }

    const RANK = { blocked: 0, doing: 1, done: 2, missing: 3 }

    function compareRows(a, b) {
      const rank = (RANK[a.status] === undefined ? 9 : RANK[a.status]) - (RANK[b.status] === undefined ? 9 : RANK[b.status])
      if (rank !== 0) return rank
      if (a.updated !== b.updated) return b.updated - a.updated
      return String(a.title).localeCompare(String(b.title))
    }

    function relativeTime(stamp, t, now) {
      if (!stamp) return ''
      const diff = Math.max(0, now - stamp)
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return t('time.justNow')
      if (minutes < 60) return minutes + ' ' + t('time.minutesAgo')
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return hours + ' ' + t('time.hoursAgo')
      return Math.floor(hours / 24) + ' ' + t('time.daysAgo')
    }

    function shortPath(path) {
      const parts = String(path || '').split(/[\\/]+/).filter(Boolean)
      return parts.length > 2 ? parts.slice(-2).join('\\') : String(path || '')
    }

    // ------------------------------------------------------------ component

    const EMPTY_WS = { items: [], archivedSessionIds: [], phase: 'ready' }
    const EMPTY_SS = { byId: {} }

    function Board(props) {
      const t = typeof props.t === 'function' ? props.t : function (key) { return key }
      const sessionId = props.sessionId
      const useWs = typeof props.useWorkspaces === 'function' ? props.useWorkspaces : null
      const useSs = typeof props.useSessions === 'function' ? props.useSessions : null
      const wsSnapshot = useWs ? useWs(function (state) { return state }) : EMPTY_WS
      const ssSnapshot = useSs ? useSs(function (state) { return state }) : EMPTY_SS
      const sessionsRef = React.useRef(ssSnapshot)
      sessionsRef.current = ssSnapshot
      const readRef = React.useRef(props.readCard)
      readRef.current = props.readCard
      const openSession = typeof props.openSession === 'function' ? props.openSession : null

      const archived = wsSnapshot && Array.isArray(wsSnapshot.archivedSessionIds) ? wsSnapshot.archivedSessionIds : []
      const archivedKey = archived.join(',')
      const wsItems = wsSnapshot && Array.isArray(wsSnapshot.items) ? wsSnapshot.items : []
      const wsKey = wsItems.map(function (ws) { return ws && Array.isArray(ws.sessionIds) ? ws.sessionIds.join('.') : '' }).join('|')
      const phase = wsSnapshot && wsSnapshot.phase
      const ready = !phase || phase === 'ready'

      const [tick, setTick] = React.useState(0)
      const [showMissing, setShowMissing] = React.useState(false)
      const [state, setState] = React.useState({ status: 'loading', rows: [], error: null, at: 0 })

      React.useEffect(function () {
        if (!ready) return undefined
        const ctrl = new AbortController()
        let cancelled = false
        setState(function (prev) {
          return { status: prev.rows.length > 0 ? 'refreshing' : 'loading', rows: prev.rows, error: null, at: prev.at }
        })
        ;(async function () {
          const snapshot = sessionsRef.current || EMPTY_SS
          const byId = snapshot.byId || {}
          const archivedSet = new Set(archived)
          const candidates = []
          const seen = new Set()
          for (const ws of wsItems) {
            if (!ws || !Array.isArray(ws.sessionIds)) continue
            for (const id of ws.sessionIds) {
              if (!id || seen.has(id)) continue
              if (archivedSet.has(id)) continue
              if (String(id).indexOf('im:') === 0) continue
              const session = byId[id] || {}
              if (session.blank === true) continue
              if (session.parentSessionId) continue
              const cwd = String(session.cwd || ws.path || '')
              if (!cwd) continue
              seen.add(id)
              candidates.push({
                id: id,
                cwd: cwd,
                workspaceTitle: ws.title || '',
                fallbackTitle: session.displayTitle || id,
              })
            }
          }
          const rows = await Promise.all(candidates.map(async function (candidate) {
            const path = cardPath(candidate.cwd, candidate.id)
            let text = ''
            let missing = false
            try {
              const result = await readRef.current(path, ctrl.signal)
              if (result && result.ok) text = result.value && typeof result.value.text === 'string' ? result.value.text : ''
              else missing = true
            } catch (error) {
              missing = true
            }
            return buildRow(candidate, text, missing)
          }))
          rows.sort(compareRows)
          if (!cancelled) setState({ status: 'ready', rows: rows, error: null, at: Date.now() })
        })().catch(function (error) {
          if (!cancelled) {
            setState({ status: 'error', rows: [], error: String((error && error.message) || error), at: Date.now() })
          }
        })
        return function () {
          cancelled = true
          ctrl.abort()
        }
      }, [tick, ready, archivedKey, wsKey, sessionId])

      const now = Date.now()
      const rows = state.rows || []
      const missingRows = rows.filter(function (row) { return row.status === 'missing' })
      const visibleRows = showMissing ? rows : rows.filter(function (row) { return row.status !== 'missing' })
      const hiddenMissing = showMissing ? 0 : missingRows.length
      const groups = [
        { key: 'blocked', label: t('group.blocked'), glyph: '⛔', rows: visibleRows.filter(function (row) { return row.status === 'blocked' }) },
        { key: 'doing', label: t('group.doing'), glyph: '▶', rows: visibleRows.filter(function (row) { return row.status === 'doing' }) },
        { key: 'done', label: t('group.done'), glyph: '⏸', rows: visibleRows.filter(function (row) { return row.status === 'done' }) },
        { key: 'missing', label: t('group.missing'), glyph: '❓', rows: showMissing ? missingRows : [] },
      ]
      const countText = visibleRows.length + ' ' + t('ui.count')

      let body
      if (state.status === 'loading') {
        body = h('div', { style: S.hint }, t('ui.loading'))
      } else if (state.status === 'error') {
        body = h('div', { style: Object.assign({}, S.hint, S.err) }, t('ui.error') + '：' + state.error)
      } else if (visibleRows.length === 0 && hiddenMissing === 0) {
        body = h('div', { style: S.hint }, t('ui.empty'))
      } else {
        const children = []
        for (const group of groups) {
          if (group.rows.length === 0) continue
          children.push(h('div', { key: 'g-' + group.key, style: S.group }, group.glyph + ' ' + group.label + ' · ' + group.rows.length))
          for (const row of group.rows) {
            const stale = row.status === 'doing' && row.updated > 0 && now - row.updated > STALE_DAYS * 86400000
            const staleDays = stale ? Math.floor((now - row.updated) / 86400000) : 0
            const wsLabel = row.workspaceTitle || shortPath(row.cwd)
            let metaText
            if (row.status === 'missing') metaText = wsLabel + ' · ' + t('ui.missingHint')
            else if (row.status === 'done') metaText = wsLabel + ' · ' + t('ui.doneHint')
            else {
              metaText = wsLabel
              if (row.updated) metaText += ' · ' + t('ui.updated') + ' ' + relativeTime(row.updated, t, now)
              if (stale) metaText += ' · ' + staleDays + ' ' + t('ui.stale')
            }
            const desc = row.goal && row.goal !== row.title ? h('div', { style: S.desc }, row.goal) : null
            const detail = row.status === 'blocked'
              ? h('div', { style: S.blocked }, row.blockedOn || row.next || '')
              : (row.next ? h('div', { style: S.next }, '→ ' + row.next) : null)
            children.push(h('div', {
              key: 'r-' + row.id,
              style: S.row,
              role: 'button',
              tabIndex: 0,
              title: openSession ? t('ui.open') : undefined,
              onClick: function () { if (openSession) openSession(row.id) },
              onKeyDown: function (event) {
                if (openSession && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  openSession(row.id)
                }
              },
            },
              h('div', { style: S.glyph }, group.glyph),
              h('div', { style: S.main },
                h('div', { style: S.title }, row.title || row.id),
                h('div', { style: S.meta }, metaText),
                desc,
                detail,
              ),
            ))
          }
        }
        if (hiddenMissing > 0) {
          children.push(h('button', {
            key: 'more-missing',
            type: 'button',
            style: S.more,
            onClick: function () { setShowMissing(true) },
          }, '❓ ' + t('ui.showMissing') + ' · ' + hiddenMissing))
        } else if (missingRows.length > 0) {
          children.push(h('button', {
            key: 'less-missing',
            type: 'button',
            style: S.more,
            onClick: function () { setShowMissing(false) },
          }, t('ui.hideMissing')))
        }
        body = children
      }

      return h('div', { style: S.root },
        h('div', { style: S.head },
          h('div', { style: S.headTitle }, t('tab.title')),
          h('div', { style: S.headMeta }, countText),
          h('button', {
            type: 'button',
            style: S.refresh,
            onClick: function () { setTick(function (value) { return value + 1 }) },
          }, t('ui.refresh')),
        ),
        h('div', { style: S.body }, body),
        state.at ? h('div', { style: S.footer }, t('ui.updated') + ' ' + relativeTime(state.at, t, now)) : null,
      )
    }

    return {
      inject: [
        'slots', 'locale', 'sidebarRightTabs', 'remote', 'remote.workspaceFiles', 'uiWorkspace',
      ],
      apply(ctx) {
        ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'context-recap-board: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.effect(function () {
          return ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: KIND,
            title: function () { return t('tab.title') },
            guide: [{
              id: 'open',
              order: 60,
              title: function () { return t('tab.title') },
              description: function () { return t('tab.description') },
            }],
          })
        }, 'context-recap-board: tab type')
        ctx.effect(function () {
          return ctx.slots.inject('sidebar.right.pane.tab', function () {
            return ctx.slots.register({
              name: 'sidebar.right.pane.tab',
              key: TAB_ID,
              locale: NS,
              inject: function (sessionId) {
                return {
                  readCard: function (path, signal) {
                    return ctx.remote.workspaceFiles.read(sessionId, path, {}, signal)
                  },
                  openSession: function (id) {
                    if (ctx.uiWorkspace) ctx.uiWorkspace.openSession(id)
                  },
                }
              },
            }, Board)
          })
        }, 'context-recap-board: tab body')
      },
    }
  },
})
