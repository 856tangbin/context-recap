#!/usr/bin/env node
/**
 * 会话看板：把所有「未归档」会话的卡片汇总成一张 markdown。
 *
 * 数据来源（全部是文件读取，不调模型、不依赖任何插件）：
 *   1. <DSH_HOME>/storages/workspace.json
 *        - global.archivedSessionIds  哪些会话已归档
 *        - global.pinnedSessionIds    用户置顶的会话
 *        - tables.workspaces[].path / .sessionIds   会话 → 工作区目录
 *   2. <workspace.path>/.context-recap/<sessionId>.md   每会话的卡片（frontmatter + 四段）
 *   3. <DSH_HOME>/sessions/*\/session-*\/  会话日志 mtime，用于「没写卡片」时的活跃度兜底
 *
 * 用法：
 *   node board.mjs [选项]
 *     --home <dir>        DSH 主目录（默认 $DSH_HOME，其次 ~/.dsh）
 *     --out <file>        BOARD.md 输出路径（默认 <cwd>/.context-recap/BOARD.md）
 *     --no-write          只打印，不落盘
 *     --json              输出机器可读 JSON（不写文件）
 *     --days <n>          「N 天未动」冷却阈值（默认 3）
 *     --missing-days <n>  缺卡会话只展示近 N 天有活动的（默认 14）
 *     --all               缺卡会话不过滤时间
 *     --quiet             不打印 markdown 到 stdout
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const DAY = 24 * 60 * 60 * 1000;
const SKIP_PREFIX = ['im:'];

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const opts = {
    home: null,
    out: null,
    write: true,
    json: false,
    days: 3,
    missingDays: 14,
    all: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--home': opts.home = next(); break;
      case '--out': opts.out = next(); break;
      case '--days': opts.days = Number(next()); break;
      case '--missing-days': opts.missingDays = Number(next()); break;
      case '--no-write': opts.write = false; break;
      case '--json': opts.json = true; opts.write = false; break;
      case '--all': opts.all = true; break;
      case '--quiet': opts.quiet = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`未知参数：${arg}`);
    }
  }
  return opts;
}

function resolveHome(opt) {
  if (opt) return resolve(opt);
  if (process.env.DSH_HOME) return resolve(process.env.DSH_HOME);
  return join(homedir(), '.dsh');
}

// ---------------------------------------------------------------- 小工具

function readJsonFile(file) {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function mtimeOf(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function unquote(value) {
  const v = String(value).trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
    (v.startsWith("'") && v.endsWith("'") && v.length > 1)
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function stripBullet(line) {
  return line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/^\s*>\s*/, '').trim();
}

function sectionText(body, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s|$)`);
  const m = re.exec(body);
  return m ? m[1] : '';
}

/**
 * 取某个字段的内容，两种写法都认：
 *   新版：`## 目标`
 *   旧版：`- **目标**：一句话`
 */
function fieldLines(body, heading, label) {
  const block = sectionText(body, heading);
  if (block.trim()) {
    return block
      .split(/\r?\n/)
      .map(stripBullet)
      .filter(Boolean);
  }

  const lines = body.split(/\r?\n/);
  const bullet = new RegExp(`^\\s*[-*]\\s*\\*\\*${label}\\*\\*[：:]\\s*(.*)$`);
  for (let i = 0; i < lines.length; i++) {
    const m = bullet.exec(lines[i]);
    if (!m) continue;
    const out = [m[1].trim()].filter(Boolean);
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (/^\s*[-*]\s/.test(line) || /^\s*##\s/.test(line) || /^\s*$/.test(line)) break;
      if (!/^\s{2,}\S/.test(line)) break;
      out.push(stripBullet(line));
    }
    return out;
  }
  return [];
}

function shortId(id) {
  const tail = id.replace(/^session-/, '');
  return tail.slice(0, 8);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtDateTime(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function daysSince(ms, now) {
  if (!ms) return null;
  return Math.floor((now - ms) / DAY);
}

// ---------------------------------------------------------------- 卡片解析

/**
 * 解析 frontmatter（只支持本技能用到的 YAML 子集：标量、[a, b]、块状 - 列表）。
 * 兼容没有 frontmatter 的旧卡片：状态/更新时间从正文里回捞。
 */
function parseCard(text) {
  const fm = {};
  let body = text.replace(/^\uFEFF/, '');

  const head = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(body);
  if (head) {
    body = body.slice(head[0].length);
    const lines = head[1].split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[i]);
      if (!kv) {
        i++;
        continue;
      }
      const key = kv[1];
      const raw = kv[2].trim();
      if (raw === '') {
        // 块状列表：后续 "  - xxx"
        const list = [];
        let j = i + 1;
        while (j < lines.length) {
          const item = /^\s*-\s+(.*)$/.exec(lines[j]);
          if (!item) break;
          list.push(unquote(item[1].trim()));
          j++;
        }
        if (list.length) {
          fm[key] = list;
          i = j;
          continue;
        }
        fm[key] = null;
        i++;
        continue;
      }
      if (/^\[.*\]$/.test(raw)) {
        fm[key] = raw
          .slice(1, -1)
          .split(/[,，]/)
          .map((s) => unquote(s.trim()))
          .filter(Boolean);
        i++;
        continue;
      }
      fm[key] = unquote(raw);
      i++;
    }
  }

  const legacyStatus = /状态[：:]\s*(进行中|已完成|受阻|阻塞|卡住|完成)/.exec(body);
  const legacyUpdated = /最后更新[：:]\s*(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)/.exec(body);

  return { fm, body, legacyStatus: legacyStatus ? legacyStatus[1] : null, legacyUpdated: legacyUpdated ? legacyUpdated[1] : null };
}

function normalizeStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'null' || s === 'unknown' || s === 'none') return 'unknown';
  if (/block|obstruct|stuck|wait|阻塞|受阻|卡住|暂停/.test(s)) return 'blocked';
  if (/done|complete|finish|已完成|完成|结束|归档/.test(s)) return 'done';
  if (/doing|progress|wip|active|进行|推进|在做/.test(s)) return 'doing';
  return 'unknown';
}

function extractNext(fm, body) {
  if (Array.isArray(fm.next) && fm.next.length) return fm.next.slice(0, 3);
  if (typeof fm.next === 'string' && fm.next.trim()) return [fm.next.trim()];
  return fieldLines(body, '下一步', '下一步').slice(0, 3);
}

function extractGoal(body) {
  return fieldLines(body, '目标', '目标')[0] || '';
}

function parseTime(raw) {
  if (!raw) return 0;
  const value = String(raw).trim();
  // 旧卡片写的是本地时间且不带时区：YYYY-MM-DD HH:mm
  const local = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(value);
  if (local) {
    const d = new Date(`${local[1]}T${local[2]}`);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 1e12) return numeric;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

// ---------------------------------------------------------------- 数据收集

function collectRecency(home) {
  const map = new Map();
  const root = join(home, 'sessions');
  for (const outer of safeReaddir(root)) {
    if (!outer.isDirectory()) continue;
    const outerPath = join(root, outer.name);
    for (const inner of safeReaddir(outerPath)) {
      if (!inner.isDirectory() || !inner.name.startsWith('session-')) continue;
      const dirPath = join(outerPath, inner.name);
      const log = join(dirPath, 'session.v4.jsonl.zstd');
      const ms = mtimeOf(log) || mtimeOf(dirPath);
      if (ms) map.set(inner.name, ms);
    }
  }
  return map;
}

function readWorkspaceState(home) {
  const file = join(home, 'storages', 'workspace.json');
  if (!existsSync(file)) {
    throw new Error(
      `找不到 ${file}\n这通常意味着 DSH 还没有创建过工作区，或 DSH_HOME 指向了别处（可用 --home 指定）。`,
    );
  }
  const state = readJsonFile(file);
  const global = state.global ?? {};
  const tables = state.tables?.workspaces ?? global.workspaces ?? {};
  const workspaces = Object.entries(tables).map(([id, ws]) => ({
    id,
    path: ws.path,
    title: ws.title || ws.path || id,
    sessionIds: Array.isArray(ws.sessionIds) ? ws.sessionIds : [],
    updatedAt: parseTime(ws.updatedAt),
  }));
  return {
    file,
    archived: new Set(global.archivedSessionIds ?? []),
    pinned: new Set(global.pinnedSessionIds ?? []),
    workspaces,
    raw: state,
  };
}

function buildRows(home, opts, now) {
  const state = readWorkspaceState(home);
  const recency = collectRecency(home);
  const seen = new Set();
  const rows = [];
  const folded = [];

  for (const ws of state.workspaces) {
    const dirOk = Boolean(ws.path) && existsSync(ws.path);
    for (const sid of ws.sessionIds) {
      if (seen.has(sid)) continue;
      if (state.archived.has(sid)) continue;
      if (SKIP_PREFIX.some((p) => sid.startsWith(p))) continue;
      seen.add(sid);

      const cardFile = dirOk ? join(ws.path, '.context-recap', `${sid}.md`) : null;
      let card = null;
      if (cardFile && existsSync(cardFile)) {
        try {
          card = parseCard(readFileSync(cardFile, 'utf8'));
        } catch (error) {
          card = { fm: {}, body: '', error: String(error) };
        }
      }

      const cardMtime = cardFile ? mtimeOf(cardFile) : 0;
      const activity = recency.get(sid) || cardMtime || ws.updatedAt || 0;

      if (!card) {
        const age = daysSince(activity, now);
        const row = {
          kind: 'missing',
          id: sid,
          workspace: ws.title,
          workspacePath: ws.path,
          dirOk,
          title: `${ws.title} · ${shortId(sid)}`,
          status: 'missing',
          updated: activity,
          age,
          next: [],
          goal: '',
          pinned: state.pinned.has(sid),
          cardFile: '',
        };
        if (!opts.all && age !== null && age > opts.missingDays) {
          folded.push(row);
          continue;
        }
        rows.push(row);
        continue;
      }

      const status = normalizeStatus(card.fm.status ?? card.legacyStatus);
      const updated =
        parseTime(card.fm.updated) || parseTime(card.legacyUpdated) || cardMtime || activity;
      const goal = extractGoal(card.body);
      const title =
        unquote(card.fm.title || '') ||
        (goal ? `${goal.slice(0, 32)}${goal.length > 32 ? '…' : ''}` : `${ws.title} · ${shortId(sid)}`);
      rows.push({
        kind: 'card',
        id: sid,
        workspace: ws.title,
        workspacePath: ws.path,
        dirOk: true,
        title,
        status: status === 'unknown' ? 'doing' : status,
        rawStatus: status,
        updated,
        age: daysSince(updated, now),
        next: extractNext(card.fm, card.body),
        goal,
        blockedOn: card.fm.blocked_on && card.fm.blocked_on !== 'null' ? String(card.fm.blocked_on) : '',
        pinned: state.pinned.has(sid),
        cardFile,
      });
    }
  }

  const byPinned = (a, b) =>
    Number(b.pinned) - Number(a.pinned) || (b.updated || 0) - (a.updated || 0);

  const groups = {
    blocked: rows.filter((r) => r.status === 'blocked').sort(byPinned),
    doing: rows.filter((r) => r.status === 'doing').sort(byPinned),
    done: rows.filter((r) => r.status === 'done').sort(byPinned),
    missing: rows
      .filter((r) => r.status === 'missing')
      .sort((a, b) => (b.updated || 0) - (a.updated || 0)),
  };

  return { state, rows, groups, folded, recency };
}

// ---------------------------------------------------------------- 渲染

function renderRow(row, opts, now) {
  const flags = [];
  if (row.pinned) flags.push('★');
  if (!row.dirOk) flags.push('⚠ 目录不可用');
  if (row.status !== 'missing') {
    if (row.status === 'blocked' && row.blockedOn) flags.push(`等：${row.blockedOn}`);
    if (row.status === 'doing' && row.age !== null && row.age >= opts.days) {
      flags.push(`⚠ 已 ${row.age} 天未动`);
    }
    if (row.status === 'done') flags.push('可归档');
  }
  const tail = flags.length ? ` · ${flags.join(' · ')}` : '';
  const when = row.updated ? `更新 ${fmtDate(row.updated)}` : '无时间信息';
  const lines = [`- **${row.title}** · ${row.workspace} · ${when}${tail}`];
  if (row.next.length) {
    for (const item of row.next.slice(0, 2)) {
      lines.push(`  - 下一步：${item}`);
    }
  } else if (row.kind === 'missing') {
    const hint = row.dirOk ? '还没写卡片，去那个会话补一份' : '工作区目录已不可用';
    lines.push(`  - ${hint}`);
  }
  return lines.join('\n');
}

function renderMarkdown(result, opts, now) {
  const { state, groups, rows, folded } = result;
  const openTotal = rows.length + folded.length;
  const lines = [];

  lines.push('# 会话看板');
  lines.push('');
  lines.push(
    `> 生成于 ${fmtDateTime(now)} · ${openTotal} 个未归档会话 / ${state.workspaces.length} 个工作区` +
      ` · 已归档 ${state.archived.size} 个`,
  );
  lines.push('');

  const section = (title, list, empty) => {
    lines.push(`## ${title}（${list.length}）`);
    lines.push('');
    if (!list.length) {
      lines.push(`_${empty}_`);
    } else {
      for (const row of list) lines.push(renderRow(row, opts, now));
    }
    lines.push('');
  };

  section('⛔ 阻塞', groups.blocked, '没有卡住的会话。');
  section('▶ 进行中', groups.doing, '没有进行中的会话。');
  section('⏸ 已完成未归档', groups.done, '没有待归档的已完成会话。');
  section('❓ 缺卡片', groups.missing, '全部会话都有卡片。');

  if (folded.length) {
    const oldest = folded.reduce((min, row) => Math.min(min || row.updated, row.updated), 0);
    lines.push(
      `_另有 ${folded.length} 个更早的会话未展开（最后一次活动在 ${fmtDate(oldest)} 前后，` +
        '加 --all 查看）。_',
    );
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '卡片真源：各工作区 `.context-recap/<会话标识>.md`；本文件由 `scripts/board.mjs` 生成，**不要手改**。',
  );
  lines.push(
    `缺卡会话的活跃度取自会话日志 mtime${opts.all ? '' : `，超过 ${opts.missingDays} 天的折叠为一行统计`}。`,
  );
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------- 主流程

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('用法：node board.mjs [--home <dir>] [--out <file>] [--no-write] [--json] [--days 3] [--missing-days 14] [--all] [--quiet]');
    return;
  }

  const home = resolveHome(opts.home);
  const now = Date.now();
  const result = buildRows(home, opts, now);

  if (opts.json) {
    const payload = {
      generatedAt: new Date(now).toISOString(),
      home,
      counts: {
        workspaces: result.state.workspaces.length,
        archived: result.state.archived.size,
        open: result.rows.length + result.folded.length,
        blocked: result.groups.blocked.length,
        doing: result.groups.doing.length,
        done: result.groups.done.length,
        missing: result.groups.missing.length,
      },
      sessions: result.rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        workspace: r.workspace,
        workspacePath: r.workspacePath,
        status: r.status,
        updated: r.updated ? new Date(r.updated).toISOString() : null,
        next: r.next,
        blockedOn: r.blockedOn || null,
        pinned: r.pinned,
        cardFile: r.cardFile || null,
      })),
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const markdown = renderMarkdown(result, opts, now);
  if (!opts.quiet) process.stdout.write(markdown);

  if (opts.write) {
    const out = opts.out
      ? resolve(opts.out)
      : join(process.cwd(), '.context-recap', 'BOARD.md');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, markdown, 'utf8');
    if (!opts.quiet) process.stderr.write(`\n已写入 ${out}\n`);
  }
}

try {
  main();
} catch (error) {
  console.error(`board.mjs 失败：${error?.message ?? error}`);
  process.exit(1);
}
