import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/AuthContext'

export const Layout = () => {
  const { user, isDemo } = useAuth()
  const location = useLocation()

  // Get human-readable page name based on route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Admin Dashboard'
      case '/students':
        return 'Student Registration'
      case '/teachers':
        return 'Teacher Registration'
      case '/staff-register':
        return 'Staff Registration'
      case '/scan-students':
        return 'Student Attendance Scanner'
      case '/student-attendance':
        return 'Student Attendance Log'
      case '/scan-staff':
        return 'Staff Attendance Scanner'
      case '/reports':
        return 'System Reports'
      case '/settings':
        return 'Settings'
      default:
        return 'Apex Academy Portal'
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Header (Hidden on Print) */}
        <header className="no-print bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 h-16 px-6 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Demo Mode Badge */}
            {isDemo && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-250 animate-pulse">
                Demo Offline Mode
              </span>
            )}
            
            {/* User Profile Info */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {user?.user_metadata?.name || 'Administrator'}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">
                {user?.email}
              </span>
            </div>

            {/* Vertical Separator */}
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-850"></div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-grow p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
