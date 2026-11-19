export function workloadLevel(active: number, max: number) {
  const pct = max ? (active / max) * 100 : 0;
  if (pct > 100) return { key: 'overloaded', cls: 'bg-red-600', text: 'text-red-700', pct };
  if (pct >= 80) return { key: 'heavy', cls: 'bg-amber-500', text: 'text-amber-700', pct };
  if (pct >= 40) return { key: 'normal', cls: 'bg-brand-500', text: 'text-brand-700', pct };
  return { key: 'light', cls: 'bg-green-500', text: 'text-green-700', pct };
}

