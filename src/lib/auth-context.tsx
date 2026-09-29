'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      if (!error && data) {
        setProfile(data as UserProfile)
      } else {
        // Fallback by email if profile lookup fails
        const role = currentUser.email === 'admin@ekodrix.com' ? 'admin' : 'founder'
        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || null,
          role,
        })
      }
    } catch {
      const role = currentUser.email === 'admin@ekodrix.com' ? 'admin' : 'founder'
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        full_name: null,
        role,
      })
    }
  }

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      setUser(currentUser)
      await fetchProfile(currentUser)
    } else {
      setUser(null)
      setProfile(null)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        setUser(currentUser)
        await fetchProfile(currentUser)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
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
