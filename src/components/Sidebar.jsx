import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  FiGrid,
  FiUserPlus,
  FiUsers,
  FiBriefcase,
  FiCamera,
  FiCalendar,
  FiBookOpen,
  FiPieChart,
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX
} from 'react-icons/fi'

export const Sidebar = () => {
  const location = useLocation()
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: FiGrid },
    { name: 'Student Registration', path: '/students', icon: FiUserPlus },
    { name: 'Teacher Registration', path: '/teachers', icon: FiUsers },
    { name: 'Staff Registration', path: '/staff-register', icon: FiBriefcase },
    { name: 'Attendance Scanner', path: '/scan-students', icon: FiCamera },
    { name: 'Student Attendance', path: '/student-attendance', icon: FiBookOpen },
    { name: 'Attendance Calendar', path: '/attendance-calendar', icon: FiCalendar },
    { name: 'Staff Attendance', path: '/scan-staff', icon: FiBookOpen },
    { name: 'Reports', path: '/reports', icon: FiPieChart },
    { name: 'Settings', path: '/settings', icon: FiSettings },
  ]

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logout()
    }
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 sticky top-0 z-40 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">A</div>
          <span className="font-bold text-base tracking-tight">Apex Attend</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
        >
          {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm no-print"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Nav */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-white dark:bg-[#0c0c0f] border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between z-50 transform lg:transform-none transition-transform duration-300 ease-in-out no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-grow overflow-y-auto">
          {/* Logo / Brand Header */}
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-850 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/20">
              A
            </div>
            <div>
              <h1 className="font-bold text-zinc-900 dark:text-zinc-50 leading-tight">Apex Academy</h1>
              <span className="text-xs text-zinc-500 font-semibold tracking-wider uppercase">Attendance System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex-grow flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-450 border-l-4 border-blue-600 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-600 dark:text-blue-450' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* User Footer / Logout */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-850">
          <button
            onClick={handleLogout}
            type="button"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-150 cursor-pointer"
          >
            <FiLogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
