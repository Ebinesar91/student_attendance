import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    // Check active session on load
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (session) {
          setUser(session.user)
          setIsDemo(false)
        } else {
          // Check local storage for demo session
          const demoUser = localStorage.getItem('school_attendance_demo_admin')
          if (demoUser) {
            setUser(JSON.parse(demoUser))
            setIsDemo(true)
          }
        }
      } catch (err) {
        console.error('Session check failed:', err)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user)
        setIsDemo(false)
        localStorage.removeItem('school_attendance_demo_admin')
      } else if (!isDemo) {
        setUser(null)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [isDemo])

  // Login handler
  const login = async (email, password) => {
    // Fallback/Demo admin login
    if (email === 'admin@school.com' && password === 'admin123') {
      const mockUser = {
        id: 'demo-admin-id',
        email: 'admin@school.com',
        user_metadata: { name: 'Demo Administrator' }
      }
      setUser(mockUser)
      setIsDemo(true)
      localStorage.setItem('school_attendance_demo_admin', JSON.stringify(mockUser))
      return { user: mockUser, error: null }
    }

    // Try Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      setUser(data.user)
      setIsDemo(false)
      return { user: data.user, error: null }
    } catch (err) {
      return { user: null, error: err.message || err }
    }
  }

  // Logout handler
  const logout = async () => {
    try {
      if (isDemo) {
        setUser(null)
        setIsDemo(false)
        localStorage.removeItem('school_attendance_demo_admin')
      } else {
        await supabase.auth.signOut()
        setUser(null)
      }
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isDemo
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
