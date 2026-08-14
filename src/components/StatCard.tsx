import { cn } from '@/lib/utils'
import type { DashboardStat } from '@/types'

const toneClasses = {
  neutral: 'border-stone-200 bg-white/85 text-slate-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function StatCard({ label, value, tone }: DashboardStat) {
  return (
    <div className={cn('rounded-[22px] border p-4 shadow-soft', toneClasses[tone])}>
      <p className="text-xs uppercase tracking-[0.35em] text-current/70">{label}</p>
      <p className="mt-2 font-display text-2xl">{value}</p>
    </div>
  )
}
