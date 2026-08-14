import { create } from 'zustand'
import { api, setApiToken } from '@/lib/api'
import type { AppUser, LandingPageContent, PublicHighlight, UserProfile } from '@/types'

interface AppState {
  initialized: boolean
  token: string | null
  user: AppUser | null
  profile: UserProfile | null
  landingPage: LandingPageContent | null
  highlights: PublicHighlight[]
  initialize: () => void
  setSession: (payload: { token: string; user: AppUser }) => void
  clearSession: () => void
  loadCurrentUser: () => Promise<void>
  loadLandingPage: () => Promise<void>
}

const TOKEN_KEY = 'genjaka-token'
const USER_KEY = 'genjaka-user'

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  token: null,
  user: null,
  profile: null,
  landingPage: null,
  highlights: [],
  initialize: () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    const user = storedUser ? (JSON.parse(storedUser) as AppUser) : null
    setApiToken(token || undefined)
    set({ initialized: true, token, user })
  },
  setSession: ({ token, user }) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    setApiToken(token)
    set({ initialized: true, token, user })
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setApiToken(undefined)
    set({ initialized: true, token: null, user: null, profile: null })
  },
  loadCurrentUser: async () => {
    const token = get().token
    if (!token) return

    try {
      const response = await api.get('/auth/me')
      set({
        user: response.data.user,
        profile: response.data.profile,
      })
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user))
    } catch (_error) {
      get().clearSession()
    }
  },
  loadLandingPage: async () => {
    const response = await api.get('/public/landing-page')
    set({
      landingPage: response.data.content,
      highlights: response.data.highlights,
    })
  },
}))
