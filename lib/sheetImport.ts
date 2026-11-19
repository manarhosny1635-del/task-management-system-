// Pure parser for the "متابعة تاسكات" spreadsheet → import preview.
// Runs in the browser (and in node tests). No database access here.

export type Kind = 'current' | 'queued' | 'finished';
export interface PreviewItem { id: string; title: string; include: boolean; duplicateOf?: string }
export interface PreviewCell {
  id: string; row: number; employee: string; kind: Kind; raw: string; split: boolean; items: PreviewItem[];
  status: 'in_progress' | 'completed' | 'new'; assignment_date: string | null; deadline: string | null; notes: string | null;
}
export interface PreviewEmployee { name: string; row: number; issues: string[] }
export interface Preview { employees: PreviewEmployee[]; cells: PreviewCell[]; mapping: { column: string; field: string; index: number }[]; year: number }

// header text (normalised) → field
const HEADERS: Record<string, string> = {
  '': 'employee', 'project name': 'current', 'assignment date': 'assignment_date', deadline: 'deadline', notes: 'notes',
  status: 'status', 'sprints / deliverables': 'deliverables', responsible: 'queued', finish: 'finished', 'التسليم الفعلي': 'actual_delivery',
};
export const FIELD_LABELS: Record<string, string> = {
  employee: 'الموظف (profiles.full_name)', current: 'المهمة الحالية → tasks (حالة من عمود Status)', assignment_date: 'tasks.assigned_at',
  deadline: 'tasks.original_deadline + current_deadline', notes: 'تعليق ملاحظة على المهمة', status: 'tasks.status',
  deliverables: 'يُضاف للملاحظات', queued: 'مهام تالية → tasks (جديدة، مقترحة لنفس الموظف)', finished: 'مهام منجزة → tasks (مكتملة)',
  actual_delivery: 'تاريخ التسليم الفعلي (للمكتملة)',
};

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

/** Split a cell on " - ", "/", "+", "،" — but never inside parentheses. */
export function splitCell(raw: string): string[] {
  const out: string[] = []; let depth = 0; let cur = '';
  const s = raw.replace(/\s+/g, ' ');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    const dash = ch === '-' && (s[i - 1] === ' ' || s[i + 1] === ' ') && !/\d/.test(s[i - 1] ?? '');
    if (depth === 0 && (dash || ch === '/' || ch === '+' || ch === '،')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** "27 \ 10", "15/11", "2\11", Excel serials, Date → ISO date (no year in sheet → `year`). */
export function parseDate(v: unknown, year: number): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const m = String(v).trim().match(/^(\d{1,2})\s*[\\/.\-]\s*(\d{1,2})(?:\s*[\\/.\-]\s*(\d{2,4}))?$/);
  if (!m) return null;
  const day = +m[1], month = +m[2];
  let y = m[3] ? +m[3] : year;
  if (y < 100) y += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const STATUS_MAP: Record<string, 'in_progress' | 'completed'> = {
  'قيد التنفيذ': 'in_progress', 'مكتملة': 'completed', 'مكتمله': 'completed', 'منتهية': 'completed', 'completed': 'completed', 'in progress': 'in_progress',
};

export function buildPreview(rows: unknown[][], year = new Date().getFullYear()): Preview {
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim());
  const idx: Record<string, number> = {};
  const mapping: Preview['mapping'] = [];
  header.forEach((h, i) => {
    const f = HEADERS[h.toLowerCase()] ?? (i === 0 ? 'employee' : undefined);
    if (f && idx[f] === undefined) { idx[f] = i; mapping.push({ column: h || '(A — بدون عنوان)', field: f, index: i }); }
  });
  if (idx.employee === undefined) idx.employee = 0;
  const get = (r: unknown[], f: string) => (idx[f] === undefined ? '' : r[idx[f]] ?? '');
  const str = (r: unknown[], f: string) => String(get(r, f) ?? '').trim();

  const employees: PreviewEmployee[] = [];
  const cells: PreviewCell[] = [];
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const name = str(r, 'employee').replace(/\s+/g, ' ');
    if (!name) return;
    const issues: string[] = [];
    const statusRaw = str(r, 'status');
    const status = STATUS_MAP[statusRaw] ?? STATUS_MAP[statusRaw.toLowerCase()] ?? 'in_progress';
    if (statusRaw && !STATUS_MAP[statusRaw] && !STATUS_MAP[statusRaw.toLowerCase()]) issues.push(`حالة غير معروفة «${statusRaw}» — اعتُبرت قيد التنفيذ`);
    const assignment_date = parseDate(get(r, 'assignment_date'), year);
    const deadline = parseDate(get(r, 'deadline'), year);
    if (str(r, 'assignment_date') && !assignment_date) issues.push(`تاريخ إسناد غير مفهوم «${str(r, 'assignment_date')}»`);
    if (str(r, 'deadline') && !deadline) issues.push(`موعد غير مفهوم «${str(r, 'deadline')}»`);
    const notes = [str(r, 'notes'), str(r, 'deliverables')].filter(Boolean).join(' — ') || null;

    const hasCurrent = !!str(r, 'current');
    const mk = (kind: Kind, raw: string, st: PreviewCell['status']): PreviewCell | null => {
      if (!raw) return null;
      // dates/notes belong to the current task; if the row has none, they belong to the finished work
      const owner = kind === 'current' || (kind === 'finished' && !hasCurrent);
      const parts = splitCell(raw);
      return {
        id: `${row}-${kind}`, row, employee: name, kind, raw, split: parts.length > 1, status: st,
        assignment_date: owner ? assignment_date : null, deadline: owner ? deadline : null,
        notes: owner ? notes : null,
        items: parts.map((p, j) => ({ id: `${row}-${kind}-${j}`, title: p, include: true })),
      };
    };
    const current = mk('current', str(r, 'current'), status);
    const queued = mk('queued', str(r, 'queued'), 'new');
    const finished = mk('finished', str(r, 'finished'), 'completed');

    // the same work mentioned in two columns of the same row → keep only the first
    const seen = new Map<string, string>();
    for (const c of [current, finished, queued]) {
      c?.items.forEach((it) => {
        const k = normalize(it.title);
        const dup = [...seen.keys()].find((s) => s === k || s.includes(k) || k.includes(s));
        if (dup) { it.include = false; it.duplicateOf = seen.get(dup); } else seen.set(k, it.title);
      });
    }
    [current, queued, finished].forEach((c) => c && cells.push(c));

    if (!current && !queued && !finished) issues.push('لا توجد أي مهمة لهذا الموظف');
    if (current && !deadline) issues.push('المهمة الحالية بدون موعد نهائي');
    if (current && !assignment_date) issues.push('بدون تاريخ إسناد');
    if (status === 'completed' && !str(r, 'actual_delivery')) issues.push('مكتملة بدون تاريخ تسليم فعلي');
    employees.push({ name, row, issues });
  });
  return { employees, cells, mapping, year };
}

/** Preview (after the admin's edits) → payload for public.import_sheet() */
export function toPayload(p: Preview, sourceName: string) {
  const tasks: Record<string, unknown>[] = [];
  for (const c of p.cells) {
    const items = c.split ? c.items : [{ id: `${c.id}-m`, title: c.raw, include: c.items.some((i) => i.include) }];
    for (const it of items) {
      if (!it.include || !it.title.trim()) continue;
      tasks.push({
        import_key: `sheet:${normalize(c.employee)}:${c.kind}:${normalize(it.title)}`,
        title: it.title.trim(),
        assignee_name: c.kind === 'queued' ? null : c.employee,
        suggested_name: c.kind === 'queued' ? c.employee : null,
        status: c.status, assignment_date: c.assignment_date, deadline: c.deadline, notes: c.notes, row: c.row,
      });
    }
  }
  return { source_name: sourceName, employees: p.employees.map((e) => ({ name: e.name, row: e.row })), tasks };
}
