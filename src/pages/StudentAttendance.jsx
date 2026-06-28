import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { FiCheck, FiX, FiCalendar, FiPlus, FiMail, FiUserCheck, FiBell, FiTrash2, FiPrinter } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import { sendSMS } from '../services/notificationService'

export const StudentAttendance = () => {
  const { isDemo } = useAuth()
  const [logs, setLogs] = useState([])
  const [notifications, setNotifications] = useState([])
  const [activeTab, setActiveTab] = useState('attendance') // 'attendance' or 'notifications'
  const [loading, setLoading] = useState(true)
  
  // Manual Attendance Dialog State
  const [showManualForm, setShowManualForm] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [status, setStatus] = useState('Present')

  const fetchTodayLogs = async () => {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]

    if (isDemo) {
      // Fetch mock local logs
      const localLogs = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
      const localStudents = JSON.parse(localStorage.getItem('school_demo_students') || '[]')
      const localNotifs = JSON.parse(localStorage.getItem('school_demo_notifications') || '[]')

      const todaySLogs = localLogs.filter(log => log.date === todayStr).map(log => {
        const stud = localStudents.find(s => s.student_id === log.student_id) || {}
        return {
          ...log,
          studentName: stud.student_name || 'Demo Student',
          course: stud.course || 'Computer Science'
        }
      })

      // Deduplicate notifications
      const uniqueDemoNotifs = []
      const demoSeen = new Set()
      const rawDemoNotifs = localNotifs.filter(n => n.sent_at.startsWith(todayStr))
      for (const item of rawDemoNotifs) {
        const key = `${item.student_id}-${item.message}`
        if (!demoSeen.has(key)) {
          demoSeen.add(key)
          uniqueDemoNotifs.push(item)
        }
      }

      setLogs(todaySLogs)
      setNotifications(uniqueDemoNotifs)
      setLoading(false)
      return
    }

    try {
      // Online Fetch
      const { data: attData, error: attErr } = await supabase
        .from('student_attendance')
        .select('*, students(student_name, course)')
        .eq('date', todayStr)
        .order('entry_time', { ascending: false })

      if (attErr) throw attErr

      const mappedLogs = attData.map(log => ({
        id: log.id,
        student_id: log.student_id,
        date: log.date,
        entry_time: log.entry_time,
        exit_time: log.exit_time,
        status: log.status,
        studentName: log.students?.student_name || 'Deleted Student',
        course: log.students?.course || 'N/A'
      }))

      const { data: notifData, error: notifErr } = await supabase
        .from('notifications')
        .select('*, students(student_name)')
        .gte('sent_at', `${todayStr}T00:00:00Z`)
        .order('sent_at', { ascending: false })

      if (notifErr) throw notifErr

      // Deduplicate database notifications
      const uniqueNotifs = []
      const seen = new Set()
      const rawNotifs = notifData || []
      for (const item of rawNotifs) {
        const key = `${item.student_id}-${item.message}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueNotifs.push(item)
        }
      }

      setLogs(mappedLogs)
      setNotifications(uniqueNotifs)
    } catch (err) {
      console.error('Fetch attendance logs failed:', err)
      toast.error('Failed to load attendance logs.')
    } finally {
      setLoading(false)
    }
  }

  // Delete individual notification log entry
  const handleDeleteNotification = async (notifId) => {
    if (!window.confirm('Are you sure you want to delete this notification log entry?')) {
      return
    }

    setLoading(true)

    if (isDemo) {
      const localNotifs = JSON.parse(localStorage.getItem('school_demo_notifications') || '[]')
      const updated = localNotifs.filter(n => n.id !== notifId)
      localStorage.setItem('school_demo_notifications', JSON.stringify(updated))
      setNotifications(notifications.filter(n => n.id !== notifId))
      toast.success('Notification log entry deleted locally!')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notifId)
      if (error) throw error
      toast.success('Notification log entry deleted!')
      fetchTodayLogs()
    } catch (err) {
      console.error('Delete notification failed:', err)
      toast.error('Failed to delete notification log entry.')
      setLoading(false)
    }
  }

  // Clear all today's notification logs
  const handleClearAllNotifications = async () => {
    if (!window.confirm("Are you sure you want to delete ALL parent alert logs for today? This cannot be undone!")) {
      return
    }

    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]

    if (isDemo) {
      const localNotifs = JSON.parse(localStorage.getItem('school_demo_notifications') || '[]')
      const updated = localNotifs.filter(n => !n.sent_at.startsWith(todayStr))
      localStorage.setItem('school_demo_notifications', JSON.stringify(updated))
      setNotifications([])
      toast.success("Today's notification logs cleared locally!")
      setLoading(false)
      return
    }

    try {
      const startOfDay = `${todayStr}T00:00:00Z`
      const endOfDay = `${todayStr}T23:59:59Z`
      const { error } = await supabase
        .from('notifications')
        .delete()
        .gte('sent_at', startOfDay)
        .lte('sent_at', endOfDay)

      if (error) throw error
      toast.success("Today's notification logs cleared from database!")
      setNotifications([])
    } catch (err) {
      console.error('Clear notifications failed:', err)
      toast.error('Failed to clear notification logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodayLogs()
  }, [isDemo])

  // Save manual attendance log
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!studentId) return

    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const nowTimestamp = new Date().toISOString()

    // 1. Verify student exists
    let studentExists = false
    let studentNameVal = 'Manual Student'
    let parentMobileVal = ''
    
    if (isDemo) {
      const localStudents = JSON.parse(localStorage.getItem('school_demo_students') || '[]')
      const match = localStudents.find(s => s.student_id === studentId)
      if (match) {
        studentExists = true
        studentNameVal = match.student_name
        parentMobileVal = match.parent_mobile || ''
      }
    } else {
      const { data, error } = await supabase
        .from('students')
        .select('student_name, parent_mobile')
        .eq('student_id', studentId)
        .maybeSingle()
      if (data && !error) {
        studentExists = true
        studentNameVal = data.student_name
        parentMobileVal = data.parent_mobile || ''
      }
    }

    if (!studentExists) {
      toast.error(`Student ID ${studentId} is not registered.`)
      setLoading(false)
      return
    }

    const notifMsg = `Apex Alert: ${studentNameVal} was manually marked ${status} today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`

    // Send SMS notification
    await sendSMS(parentMobileVal, notifMsg)

    // 2. Insert attendance
    if (isDemo) {
      const localLogs = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
      const exists = localLogs.find(l => l.student_id === studentId && l.date === todayStr)

      if (exists) {
        toast.error('Attendance already logged for this student today!')
        setLoading(false)
        return
      }

      localLogs.unshift({
        id: Math.random().toString(),
        student_id: studentId,
        date: todayStr,
        entry_time: nowTimestamp,
        exit_time: null,
        status: status
      })
      localStorage.setItem('school_demo_student_attendance', JSON.stringify(localLogs))
      
      // Trigger notification log
      const localNotifs = JSON.parse(localStorage.getItem('school_demo_notifications') || '[]')
      localNotifs.unshift({
        id: Math.random().toString(),
        student_id: studentId,
        message: notifMsg,
        sent_at: nowTimestamp,
        status: 'Sent'
      })
      localStorage.setItem('school_demo_notifications', JSON.stringify(localNotifs))

      toast.success('Manual attendance saved!')
    } else {
      try {
        const { error } = await supabase
          .from('student_attendance')
          .insert([{
            student_id: studentId,
            date: todayStr,
            entry_time: nowTimestamp,
            status: status
          }])

        if (error) throw error

        // Notification insertion
        await supabase.from('notifications').insert([{
          student_id: studentId,
          message: notifMsg,
          status: 'Sent'
        }])

        toast.success('Manual attendance saved!')
      } catch (err) {
        console.error(err)
        toast.error('Database log creation failed.')
      }
    }

    setStudentId('')
    setShowManualForm(false)
    fetchTodayLogs()
  }

  // Delete log entry
  const handleDeleteLog = async (id, name) => {
    if (!window.confirm(`Delete today's log entry for ${name}?`)) return
    
    setLoading(true)
    if (isDemo) {
      const localLogs = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
      const updated = localLogs.filter(l => l.id !== id)
      localStorage.setItem('school_demo_student_attendance', JSON.stringify(updated))
      toast.success('Log deleted locally')
      fetchTodayLogs()
      return
    }

    try {
      const { error } = await supabase
        .from('student_attendance')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Attendance record deleted')
      fetchTodayLogs()
    } catch (err) {
      console.error(err)
      toast.error('Could not delete attendance record.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Sub Header & Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        
        {/* Toggle tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-355'
            }`}
          >
            <FiUserCheck className="w-4 h-4" />
            Today's Attendance
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-355'
            }`}
          >
            <FiBell className="w-4 h-4" />
            Parent Alerts Sent
          </button>
        </div>

        {/* Action Button */}
        {activeTab === 'attendance' && (
          <button
            onClick={() => setShowManualForm(true)}
            type="button"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <FiPlus className="w-4 h-4" />
            Add Manual Attendance
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        
        {activeTab === 'attendance' ? (
          <>
            <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Active Students Checklist</h3>
                <p className="text-xs text-zinc-555 mt-0.5">Students who checked in or out today</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
                <FiCalendar className="w-4 h-4" />
                <span>Today</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-650 dark:text-zinc-350 border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-150 dark:border-zinc-850">
                  <tr>
                    <th className="px-5 py-3">Student Name</th>
                    <th className="px-5 py-3">Student ID</th>
                    <th className="px-5 py-3">Course</th>
                    <th className="px-5 py-3">Check-In</th>
                    <th className="px-5 py-3">Check-Out</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="px-5 py-3 font-bold text-zinc-900 dark:text-zinc-200">{log.studentName}</td>
                        <td className="px-5 py-3 font-mono font-bold text-zinc-500">{log.student_id}</td>
                        <td className="px-5 py-3">{log.course}</td>
                        <td className="px-5 py-3 font-mono font-medium text-emerald-600 dark:text-emerald-450">
                          {log.entry_time ? new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-5 py-3 font-mono font-medium text-amber-600 dark:text-amber-450">
                          {log.exit_time ? new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 uppercase">
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleDeleteLog(log.id, log.studentName)}
                            type="button"
                            className="p-1.5 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-colors"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-5 py-12 text-center text-zinc-500 font-medium">
                        No students have checked in today. Open the scanner page to scan barcodes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/10 no-print">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Sent Notification Logs</h3>
                <p className="text-xs text-zinc-550 mt-0.5">Alerts dispatched to parents following scans today</p>
              </div>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={() => window.print()}
                      type="button"
                      className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <FiPrinter className="w-3.5 h-3.5" />
                      Print / PDF
                    </button>
                    <button
                      onClick={handleClearAllNotifications}
                      type="button"
                      className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 font-bold py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                      Clear Logs
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Print-Only Professional Report Header */}
            <div className="hidden print:block p-6 border-b-2 border-zinc-900 mb-6 bg-white text-black">
              <h1 className="text-2xl font-black tracking-tight">{localStorage.getItem('school_setting_name') || 'Apex Academy'}</h1>
              <h2 className="text-xs font-bold text-zinc-700 mt-1 uppercase tracking-widest">Dispatched Parent Alerts Sent Log Report</h2>
              <div className="flex justify-between items-center mt-4 text-xs text-zinc-500 font-medium">
                <span>Date: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>Total Dispatched Alerts: {notifications.length}</span>
              </div>
            </div>

            <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} className="flex gap-3 items-start p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-755 dark:text-zinc-350 relative group print:bg-white print:border-zinc-300 print:text-black print:shadow-none">
                    <FiMail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0 print:text-zinc-750" />
                    <div className="flex-grow pr-6 print:pr-0">
                      <p className="font-medium text-zinc-850 dark:text-zinc-200 print:text-black">{notif.message}</p>
                      <span className="text-[10px] text-zinc-555 mt-1 block print:text-zinc-600">
                        Dispatched: {new Date(notif.sent_at).toLocaleTimeString()} • Status: <span className="text-emerald-600 dark:text-emerald-400 font-bold print:text-black">{notif.status}</span>
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteNotification(notif.id)}
                      type="button"
                      className="absolute top-3 right-3 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-colors p-1 rounded-md cursor-pointer no-print"
                      title="Delete alert log entry"
                    >
                      <FiX className="w-4.5 h-4.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-zinc-500 font-medium">
                  No alerts have been sent today.
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Manual Entry Dialog Overlay */}
      {showManualForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl relative max-w-sm w-full animate-scale-up">
            <button
              onClick={() => setShowManualForm(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
            >
              <FiX className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 mb-4 uppercase tracking-wider">
              Add Manual Attendance Log
            </h3>
            
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-zinc-500 mb-1">Student ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STU84391"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-855 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-955 dark:text-zinc-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-zinc-500 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-855 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-955 dark:text-zinc-100"
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm shadow transition-colors cursor-pointer"
              >
                Log Entry
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default StudentAttendance
