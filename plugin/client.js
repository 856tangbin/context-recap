/**
 * The right-Sidebar board page: every unarchived Session's context-recap card,
 * grouped by status and ordered by recency.
 *
 * Data comes from the Client models, not from files on the Host:
 * - `useWorkspaces()` gives workspace items (each with sessionIds) and the
 *   archived set, so archived Sessions drop out.
 * - `useSessions()` gives each Session's working directory and fallback title.
 * - `workspaceFiles.read` reads `<cwd>\.context-recap\<sessionId>.md` (read-only,
 *   allowed outside the Session's own workspace).
 *
 * Nothing is polled: the page reads on mount, on refresh, and whenever the
 * archived set changes.
 *
 * One timeline layout (dot + rail rows, tinted by status) is the only style;
 * the guide glyph mirrors it.
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

    // The guide capsule's glyph: the board's own timeline, at whatever size the
    // capsule asks for. Ink follows the theme; the live dot keeps the brand green.
    function BoardGlyph(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 24
      const line = { stroke: 'currentColor', strokeLinecap: 'round', fill: 'none' }
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        role: 'img',
        'aria-label': 'Session board',
        className: props && props.className,
        'aria-hidden': true,
      },
        h('line', Object.assign({ key: 'spine', x1: 7, y1: 4.6, x2: 7, y2: 19.4, strokeWidth: 1.5, opacity: 0.42 }, line)),
        h('circle', { key: 'dot-live', cx: 7, cy: 7.2, r: 2.05, fill: '#12aa52', stroke: 'none' }),
        h('circle', { key: 'dot-doing', cx: 7, cy: 12, r: 2.05, fill: 'currentColor', stroke: 'none' }),
        h('circle', { key: 'dot-done', cx: 7, cy: 16.8, r: 2.05, fill: 'currentColor', opacity: 0.38, stroke: 'none' }),
        h('line', Object.assign({ key: 'bar-1', x1: 11.6, y1: 7.2, x2: 18.8, y2: 7.2, strokeWidth: 1.6 }, line)),
        h('line', Object.assign({ key: 'bar-2', x1: 11.6, y1: 12, x2: 17.8, y2: 12, strokeWidth: 1.6 }, line)),
        h('line', Object.assign({ key: 'bar-3', x1: 11.6, y1: 16.8, x2: 15.8, y2: 16.8, strokeWidth: 1.6, opacity: 0.42 }, line)),
      )
    }

    // Card texts are cached across sessions and tab remounts: switching sessions
    // then re-renders instantly, and cards are only re-read when stale.
    const CARD_CACHE = new Map()
    const CARD_TTL = 15000
    let LAST_AT = 0

    const zh = {
      'tab.title': '看板',
      'tab.description': '所有未归档会话的卡片，按状态排序',
      'ui.boardTitle': '会话看板',
      'ui.current': '当前',
      'ui.openHint': '双击打开',
      'ui.thinking': '正在运行',
      'ui.refresh': '刷新',
      'ui.loading': '正在读取卡片…',
      'ui.empty': '没有未归档的会话',
      'ui.error': '读取失败',
      'ui.open': '打开会话',
      'ui.stale': '天未动',
      'ui.updated': '更新于',
      'ui.count': '个会话',
      'ui.missingHint': '没有卡片：补一张卡片，或把这个会话归档',
      'ui.doneHint': '已完成，可以归档',
      'ui.showMissing': '显示没有卡片的会话',
      'ui.hideMissing': '收起没有卡片的会话',
      'ui.showDone': '展开已完成',
      'ui.hideDone': '收起已完成',
      'ui.showScheduled': '展开定时任务',
      'ui.hideScheduled': '收起定时任务',
      'ui.style': '样式',
      'group.blocked': '阻塞',
      'group.doing': '进行中',
      'group.scheduled': '定时任务',
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
      'ui.boardTitle': 'Session board',
      'ui.current': 'Current',
      'ui.openHint': 'Double-click to open',
      'ui.thinking': 'Running',
      'ui.refresh': 'Refresh',
      'ui.loading': 'Reading cards…',
      'ui.empty': 'No unarchived Sessions',
      'ui.error': 'Read failed',
      'ui.open': 'Open Session',
      'ui.stale': 'days idle',
      'ui.updated': 'updated',
      'ui.count': 'Sessions',
      'ui.missingHint': 'No card: write one, or archive this Session',
      'ui.doneHint': 'Done — ready to archive',
      'ui.showMissing': 'Show Sessions without a card',
      'ui.hideMissing': 'Hide Sessions without a card',
      'ui.showDone': 'Show done',
      'ui.hideDone': 'Hide done',
      'ui.showScheduled': 'Show scheduled',
      'ui.hideScheduled': 'Hide scheduled',
      'ui.style': 'Style',
      'group.blocked': 'Blocked',
      'group.doing': 'In progress',
      'group.scheduled': 'Scheduled',
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
        lineHeight: 1.6,
        WebkitFontSmoothing: 'antialiased',
      },
      hero: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '18px 16px 2px',
        flex: '0 0 auto',
      },
      heroName: { fontWeight: 600, fontSize: 15, letterSpacing: 0.2, flex: '0 0 auto' },
      heroMeta: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10.5,
        flex: '1 1 auto',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      },
      refresh: {
        flex: '0 0 auto',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        padding: 0,
        fontSize: 10.5,
        cursor: 'pointer',
      },
      hint: { padding: '22px 14px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, textAlign: 'center' },
      err: { color: 'var(--dsw-alias-state-error-primary)' },
      footer: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px 10px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10.5,
        flex: '0 0 auto',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      more: {
        display: 'block',
        width: '100%',
        margin: '14px 0 0',
        padding: '6px 2px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
        textAlign: 'left',
        cursor: 'pointer',
      },
    }

    // ------------------------------------------------------------- variants

    // Muted accents that read on both light and dark backgrounds.
    // Green = in progress, grey = finished, light cyan = runs on a timer.
    const ACCENT = {
      blocked: '#c6545c',
      doing: '#12aa52',
      scheduled: '#66b3c0',
      done: '#9aa1aa',
      missing: '#bfc4cb',
    }

    function rgba(hex, alpha) {
      const text = String(hex).replace('#', '')
      const full = text.length === 3
        ? text.split('').map(function (ch) { return ch + ch }).join('')
        : text
      const num = parseInt(full, 16)
      const r = (num >> 16) & 255
      const g = (num >> 8) & 255
      const b = num & 255
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
    }

    const BASE = {
      group: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        margin: '24px 0 6px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10.5,
        letterSpacing: 0.5,
        fontWeight: 500,
      },
      groupCount: { marginLeft: 'auto', fontSize: 10, fontVariantNumeric: 'tabular-nums', fontWeight: 400 },
      row: {
        position: 'relative',
        padding: '12px 0',
        borderBottom: '1px solid var(--dsw-alias-border-l2)',
        cursor: 'pointer',
      },
      rowLast: { borderBottom: 'none' },
      title: { fontSize: 15, fontWeight: 600, lineHeight: 1.5, letterSpacing: 0.1 },
      meta: { fontSize: 10, marginTop: 7, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
      desc: { fontSize: 11.5, lineHeight: 1.65, marginTop: 6, clamp: 2, color: 'var(--dsw-alias-label-secondary)' },
      next: { fontSize: 10.5, marginTop: 8, lineHeight: 1.6, clamp: 2, color: 'var(--dsw-alias-label-tertiary)' },
      dotBase: { position: 'absolute', left: -4, top: 17, width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box' },
    }

    function variant(extra) {
      const out = Object.assign({}, BASE, extra)
      out.group = Object.assign({}, BASE.group, extra.group || {})
      out.row = Object.assign({}, BASE.row, extra.row || {})
      return out
    }

    // The «done» group is washed in a soft grey so finished work recedes;
    // «in progress» carries the green.
    const LAYOUT = variant({
      name: '点线签',
      body: { padding: '4px 16px 24px' },
      groupColor: true,
      rail: true,
      dotMode: 'solid',
      chip: true,
      doneStyle: { name: '段染', line: '#9aa1aa', dot: 'solid', chip: 'filled', tint: 0.07 },
      group: { margin: '24px 0 6px 25px' },
      row: {
        padding: '10px 12px 8px 22px',
        margin: '0 0 8px',
        marginLeft: 7,
        borderLeft: '1px solid var(--dsw-alias-border-l2)',
        borderBottom: 'none',
      },
    })

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
        return { id: candidate.id, title: candidate.fallbackTitle, workspaceTitle: candidate.workspaceTitle, status: 'missing', updated: 0, next: '', blockedOn: '', goal: '', cwd: candidate.cwd, running: candidate.running === true }
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
        running: candidate.running === true,
      }
    }

    const RANK = { blocked: 0, doing: 1, done: 2, missing: 3 }

    // A Session that a scheduled task delivers into belongs to its own group.
    function scheduledIdKey(result) {
      const ids = new Set()
      const value = result && result.ok ? result.value : null
      const items = value && Array.isArray(value.items) ? value.items : []
      for (const task of items) {
        if (!task) continue
        if (task.sessionId) ids.add(task.sessionId)
        if (task.target && task.target.sessionId) ids.add(task.target.sessionId)
        if (Array.isArray(task.involvedSessionIds)) {
          task.involvedSessionIds.forEach(function (id) { if (id) ids.add(id) })
        }
      }
      return Array.from(ids).sort().join('|')
    }

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

    function clampStyle(base, clamp) {
      const style = Object.assign({}, base)
      delete style.clamp
      style.display = '-webkit-box'
      style.WebkitLineClamp = clamp
      style.WebkitBoxOrient = 'vertical'
      style.overflow = 'hidden'
      return style
    }

    function Board(props) {
      const t = typeof props.t === 'function' ? props.t : function (key) { return key }
      const sessionId = props.sessionId
      const useWs = typeof props.useWorkspaces === 'function' ? props.useWorkspaces : null
      const useSs = typeof props.useSessions === 'function' ? props.useSessions : null
      const wsSnapshot = useWs ? useWs(function (state) { return state }) : EMPTY_WS
      const ssSnapshot = useSs ? useSs(function (state) { return state }) : EMPTY_SS
      const readRef = React.useRef(props.readCard)
      readRef.current = props.readCard
      const openSession = typeof props.openSession === 'function' ? props.openSession : null

      const archived = wsSnapshot && Array.isArray(wsSnapshot.archivedSessionIds) ? wsSnapshot.archivedSessionIds : []
      const archivedKey = archived.join(',')
      const wsItems = wsSnapshot && Array.isArray(wsSnapshot.items) ? wsSnapshot.items : []
      const wsKey = wsItems.map(function (ws) { return ws && Array.isArray(ws.sessionIds) ? ws.sessionIds.join('.') : '' }).join('|')
      const phase = wsSnapshot && wsSnapshot.phase
      const ready = !phase || phase === 'ready'

      const snapshot = ssSnapshot || EMPTY_SS
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
            running: session.running === true,
          })
        }
      }
      function rowsFromCache() {
        return candidates.map(function (candidate) {
          const hit = CARD_CACHE.get(cardPath(candidate.cwd, candidate.id))
          return hit && !hit.missing ? buildRow(candidate, hit.text, false) : buildRow(candidate, '', true)
        }).sort(compareRows)
      }
      const cachedCount = candidates.filter(function (candidate) {
        return CARD_CACHE.has(cardPath(candidate.cwd, candidate.id))
      }).length

      const [tick, setTick] = React.useState(0)
      const forceRef = React.useRef(0)
      const lastForceRef = React.useRef(0)
      const [hoverId, setHoverId] = React.useState(null)
      const [state, setState] = React.useState(function () {
        // First paint must never be blank: reuse whatever is cached.
        return {
          status: cachedCount > 0 ? 'ready' : 'loading',
          rows: cachedCount > 0 ? rowsFromCache() : [],
          error: null,
          at: LAST_AT,
        }
      })
      const V = LAYOUT

      const atRef = React.useRef(LAST_AT)

      // Sessions a scheduled task owns: they get their own quiet cyan group,
      // whether the task targets them directly or only notifies them.
      const [scheduledKey, setScheduledKey] = React.useState(null)
      React.useEffect(function () {
        let alive = true
        if (!props.loadScheduled) {
          setScheduledKey('')
          return undefined
        }
        Promise.resolve(props.loadScheduled()).then(function (result) {
          if (alive) setScheduledKey(scheduledIdKey(result))
        }).catch(function () {
          /* no access to the schedule: keep the plain groups */
          if (alive) setScheduledKey('')
        })
        return function () { alive = false }
      }, [tick, sessionId])
      const scheduledLoaded = scheduledKey !== null
      const scheduledSet = React.useMemo(function () {
        return new Set(scheduledKey ? scheduledKey.split('|') : [])
      }, [scheduledKey])

      // A section opens only while the Session being viewed belongs to it: the
      // scheduled group for a task target, the done group for a done card that
      // is not scheduled (those live in the scheduled group instead). Both wait
      // for the schedule lookup, so a done target never flashes the done group.
      const currentScheduled = scheduledLoaded && scheduledSet.has(sessionId)
      const [schedOverride, setSchedOverride] = React.useState(null)
      const showScheduled = schedOverride === null ? currentScheduled : schedOverride
      const toggleScheduled = function () { setSchedOverride(!showScheduled) }

      const currentRow = (state.rows || []).find(function (row) { return row.id === sessionId })
      const currentDone = scheduledLoaded
        && !!(currentRow && currentRow.status === 'done')
        && !currentScheduled
      const [doneOverride, setDoneOverride] = React.useState(null)
      const showDone = doneOverride === null ? currentDone : doneOverride
      const toggleDone = function () { setDoneOverride(!showDone) }

      const lastSidRef = React.useRef(sessionId)
      if (lastSidRef.current !== sessionId) {
        lastSidRef.current = sessionId
        setDoneOverride(null)
        setSchedOverride(null)
      }

      React.useEffect(function () {
        if (!ready) return undefined
        const ctrl = new AbortController()
        let cancelled = false
        const cachedAll = candidates.length > 0 && cachedCount === candidates.length
        if (cachedAll) {
          // Instant path: everything is cached, so a session switch paints at once.
          setState({ status: 'ready', rows: rowsFromCache(), error: null, at: atRef.current })
        } else {
          setState(function (prev) {
            return {
              status: prev.rows.length > 0 ? 'refreshing' : 'loading',
              rows: prev.rows.length > 0 ? prev.rows : rowsFromCache(),
              error: null,
              at: prev.at,
            }
          })
        }
        const force = forceRef.current !== lastForceRef.current
        lastForceRef.current = forceRef.current
        const stale = candidates.filter(function (candidate) {
          const hit = CARD_CACHE.get(cardPath(candidate.cwd, candidate.id))
          return !hit || force || Date.now() - hit.at > CARD_TTL
        })
        if (stale.length === 0) return function () { ctrl.abort() }
        ;(async function () {
          await Promise.all(stale.map(async function (candidate) {
            const path = cardPath(candidate.cwd, candidate.id)
            try {
              const result = await readRef.current(path, ctrl.signal)
              if (result && result.ok) {
                CARD_CACHE.set(path, {
                  text: result.value && typeof result.value.text === 'string' ? result.value.text : '',
                  at: Date.now(),
                })
              } else {
                CARD_CACHE.set(path, { text: '', at: Date.now(), missing: true })
              }
            } catch (error) {
              /* keep the previous cache entry, if any */
            }
          }))
          if (cancelled) return
          atRef.current = Date.now()
          LAST_AT = atRef.current
          setState({ status: 'ready', rows: rowsFromCache(), error: null, at: atRef.current })
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
      // Sessions without a card are not shown at all.
      const visibleRows = (state.rows || []).filter(function (row) { return row.status !== 'missing' })
      // A schedule target keeps its own group whatever its card says: the task,
      // not the last turn, is what makes it interesting.
      const scheduledRows = visibleRows.filter(function (row) {
        return scheduledSet.has(row.id) && row.status !== 'blocked'
      })
      const doneRows = visibleRows.filter(function (row) {
        return row.status === 'done' && !scheduledSet.has(row.id)
      })
      const doingRows = visibleRows.filter(function (row) {
        return row.status === 'doing' && !scheduledSet.has(row.id)
      })
      const groupDefs = [
        { key: 'blocked', label: t('group.blocked'), rows: visibleRows.filter(function (row) { return row.status === 'blocked' }) },
        { key: 'doing', label: t('group.doing'), rows: doingRows },
        { key: 'scheduled', label: t('group.scheduled'), rows: showScheduled ? scheduledRows : [] },
        { key: 'done', label: t('group.done'), rows: showDone ? doneRows : [] },
      ]

      let body
      if (state.status === 'loading') {
        body = h('div', { style: S.hint }, t('ui.loading'))
      } else if (state.status === 'error') {
        body = h('div', { style: Object.assign({}, S.hint, S.err) }, t('ui.error') + '：' + state.error)
      } else if (visibleRows.length === 0) {
        body = h('div', { style: S.hint }, t('ui.empty'))
      } else {
        const children = []
        for (const group of groupDefs) {
          // Collapsible sections keep their toggle directly above the rows, so
          // expanding one never hides the control below the fold.
          const collapsible = group.key === 'scheduled' || group.key === 'done'
          if (collapsible) {
            const isDone = group.key === 'done'
            const count = isDone ? doneRows.length : scheduledRows.length
            const shown = isDone ? showDone : showScheduled
            if (count > 0) {
              children.push(h('button', {
                key: group.key + '-toggle',
                type: 'button',
                style: Object.assign({}, S.more, { marginTop: 14 }),
                onClick: isDone ? toggleDone : toggleScheduled,
              }, (shown
                ? t(isDone ? 'ui.hideDone' : 'ui.hideScheduled')
                : t(isDone ? 'ui.showDone' : 'ui.showScheduled')) + ' · ' + count))
            }
          }
          if (group.rows.length === 0) continue
          const accent = ACCENT[group.key] || ACCENT.missing
          const groupChildren = []
          if (children.length > 0) groupChildren.push(h('div', { key: 'gap-' + group.key, style: { height: 20 } }))
          group.rows.forEach(function (row, index) {
            const line = accent
            const stale = row.status === 'doing' && row.updated > 0 && now - row.updated > STALE_DAYS * 86400000
            const staleDays = stale ? Math.floor((now - row.updated) / 86400000) : 0
            const wsLabel = row.workspaceTitle || shortPath(row.cwd)
            let metaText = wsLabel
            if (row.updated) metaText += ' · ' + relativeTime(row.updated, t, now)
            if (stale) metaText += ' · ' + staleDays + ' ' + t('ui.stale')
            const desc = row.goal && row.goal !== row.title
              ? h('div', { style: clampStyle(V.desc, V.desc.clamp) }, row.goal)
              : null
            const detail = row.status === 'blocked'
              ? h('div', { style: { fontSize: 10.5, marginTop: 8, lineHeight: 1.6, color: 'var(--dsw-alias-state-error-primary)' } }, row.blockedOn || row.next || '')
              : (row.next ? h('div', {
                style: Object.assign(
                  { fontSize: 10.5, marginTop: 8, lineHeight: 1.6, color: 'var(--dsw-alias-label-tertiary)' },
                  { borderLeft: '2px solid ' + rgba(accent, 0.32), paddingLeft: 8 },
                  clampStyle(V.next, V.next.clamp),
                ),
              }, '→ ' + row.next) : null)
            const isLast = index === group.rows.length - 1
            const tinted = row.status === 'done' || row.status === 'doing'
            const current = row.id === sessionId
            const tintAlpha = current ? 0.12 : (hoverId === row.id ? 0.10 : 0.06)
            const rowTint = tinted
              ? {
                backgroundImage: 'linear-gradient(90deg, ' + rgba(accent, tintAlpha) + ' 0%, '
                  + rgba(accent, tintAlpha * 0.45) + ' 55%, ' + rgba(accent, 0) + ' 100%)',
                borderRadius: 8,
              }
              : null
            const hovered = hoverId === row.id
            const rowStyle = Object.assign(
              {},
              V.row,
              isLast ? V.rowLast : null,
              V.rail ? { borderLeft: '1px solid ' + (hovered ? accent : 'var(--dsw-alias-border-l2)') } : null,
              rowTint,
              V.railBar ? { borderLeft: '2px solid ' + accent } : null,
              V.tint ? { background: rgba(accent, V.tint) } : null,
              V.bar ? { boxShadow: 'inset 3px 0 0 ' + accent } : null,
              current ? { boxShadow: 'inset 0 0 0 1px ' + rgba(accent, 0.34) } : null,
              hovered && !tinted ? { background: 'var(--dsw-alias-interactive-bg-hover)' } : null,
            )
            const inlineDot = V.dotInline
              ? h('span', { key: 'dot', style: { flex: '0 0 auto', width: 6, height: 6, borderRadius: '50%', background: accent } })
              : null
            // A session whose agent is mid-turn gets a live spinner instead of the static dot.
            const spin = row.running
              ? h('span', {
                  key: 'spin',
                  title: t('ui.thinking'),
                  style: {
                    flex: '0 0 auto',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '1.5px solid ' + rgba(accent, 0.22),
                    borderTopColor: accent,
                    animation: 'crb-spin .8s linear infinite',
                    boxSizing: 'border-box',
                    marginLeft: -2,
                    marginRight: -2,
                  },
                })
              : null
            let dot = null
            if (V.dotMode === 'solid') {
              const dotStyle = Object.assign({}, V.dotBase)
              // A hollow ring sits quieter against the tint than a solid dot.
              dotStyle.background = 'var(--dsw-alias-bg-base)'
              dotStyle.border = '1.5px solid ' + rgba(line, 0.62)
              dot = h('span', { key: 'dot', style: dotStyle })
            }
            const canOpen = !!openSession
            const doOpen = function () { if (canOpen) openSession(row.id) }
            const chipOutline = false
            const titleRow = h('div', { key: 't', style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
              inlineDot,
              spin,
              current ? h('span', { key: 'cur', style: {
                flex: '0 0 auto',
                fontSize: 9.5,
                lineHeight: '16px',
                padding: '0 5px',
                borderRadius: 3,
                color: 'var(--dsw-alias-bg-base)',
                background: accent,
                letterSpacing: 0.3,
              } }, t('ui.current')) : null,
              h('span', {
                key: 'title',
                style: Object.assign({}, V.title, {
                  flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }),
              }, row.title || row.id),
            )
            const curBadge = null
            // «进行中» and «已完成» need no label: the ring, the dot and the tint
            // already say it. Blocked keeps its label — it is the one thing that
            // needs words.
            const showChip = V.chip && (group.key === 'blocked' || group.key === 'scheduled')
            const statusChip = showChip ? h('span', { style: {
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9.5,
              lineHeight: '15px',
              color: 'var(--dsw-alias-label-tertiary)',
              letterSpacing: 0.2,
            } },
              h('span', { key: 'c', style: { width: 4, height: 4, borderRadius: '50%', background: line, opacity: 0.7 } }),
              group.label,
            ) : null
            const metaRow = h('div', { key: 'm', style: Object.assign({}, V.meta, {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }) },
              h('span', { style: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, metaText),
              statusChip,
            )
            const inner = [
              titleRow,
              desc ? h('div', { key: 'd' }, desc) : null,
              detail ? h('div', { key: 'x' }, detail) : null,
              metaRow,
            ]
            if (curBadge) inner.push(curBadge)
            if (dot) inner.push(dot)
            groupChildren.push(h('div', {
              key: 'r-' + row.id,
              style: Object.assign({}, rowStyle, { cursor: 'default' }),
              title: canOpen ? t('ui.openHint') : undefined,
              onMouseEnter: function () { setHoverId(row.id) },
              onMouseLeave: function () { setHoverId(null) },
              onDoubleClick: function () { if (canOpen) doOpen() },
            }, inner))
          })
          groupChildren.forEach(function (node) { children.push(node) })
        }
        body = children
      }

      const heroParts = [visibleRows.length + ' ' + t('ui.count')]
      const doingCount = doingRows.length
      const scheduledCount = scheduledRows.length
      const doneCount = doneRows.length
      const blockedCount = visibleRows.filter(function (row) { return row.status === 'blocked' }).length
      if (blockedCount) heroParts.push(blockedCount + ' ' + t('group.blocked'))
      if (doingCount) heroParts.push(doingCount + ' ' + t('group.doing'))
      if (scheduledCount) heroParts.push(scheduledCount + ' ' + t('group.scheduled'))
      if (doneCount) heroParts.push(doneCount + ' ' + t('group.done'))
      let heroMeta = heroParts.join(' · ')
      if (state.at) {
        const stamp = new Date(state.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        heroMeta += ' · ' + t('ui.updated') + ' ' + stamp
      }

      return h('div', { style: S.root },
        h('style', { key: 'spin-kf' }, '@keyframes crb-spin { to { transform: rotate(360deg); } }'),
        h('div', { style: S.hero },
          h('div', { style: S.heroName }, t('ui.boardTitle')),
          h('div', { style: S.heroMeta }, heroMeta),
          h('button', {
            type: 'button',
            style: S.refresh,
            onClick: function () {
              forceRef.current += 1
              setTick(function (value) { return value + 1 })
            },
          }, t('ui.refresh')),
        ),
        h('div', { style: Object.assign({ flex: '1 1 auto', overflowY: 'auto' }, V.body) }, body),
      )
    }

    return {
      inject: [
        'slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'remote', 'remote.workspaceFiles', 'uiWorkspace',
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
              icon: BoardGlyph,
            }],
          })
        }, 'context-recap-board: tab type')
        if (ctx.sidebarRight && ctx.sidebarRight.mounted) {
          const sidebar = ctx.sidebarRight
          let cancelled = false
          let lastSid
          const timers = new Set()
          const later = function (fn, ms) {
            const id = setTimeout(function () { timers.delete(id); fn() }, ms)
            timers.add(id)
          }
          const boardTab = function (sid) {
            try {
              const tabs = sidebar.openTabs && sidebar.openTabs.getSnapshot ? sidebar.openTabs.getSnapshot() : []
              for (let i = 0; i < tabs.length; i += 1) {
                if (tabs[i].sessionId === sid && tabs[i].kind === KIND) return tabs[i]
              }
            } catch (err) {
              /* 库存还没就绪，当作未打开 */
            }
            return undefined
          }
          const ensure = function (sid, attempt) {
            if (cancelled || !sid) return
            try {
              if (sidebar.mounted.getSnapshot() !== sid) return
            } catch (err) {
              return
            }
            const tab = boardTab(sid)
            try {
              if (tab) {
                const active = sidebar.active()
                if (!active || active.tabId !== tab.tabId) sidebar.focus(tab.tabId)
                return
              }
              sidebar.openTab(KIND)
            } catch (err) {
              if (attempt < 5) later(function () { ensure(sid, attempt + 1) }, 120 + attempt * 140)
            }
          }
          const sync = function () {
            let sid
            try { sid = sidebar.mounted.getSnapshot() } catch (err) { return }
            if (!sid || sid === lastSid) return
            lastSid = sid
            ensure(sid, 0)
          }
          let stop
          if (typeof sidebar.mounted.subscribe === 'function') stop = sidebar.mounted.subscribe(sync)
          else {
            const id = setInterval(sync, 600)
            stop = function () { clearInterval(id) }
          }
          ctx.effect(function () {
            return function () {
              cancelled = true
              if (typeof stop === 'function') stop()
              timers.forEach(function (id) { clearTimeout(id) })
              timers.clear()
            }
          }, 'context-recap-board: auto open')
          sync()
        }
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
                  loadScheduled: function () {
                    try {
                      // Optional dependency: read it lazily so a profile without
                      // the Schedule UI still gets the plain board.
                      const remote = (typeof ctx.get === 'function' ? ctx.get('remote.schedule') : null)
                        || (ctx.remote && ctx.remote.schedule)
                      if (!remote || typeof remote.list !== 'function') return null
                      return remote.list({ limit: 500 })
                    } catch (error) {
                      return null
                    }
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
