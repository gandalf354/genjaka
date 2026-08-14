import { useEffect, useMemo, useState, type SVGProps } from 'react'
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Mail, MapPin, Phone, Sparkles } from 'lucide-react'
import { LandingHeader } from '@/components/LandingHeader'
import { SectionHeading } from '@/components/SectionHeading'
import { useAppStore } from '@/store/useAppStore'

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6H16V4.8c-.4-.1-1.2-.2-2.2-.2-2.2 0-3.8 1.3-3.8 3.9V11H7.5v3H10V21h3.5Z" />
    </svg>
  )
}

function TiktokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14.9 3c.3 2 1.5 3.8 3.3 4.7a6.9 6.9 0 0 0 2.3.7v2.8a9.5 9.5 0 0 1-3.8-1.2v5.3c0 3.4-2.7 5.8-6 5.8A5.8 5.8 0 0 1 5 15.3c0-3.2 2.6-5.8 5.8-5.8.3 0 .7 0 1 .1v2.9a3.4 3.4 0 0 0-1-.2 3 3 0 0 0-3 3c0 1.7 1.3 3 2.9 3 1.8 0 3-1.4 3-3.4V3h3.2Z" />
    </svg>
  )
}

export default function LandingPage() {
  const { landingPage, highlights, loadLandingPage } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activityStartIndex, setActivityStartIndex] = useState(0)
  const ui = landingPage?.ui

  useEffect(() => {
    void loadLandingPage()
  }, [loadLandingPage])

  const orderedActivities = useMemo(
    () => [...(landingPage?.activities || [])].sort((a, b) => b.sortOrder - a.sortOrder || b.id - a.id),
    [landingPage?.activities],
  )

  const featuredActivities = useMemo(() => {
    if (orderedActivities.length <= 3) {
      return orderedActivities
    }

    return Array.from({ length: 3 }, (_, offset) => orderedActivities[(activityStartIndex + offset) % orderedActivities.length])
  }, [activityStartIndex, orderedActivities])

  useEffect(() => {
    setActivityStartIndex(0)
  }, [orderedActivities.length])

  useEffect(() => {
    if (orderedActivities.length <= 3) return

    const interval = window.setInterval(() => {
      setActivityStartIndex((current) => (current + 1) % orderedActivities.length)
    }, 4500)

    return () => window.clearInterval(interval)
  }, [orderedActivities.length])

  const showActivityControls = orderedActivities.length > 3

  const moveActivities = (direction: 'prev' | 'next') => {
    if (orderedActivities.length <= 3) return

    setActivityStartIndex((current) =>
      direction === 'next'
        ? (current + 1) % orderedActivities.length
        : (current - 1 + orderedActivities.length) % orderedActivities.length,
    )
  }

  return (
    <div className="min-h-screen bg-ink text-slate-800">
      <LandingHeader landingPage={landingPage} onOpenMenu={() => setMobileOpen((value) => !value)} />

      {mobileOpen ? (
        <div className="border-b border-stone-200 bg-white/95 px-4 py-4 lg:hidden">
          <div className="space-y-3 text-sm text-slate-700">
            {[
              [ui?.navHomeLabel || 'Home', '#home'],
              [ui?.navVisionLabel || 'Visi', '#visi'],
              [ui?.navMissionLabel || 'Misi', '#misi'],
              [ui?.navActivitiesLabel || 'Kegiatan', '#kegiatan'],
              [ui?.navContactLabel || 'Hubungi', '#hubungi'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" onClick={() => setMobileOpen(false)}>
                {label}
              </a>
            ))}
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <a
                href="/login"
                className="block rounded-2xl border border-stone-300 bg-white px-4 py-3 text-center font-medium text-slate-700"
                onClick={() => setMobileOpen(false)}
              >
                {ui?.headerLoginLabel || 'Login'}
              </a>
              <a
                href="/register"
                className="block rounded-2xl bg-teal-300 px-4 py-3 text-center font-semibold text-slate-950"
                onClick={() => setMobileOpen(false)}
              >
                {ui?.headerRegisterLabel || 'Registrasi'}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <main>
        <section id="home" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.12),_transparent_24%)]" />
          <div className="container relative grid gap-12 px-4 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs uppercase tracking-[0.35em] text-teal-700">
                <Sparkles className="h-4 w-4" />
                {landingPage?.heroBadge || 'Portal modern untuk lembaga pendidikan'}
              </div>
              <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.02] text-slate-900 md:text-7xl">
                {landingPage?.heroTitle || 'Portal Genjaka'}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                {landingPage?.heroSubtitle || 'Memuat landing page, registrasi, biodata, absensi, dan dashboard admin.'}
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <a href="/register" className="inline-flex items-center gap-2 rounded-full bg-teal-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-200">
                  {ui?.heroPrimaryButtonLabel || 'Registrasi Sekarang'}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href="/login" className="rounded-full border border-stone-300 bg-white px-6 py-3 text-sm text-slate-700 transition hover:border-teal-300 hover:bg-stone-50">
                  {ui?.heroSecondaryButtonLabel || 'Login Dashboard'}
                </a>
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-3">
                {highlights.map((item) => (
                  <div key={item.label} className="rounded-[28px] border border-stone-200 bg-white/85 p-5 shadow-soft">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{item.label}</p>
                    <p className="mt-4 font-display text-2xl text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-4 top-10 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-300/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[36px] border border-stone-200 bg-white/90 shadow-soft">
                {landingPage?.heroImageUrl ? (
                  <img
                    src={landingPage.heroImageUrl}
                    alt={landingPage.heroTitle || ui?.heroImageAlt || 'Foto utama Genjaka'}
                    className="h-[440px] w-full object-cover"
                  />
                ) : (
                  <div className="flex h-[440px] items-center justify-center bg-stone-100 px-6 text-center text-sm text-slate-500">
                    {ui?.heroImagePlaceholderText || 'Foto utama home belum ditambahkan.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="visi" className="container px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <SectionHeading
              eyebrow={ui?.navVisionLabel || 'Visi'}
              title={ui?.visionHeadingTitle || 'Landasan digital yang modern, tertib, dan tetap terasa hangat.'}
              description={
                ui?.visionHeadingDescription ||
                'Landing page membawa identitas lembaga ke ruang publik, sementara dashboard internal membantu pengelolaan data dan proses harian secara akurat.'
              }
            />
            <div className="rounded-[32px] border border-stone-200 bg-white/85 p-8 text-base leading-8 text-slate-700 shadow-soft">
              {landingPage?.visionText}
            </div>
          </div>
        </section>

        <section id="misi" className="container px-4 py-20">
          <SectionHeading
            eyebrow={ui?.navMissionLabel || 'Misi'}
            title={ui?.missionHeadingTitle || 'Tiga fokus utama yang menjadi penggerak sistem.'}
            description={ui?.missionHeadingDescription || undefined}
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {(landingPage?.missionItems || []).map((item, index) => (
              <div key={item} className="rounded-[30px] border border-stone-200 bg-stone-50/90 p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.4em] text-amber-600">0{index + 1}</p>
                <div className="mt-5 flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-teal-600" />
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="kegiatan" className="container px-4 py-20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow={ui?.navActivitiesLabel || 'Kegiatan'}
              title={ui?.activitiesHeadingTitle || 'Ruang aktivitas yang memperlihatkan ritme pembinaan dan kolaborasi.'}
              description={
                ui?.activitiesHeadingDescription ||
                'Menampilkan tiga kegiatan terbaru secara descending. Jika datanya lebih dari tiga, kartu akan bergeser otomatis dan tetap bisa digeser manual.'
              }
            />
            {showActivityControls ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => moveActivities('prev')}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                  aria-label="Lihat kegiatan sebelumnya"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveActivities('next')}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-stone-300 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                  aria-label="Lihat kegiatan berikutnya"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {featuredActivities.map((activity) => (
              <article key={activity.id} className="overflow-hidden rounded-[32px] border border-stone-200 bg-white/90 shadow-soft">
                <img src={activity.imageUrl} alt={activity.title} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <h3 className="font-display text-2xl text-slate-900">{activity.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{activity.description}</p>
                </div>
              </article>
            ))}
          </div>
          {showActivityControls ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {orderedActivities.map((activity, index) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => setActivityStartIndex(index)}
                  className={`h-2.5 rounded-full transition ${
                    activityStartIndex === index ? 'w-8 bg-teal-500' : 'w-2.5 bg-stone-300 hover:bg-stone-400'
                  }`}
                  aria-label={`Tampilkan kegiatan mulai dari urutan ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section id="hubungi" className="container px-4 py-20">
          <div className="grid gap-8 rounded-[36px] border border-stone-200 bg-gradient-to-r from-white to-stone-100 p-8 shadow-soft lg:grid-cols-[1.1fr_0.9fr]">
            <SectionHeading
              eyebrow={ui?.navContactLabel || 'Hubungi'}
              title={ui?.contactHeadingTitle || 'Buka percakapan awal dengan lembaga Anda secara lebih rapi.'}
              description={
                ui?.contactHeadingDescription ||
                'Bagian kontak ini juga dikelola dari panel admin, termasuk daftar sosial media agar pengunjung mudah terhubung lewat kanal yang mereka gunakan.'
              }
            />
            <div className="space-y-4">
              {[
                { Icon: MapPin, value: landingPage?.contactAddress },
                { Icon: Phone, value: landingPage?.contactPhone },
                { Icon: Mail, value: landingPage?.contactEmail },
              ].map(({ Icon, value }, index) => (
                <div key={index} className="flex items-start gap-4 rounded-[28px] border border-stone-200 bg-white/90 p-5">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm leading-7 text-slate-700">{value}</p>
                </div>
              ))}

              <div className="rounded-[28px] border border-stone-200 bg-white/90 p-5">
                <p className="text-sm font-semibold text-slate-900">{ui?.socialMediaTitle || 'Sosial Media'}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {[
                    { label: 'Instagram', value: landingPage?.instagramUrl, Icon: InstagramIcon },
                    { label: 'Facebook', value: landingPage?.facebookUrl, Icon: FacebookIcon },
                    { label: 'Tiktok', value: landingPage?.tiktokUrl, Icon: TiktokIcon },
                  ]
                    .filter((item) => item.value)
                    .map((item) => (
                      <a
                        key={item.label}
                        href={item.value}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-slate-700 transition hover:border-teal-300 hover:bg-white hover:text-teal-700"
                        aria-label={item.label}
                        title={item.label}
                      >
                        <item.Icon className="h-5 w-5" />
                      </a>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
