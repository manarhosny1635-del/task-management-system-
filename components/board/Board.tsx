'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n/t';
import { errorText } from '@/lib/i18n';
import { moveTask } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';
import { emitChanged, useOnChanged } from '@/lib/events';
import { KANBAN_COLUMNS, PRIORITY_RANK, STATUS_COLOR } from '@/lib/constants';
import { allowedColumns, columnOf, moveFor, type MovePerms } from '@/lib/workflow';
import type { TaskRow, TaskStatus } from '@/lib/types';
import { useToast } from '../Toast';
import { Modal } from '../Modal';
import { Icon } from '../Shell';
import { QuickAddModal, type QuickAddData } from '../QuickAdd';
import { BoardCard } from './BoardCard';
import { TaskDrawer } from './TaskDrawer';

export type BoardTask = TaskRow & { perms: MovePerms };
type Prompt = { task: BoardTask; to: TaskStatus; need: 'reason' | 'assignee'; action: string };

const colLabel = (c: TaskStatus) => (c === 'new' ? t('board.columnNew') : t(`status.${c}`));

export function Board({ tasks, people, sort, quickAdd, columns = KANBAN_COLUMNS, profileId }:
  { tasks: BoardTask[]; people: { id: string; name: string }[]; sort: string; quickAdd: QuickAddData | null; columns?: TaskStatus[]; profileId: string }) {
  const router = useRouter();
  const toast = useToast();
  // optimistic overrides: id → status shown while the server confirms
  const [over, setOver] = useState<Record<string, { status: TaskStatus; saving: boolean }>>({});
  const [landed, setLanded] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; allowed: Set<TaskStatus>; hover: TaskStatus | null } | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // server data wins once it arrives (after router.refresh)
  useEffect(() => { setOver((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v.saving))); }, [tasks]);

  const view = useMemo(() => tasks.map((x) => (over[x.id] ? { ...x, status: over[x.id].status } : x)), [tasks, over]);
  const byCol = useMemo(() => {
    const m = new Map<TaskStatus, BoardTask[]>(columns.map((c) => [c, []]));
    for (const x of view) m.get(columnOf(x.status))?.push(x);
    const cmp = sort === 'priority'
      ? (a: BoardTask, b: BoardTask) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.current_deadline ?? '9').localeCompare(b.current_deadline ?? '9')
      : (a: BoardTask, b: BoardTask) => (a.current_deadline ?? '9').localeCompare(b.current_deadline ?? '9') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    m.forEach((list) => list.sort(cmp));
    return m;
  }, [view, columns, sort]);

  // live updates from other people (Supabase Realtime) — never while a card is in the air
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel('board-' + profileId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (!dragging.current) router.refresh(); }, 600);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [profileId, router]);
  useOnChanged(() => router.refresh());

  const commit = useCallback(async (task: BoardTask, to: TaskStatus, opts: { reason?: string; assigneeId?: string } = {}) => {
    setOver((o) => ({ ...o, [task.id]: { status: to, saving: true } }));
    let res;
    try { res = await moveTask(task.id, to, opts); } catch { res = { ok: false as const, error: 'err.generic' }; }
    if (res.ok) {
      const final = (res.data ?? to) as TaskStatus;
      setOver((o) => ({ ...o, [task.id]: { status: final, saving: false } }));
      setLanded(task.id);
      setTimeout(() => setLanded((l) => (l === task.id ? null : l)), 900);
      toast(t('board.moved', { code: task.code, to: colLabel(columnOf(final)) }));
      emitChanged();
      router.refresh();
    } else {
      setOver((o) => { const n = { ...o }; delete n[task.id]; return n; });
      toast(`${t('board.moveFailed')} — ${errorText(t, res.error)}`, 'error');
    }
  }, [router, toast]);

  const onDrop = useCallback((task: BoardTask, to: TaskStatus | null): boolean => {
    if (!to || to === columnOf(task.status)) return false;
    const m = moveFor(task, to, task.perms);
    if (!m) {
      toast(t('board.notAllowed', { from: colLabel(columnOf(task.status)), to: colLabel(to) }), 'error');
      return false;
    }
    if (m.need) {
      setOver((o) => ({ ...o, [task.id]: { status: to, saving: true } })); // show it where it was dropped while we ask
      setPrompt({ task, to, need: m.need, action: m.action.kind === 'transition' ? m.action.action : m.action.kind });
      return true;
    }
    commit(task, to);
    return true;
  }, [commit, toast]);

  // ---------- pointer-driven drag & drop ---------------------------------
  const startDrag = useCallback((e: React.PointerEvent<HTMLElement>, task: BoardTask) => {
    if (e.button !== 0 || over[task.id]?.saving) return;
    const isTouch = e.pointerType === 'touch';
    const target = e.target as HTMLElement;
    if (isTouch && !target.closest('[data-drag-handle]')) return; // touch: drag by the grip, scroll everywhere else
    if (target.closest('a,button:not([data-drag-handle]),input,select,textarea')) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const off = { x: sx - rect.left, y: sy - rect.top }; // keep the exact grab point under the pointer
    let ghost: HTMLElement | null = null;
    let lastX = sx, lastT = performance.now(), vx = 0, px = sx, py = sy, raf = 0;
    let hover: TaskStatus | null = null;
    const allowed = allowedColumns(task, task.perms, columns);
    const pointerId = e.pointerId;

    const place = () => {
      if (!ghost) return;
      const tilt = Math.max(-5, Math.min(5, vx * 0.012));
      ghost.style.transform = `translate3d(${px - off.x}px, ${py - off.y}px, 0) rotate(${tilt}deg) scale(1.03)`;
    };
    const tick = () => {
      // auto-scroll the board / page near the edges
      const sc = scroller.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (px < r.left + 70) sc.scrollBy({ left: -Math.ceil((r.left + 70 - px) / 4) });
        else if (px > r.right - 70) sc.scrollBy({ left: Math.ceil((px - (r.right - 70)) / 4) });
      }
      if (py < 90) window.scrollBy({ top: -8 }); else if (py > window.innerHeight - 50) window.scrollBy({ top: 8 });
      raf = requestAnimationFrame(tick);
    };
    const hit = (): TaskStatus | null => {
      const el = document.elementFromPoint(px, py) as HTMLElement | null;
      return (el?.closest('[data-col]')?.getAttribute('data-col') as TaskStatus) ?? null;
    };

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      px = ev.clientX; py = ev.clientY;
      const now = performance.now();
      vx = (px - lastX) / Math.max(1, now - lastT) * 16; lastX = px; lastT = now;
      if (!ghost) {
        if (Math.hypot(px - sx, py - sy) < (isTouch ? 2 : 6)) return; // small hysteresis before committing to a drag
        ghost = card.cloneNode(true) as HTMLElement;
        Object.assign(ghost.style, {
          position: 'fixed', left: '0', top: '0', width: `${rect.width}px`, zIndex: '80', pointerEvents: 'none',
          margin: '0', boxShadow: '0 18px 40px -10px rgba(40,48,48,.35)', transition: 'none', willChange: 'transform',
        });
        document.body.appendChild(ghost);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        card.style.opacity = '0.35';
        dragging.current = true;
        setDrag({ id: task.id, allowed, hover: null });
        raf = requestAnimationFrame(tick);
      }
      ev.preventDefault();
      place();
      const h = hit();
      if (h !== hover) { hover = h; setDrag((d) => (d ? { ...d, hover: h } : d)); }
    };

    const end = (ev: PointerEvent | KeyboardEvent) => {
      if ('pointerId' in ev && ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (!ghost) return; // it was a click
      (card as HTMLElement & { _dragged?: boolean })._dragged = true;
      setTimeout(() => { (card as HTMLElement & { _dragged?: boolean })._dragged = false; }, 0);
      const cancelled = !('pointerId' in ev) || ev.type === 'pointercancel';
      const target = cancelled ? null : hover;
      const accepted = target ? onDrop(task, target) : false;
      const g = ghost;
      dragging.current = false;
      setDrag(null);
      if (accepted) {
        g.remove();
        card.style.opacity = '';
      } else {
        // glide back to where it came from
        const back = card.getBoundingClientRect();
        g.style.transition = 'transform 260ms cubic-bezier(.2,.9,.25,1), box-shadow 260ms';
        g.style.transform = `translate3d(${back.left}px, ${back.top}px, 0) rotate(0deg) scale(1)`;
        g.style.boxShadow = '0 1px 2px rgba(40,48,48,.06)';
        setTimeout(() => { g.remove(); card.style.opacity = ''; }, 270);
      }
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { hover = null; end(ev); } };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', onKey);
  }, [columns, onDrop, over]);

  const openCard = (e: React.MouseEvent<HTMLElement>, id: string) => {
    if ((e.currentTarget as HTMLElement & { _dragged?: boolean })._dragged) return;
    setOpenId(id);
  };

  return (
    <>
      <div ref={scroller} className={`-mx-4 overflow-x-auto px-4 pb-4 scroll-thin sm:-mx-6 sm:px-6 ${drag ? '' : 'snap-x snap-mandatory sm:snap-none'}`}>
        <div className="flex min-w-max gap-3">
          {columns.map((c) => {
            const list = byCol.get(c) ?? [];
            const isAllowed = drag?.allowed.has(c);
            const isHover = drag?.hover === c;
            const dim = drag && !isAllowed && columnOf(view.find((x) => x.id === drag.id)?.status ?? 'new') !== c;
            const overdue = list.filter((x) => x.is_overdue).length;
            return (
              <section key={c} data-col={c} aria-label={colLabel(c)}
                className={`flex w-[284px] shrink-0 snap-center flex-col rounded-2xl border transition-[background-color,border-color,opacity,box-shadow] duration-150
                  ${isHover && isAllowed ? 'border-brand-600 bg-brand-200/70 shadow-[inset_0_0_0_1px_#5D6B6B]' : isAllowed ? 'border-dashed border-brand-400 bg-brand-100' : 'border-transparent bg-brand-100/60'}
                  ${dim ? 'opacity-40' : ''}`}>
                <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[c] }} />
                  <h2 className="truncate text-[13px] font-bold text-ink-800">{colLabel(c)}</h2>
                  <span className="rounded-full bg-white px-2 text-xs font-bold tabular-nums text-ink-600 ring-1 ring-brand-200">{list.length}</span>
                  {overdue > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-200 px-1.5 text-[10px] font-bold leading-5 text-rose-700" title={t('board.overdue')}><Icon name="alert" className="h-3 w-3" />{overdue}</span>}
                  {c === 'new' && quickAdd && (
                    <button className="ms-auto rounded-lg p-1 text-ink-500 transition hover:bg-white hover:text-ink-900 active:scale-95" onClick={() => setQuickOpen(true)} aria-label={t('board.quickAdd')} title={t('board.quickAdd')}>
                      <Icon name="plus" className="h-4 w-4" />
                    </button>
                  )}
                </header>
                <div className="flex max-h-[calc(100vh-250px)] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2 scroll-thin">
                  {list.map((x) => (
                    <BoardCard key={x.id} task={x} saving={!!over[x.id]?.saving} landed={landed === x.id}
                      onPointerDown={(e) => startDrag(e, x)} onOpen={(e) => openCard(e, x.id)} />
                  ))}
                  {!list.length && (
                    <div className={`flex flex-1 items-center justify-center rounded-xl border-2 border-dashed px-3 py-6 text-center text-xs ${isAllowed ? 'border-brand-500 text-brand-700' : 'border-brand-200 text-ink-400'}`}>
                      {isAllowed ? t('board.dropHere') : t('board.empty')}
                    </div>
                  )}
                  {!!list.length && isAllowed && (
                    <div className="rounded-xl border-2 border-dashed border-brand-500 py-3 text-center text-xs font-semibold text-brand-700">{t('board.dropHere')}</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {prompt && (
        <MovePrompt prompt={prompt} people={people}
          onCancel={() => { setOver((o) => { const n = { ...o }; delete n[prompt.task.id]; return n; }); setPrompt(null); }}
          onConfirm={(v) => { const p = prompt; setPrompt(null); commit(p.task, p.to, p.need === 'reason' ? { reason: v } : { assigneeId: v }); }} />
      )}
      {openId && <TaskDrawer id={openId} onClose={() => setOpenId(null)} />}
      {quickOpen && quickAdd && <QuickAddModal data={quickAdd} onClose={() => setQuickOpen(false)} />}
    </>
  );
}

function MovePrompt({ prompt, people, onCancel, onConfirm }:
  { prompt: Prompt; people: { id: string; name: string }[]; onCancel: () => void; onConfirm: (v: string) => void }) {
  const [v, setV] = useState(prompt.task.suggested_assignee_id ?? '');
  const reason = prompt.need === 'reason';
  const ok = reason ? v.trim().length >= 3 : !!v;
  return (
    <Modal open title={reason ? t(`board.reasonTitle.${prompt.action}`) : t('board.assignTitle')} onClose={onCancel}
      description={<><span className="font-mono">{prompt.task.code}</span> · {prompt.task.title}</>}
      footer={<>
        <button className="btn-secondary" onClick={onCancel}>{t('common.cancel')}</button>
        <button className={prompt.action === 'reject' ? 'btn-danger' : 'btn-primary'} disabled={!ok} onClick={() => onConfirm(v)}>{t('common.confirm')}</button>
      </>}>
      {reason ? (
        <>
          <textarea autoFocus rows={4} className="input" value={v} onChange={(e) => setV(e.target.value)}
            placeholder={prompt.action === 'reject' ? t('actions.rejectReasonPh') : prompt.action === 'hold' ? t('actions.holdReasonPh') : t('actions.changesPh')} />
          <p className="hint">{t('common.required')}</p>
        </>
      ) : (
        <>
          <label className="label">{t('board.chooseAssignee')}</label>
          <select autoFocus className="input" value={v} onChange={(e) => setV(e.target.value)}>
            <option value="">{t('actions.chooseEmployee')}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </>
      )}
    </Modal>
  );
}
