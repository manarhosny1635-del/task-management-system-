'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { t } from '@/lib/i18n/t';
import { Empty } from './ui';

const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#eef2f6';
const BRAND = '#3b6cf6';

export interface Datum { name: string; value: number; color?: string }

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg" dir="auto">
      <div className="mb-1 font-semibold text-ink-900">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-700">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name}</span><span className="ms-auto ps-3 font-semibold tabular-nums text-ink-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars — long Arabic names stay readable. One series → no legend. */
export function HBar({ data, seriesName, height }: { data: Datum[]; seriesName: string; height?: number }) {
  if (!data.length || data.every((d) => !d.value)) return <Empty />;
  const h = height ?? Math.max(160, data.length * 30 + 30);
  return (
    <div dir="ltr" style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} reversed />
          <YAxis type="category" dataKey="name" orientation="right" width={150} tick={{ ...AXIS, fill: '#334155' }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" name={seriesName} radius={[4, 0, 0, 4]} maxBarSize={18} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.name} fill={d.color ?? BRAND} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-series stacked horizontal bars (e.g. completed vs pending per employee). */
export function StackedHBar({ data, a, b }: { data: { name: string; a: number; b: number }[]; a: { label: string; color: string }; b: { label: string; color: string } }) {
  if (!data.length) return <Empty />;
  return (
    <div dir="ltr" style={{ height: Math.max(180, data.length * 30 + 60) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} reversed />
          <YAxis type="category" dataKey="name" orientation="right" width={150} tick={{ ...AXIS, fill: '#334155' }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
          <Legend verticalAlign="top" height={28} iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: '#334155' }} />
          <Bar dataKey="a" name={a.label} stackId="s" fill={a.color} maxBarSize={18} isAnimationActive={false} stroke="#fff" strokeWidth={1} />
          <Bar dataKey="b" name={b.label} stackId="s" fill={b.color} maxBarSize={18} radius={[4, 0, 0, 4]} isAnimationActive={false} stroke="#fff" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole as a single segmented bar + labelled rows (clearer than a pie). */
export function SplitBar({ parts }: { parts: Datum[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <Empty />;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.filter((p) => p.value).map((p) => (
          <div key={p.name} title={`${p.name}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-ink-700">{p.name}</span>
            <span className="ms-auto font-semibold tabular-nums text-ink-900">{p.value}</span>
            <span className="w-12 text-end text-xs tabular-nums text-ink-500">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const chartLabels = { tasks: () => t('dashboard.total') };
