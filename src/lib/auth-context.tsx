'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'founder' | 'co-founder' | string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  role: 'admin' | 'founder'
  isAdmin: boolean
  isFounder: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: 'founder',
  isAdmin: false,
  isFounder: true,
  loading: true,
  refreshProfile: async () => {},
})

const profileCache = new Map<string, UserProfile>()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('ekodrix_profile')
        if (cached) return JSON.parse(cached)
      } catch {}
    }
    return null
  })
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchProfile = async (currentUser: User) => {
    // 1. Check in-memory cache
    if (profileCache.has(currentUser.id)) {
      const cached = profileCache.get(currentUser.id)!
      setProfile(cached)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (!error && data) {
        const userProf = data as UserProfile
        profileCache.set(currentUser.id, userProf)
        setProfile(userProf)
        try { sessionStorage.setItem('ekodrix_profile', JSON.stringify(userProf)) } catch {}
      } else {
        const role = currentUser.email === 'admin@ekodrix.com' ? 'admin' : 'founder'
        const fallback: UserProfile = {
          id: currentUser.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || null,
          role,
        }
        profileCache.set(currentUser.id, fallback)
        setProfile(fallback)
        try { sessionStorage.setItem('ekodrix_profile', JSON.stringify(fallback)) } catch {}
      }
    } catch {
      const role = currentUser.email === 'admin@ekodrix.com' ? 'admin' : 'founder'
      const fallback: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || '',
        full_name: null,
        role,
      }
      setProfile(fallback)
    }
  }

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      setUser(currentUser)
      if (currentUser.id) profileCache.delete(currentUser.id)
      await fetchProfile(currentUser)
    } else {
      setUser(null)
      setProfile(null)
      try { sessionStorage.removeItem('ekodrix_profile') } catch {}
    }
  }

  useEffect(() => {
    let isMounted = true

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!isMounted) return
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user)
        } else {
          setUser(null)
          setProfile(null)
          try { sessionStorage.removeItem('ekodrix_profile') } catch {}
        }
        if (isMounted) setLoading(false)
      }
    )

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Explicit role calculation: only 'admin' or admin email gets admin permissions
  const isAdmin = profile?.role === 'admin' || user?.email === 'admin@ekodrix.com'
  const isFounder = !isAdmin
  const role: 'admin' | 'founder' = isAdmin ? 'admin' : 'founder'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isAdmin,
        isFounder,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
