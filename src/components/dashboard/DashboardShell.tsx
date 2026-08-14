import { useEffect, useState } from 'react'
import { ChevronDown, LogOut, Menu, UserCircle2, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import type { AppUser } from '@/types'

export interface DashboardMenuItem {
  key: string
  label: string
  children?: DashboardMenuItem[]
}

interface DashboardShellProps {
  user: AppUser
  title: string
  subtitle: string
  menu: DashboardMenuItem[]
  activeKey: string
  onSelect: (key: string) => void
  children: React.ReactNode
}

export function DashboardShell({
  user,
  title,
  subtitle,
  menu,
  activeKey,
  onSelect,
  children,
}: DashboardShellProps) {
  const clearSession = useAppStore((state) => state.clearSession)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const hasActiveDescendant = (item: DashboardMenuItem, currentKey: string): boolean =>
    item.children?.some((child) => child.key === currentKey || hasActiveDescendant(child, currentKey)) ?? false

  const getFirstLeafKey = (item: DashboardMenuItem): string => {
    if (!item.children?.length) return item.key
    return getFirstLeafKey(item.children[0])
  }

  useEffect(() => {
    const collectOpenParents = (items: DashboardMenuItem[], accumulator: Record<string, boolean>) => {
      items.forEach((item) => {
        if (hasActiveDescendant(item, activeKey)) {
          accumulator[item.key] = true
        }

        if (item.children?.length) {
          collectOpenParents(item.children, accumulator)
        }
      })
    }

    const nextState: Record<string, boolean> = {}
    collectOpenParents(menu, nextState)

    setOpenGroups((current) => ({ ...nextState, ...current }))
  }, [activeKey, menu])

  useEffect(() => {
    if (!mobileSidebarOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileSidebarOpen])

  const renderMenuItems = (items: DashboardMenuItem[], level = 0) =>
    items.map((item) => {
      const isActive = activeKey === item.key || hasActiveDescendant(item, activeKey)
      const isRoot = level === 0

      return (
        <div key={item.key} className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              if (item.children?.length) {
                setOpenGroups((current) => ({ ...current, [item.key]: !current[item.key] }))
                onSelect(getFirstLeafKey(item))
                return
              }
              setMobileSidebarOpen(false)
              onSelect(item.key)
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm transition ${
              isRoot
                ? isActive
                  ? 'bg-teal-300 text-slate-950'
                  : 'border border-stone-200 bg-white text-slate-600 hover:border-stone-300 hover:bg-stone-50'
                : isActive
                  ? 'bg-teal-100 text-teal-800'
                  : 'border border-stone-200 bg-stone-50 text-slate-600 hover:border-stone-300 hover:bg-white'
            }`}
          >
            <span>{item.label}</span>
            {item.children?.length ? (
              <ChevronDown className={`h-4 w-4 transition ${openGroups[item.key] ? 'rotate-180' : ''}`} />
            ) : null}
          </button>

          {item.children?.length && openGroups[item.key] ? (
            <div className={`${isRoot ? 'ml-3 border-l pl-3' : 'ml-2 border-l pl-2'} space-y-1.5 border-stone-200`}>
              {renderMenuItems(item.children, level + 1)}
            </div>
          ) : null}
        </div>
      )
    })

  return (
    <div className="min-h-screen bg-ink text-slate-800">
      {mobileSidebarOpen ? <button type="button" aria-label="Tutup sidebar" onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" /> : null}

      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-3 px-2 py-2 sm:px-3 sm:py-3 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-4">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[84vw] flex-col overflow-hidden border-r border-stone-200 bg-white/95 p-4 shadow-soft backdrop-blur transition-transform duration-200 lg:sticky lg:top-3 lg:self-start lg:h-[calc(100vh-1.5rem)] lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-[26px] lg:border lg:bg-white/90 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between gap-3 rounded-[22px] border border-stone-200 bg-stone-50 p-3.5">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-teal-200 bg-white p-1">
              <img src="/genjaka-logo.png" alt="Logo Genjaka" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg text-slate-900">Genjaka Panel</p>
              <p className="text-xs text-slate-500">{user.role.toUpperCase()}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-slate-600 lg:hidden"
              aria-label="Tutup menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {user.role !== 'admin' ? (
            <div className="mt-4 rounded-[22px] border border-stone-200 bg-white p-3.5">
              <div className="flex items-center gap-3">
                <UserCircle2 className="h-9 w-9 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className={`${user.role !== 'admin' ? 'mt-4' : 'mt-6'} min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]`}>
            {renderMenuItems(menu)}
          </div>

          <div className="mt-4 flex shrink-0 gap-2 border-t border-stone-200 pt-4">
            <NavLink to="/" className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-center text-sm text-slate-700">
              Landing
            </NavLink>
            <button
              type="button"
              onClick={clearSession}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </aside>

        <main className="min-w-0 overflow-x-hidden rounded-[24px] border border-stone-200 bg-gradient-to-br from-white to-stone-50 p-4 shadow-soft sm:rounded-[26px] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-stone-200 pb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-slate-700"
              aria-label="Buka menu sidebar"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
              <p className="text-[11px] text-slate-500">{user.role.toUpperCase()}</p>
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 border-b border-stone-200 pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.4em] text-teal-600">{user.role}</p>
              <h1 className="mt-2 text-2xl font-display text-slate-900 sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>
            {user.role === 'admin' ? (
              <div className="rounded-[18px] border border-stone-200 bg-white px-3.5 py-2.5 text-sm">
                <p className="font-medium text-slate-900">{user.fullName}</p>
                <p className="text-slate-500">{user.email}</p>
              </div>
            ) : (
              <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
                Status akun: {user.approvalStatus}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4 sm:space-y-5">{children}</div>
        </main>
      </div>
    </div>
  )
}
