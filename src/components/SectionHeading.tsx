import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: SectionHeadingProps) {
  return (
    <div className={cn('space-y-3', align === 'center' && 'mx-auto max-w-2xl text-center')}>
      <p className="text-xs uppercase tracking-[0.45em] text-teal-600">{eyebrow}</p>
      <h2 className="font-display text-3xl leading-tight text-slate-900 md:text-5xl">{title}</h2>
      {description ? <p className="text-sm leading-7 text-slate-600 md:text-base">{description}</p> : null}
    </div>
  )
}
