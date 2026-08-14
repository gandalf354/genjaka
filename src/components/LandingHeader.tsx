import { Menu } from 'lucide-react'
import type { LandingPageContent } from '@/types'

interface LandingHeaderProps {
  onOpenMenu: () => void
  landingPage?: LandingPageContent | null
}

export function LandingHeader({ onOpenMenu, landingPage }: LandingHeaderProps) {
  const ui = landingPage?.ui
  const navItems = [
    { label: ui?.navHomeLabel || 'Home', href: '#home' },
    { label: ui?.navVisionLabel || 'Visi', href: '#visi' },
    { label: ui?.navMissionLabel || 'Misi', href: '#misi' },
    { label: ui?.navActivitiesLabel || 'Kegiatan', href: '#kegiatan' },
    { label: ui?.navContactLabel || 'Hubungi', href: '#hubungi' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/80 backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between gap-6 px-4">
        <a href="#home" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-teal-200 bg-white p-1">
            <img src="/genjaka-logo.png" alt={ui?.headerLogoAlt || 'Logo Genjaka'} className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-display text-lg text-slate-900">{ui?.headerBrandName || 'Genjaka'}</p>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{ui?.headerTagline || 'Portal Akademik'}</p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-slate-600 lg:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-slate-900">
              {item.label}
            </a>
          ))}
          <a href="/login" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-slate-700 transition hover:border-teal-300 hover:text-slate-900">
            {ui?.headerLoginLabel || 'Login'}
          </a>
          <a href="/register" className="rounded-full bg-teal-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-teal-200">
            {ui?.headerRegisterLabel || 'Registrasi'}
          </a>
        </nav>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-300 bg-white text-slate-700 lg:hidden"
          onClick={onOpenMenu}
          aria-label="Buka navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
