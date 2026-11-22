export function workloadLevel(active: number, max: number) {
  const pct = max ? (active / max) * 100 : 0;
  if (pct > 100) return { key: 'overloaded', cls: 'bg-rose-500', text: 'text-rose-700', pct };
  if (pct >= 80) return { key: 'heavy', cls: 'bg-amber-500', text: 'text-amber-700', pct };
  if (pct >= 40) return { key: 'normal', cls: 'bg-brand-600', text: 'text-brand-700', pct };
  return { key: 'light', cls: 'bg-brand-300', text: 'text-brand-700', pct };
}
