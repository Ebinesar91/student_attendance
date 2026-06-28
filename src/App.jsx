import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from 'react-hot-toast'

// Components & Page Imports
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentRegister from './pages/StudentRegister'
import TeacherRegister from './pages/TeacherRegister'
import StaffRegister from './pages/StaffRegister'
import AttendanceScanner from './pages/AttendanceScanner'
import StudentAttendance from './pages/StudentAttendance'
import AttendanceCalendar from './pages/AttendanceCalendar'
import StaffScanner from './pages/StaffScanner'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Admin Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Authenticated Portal Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Portal Subpages */}
              <Route index element={<Dashboard />} />
              <Route path="students" element={<StudentRegister />} />
              <Route path="teachers" element={<TeacherRegister />} />
              <Route path="staff-register" element={<StaffRegister />} />
              <Route path="scan-students" element={<AttendanceScanner />} />
              <Route path="student-attendance" element={<StudentAttendance />} />
              <Route path="attendance-calendar" element={<AttendanceCalendar />} />
              <Route path="scan-staff" element={<StaffScanner />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Fallback Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        
        {/* Global Toast Notification System */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '8px'
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
