import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { FiCheck, FiX, FiCalendar, FiUserCheck, FiInfo } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

export const AttendanceCalendar = () => {
  const { isDemo } = useAuth()
  
  // Calendar states
  const [studentsList, setStudentsList] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [studentCalendarLogs, setStudentCalendarLogs] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  // Fetch student list for calendar dropdown
  const fetchStudentsList = async () => {
    if (isDemo) {
      const local = JSON.parse(localStorage.getItem('school_demo_students') || '[]')
      setStudentsList(local)
      if (local.length > 0 && !selectedStudentId) {
        setSelectedStudentId(local[0].student_id)
      }
      return
    }

    try {
      const { data, error } = await supabase
        .from('students')
        .select('student_id, student_name')
        .order('student_name')
      if (error) throw error
      setStudentsList(data || [])
      if (data && data.length > 0 && !selectedStudentId) {
        setSelectedStudentId(data[0].student_id)
      }
    } catch (err) {
      console.error('Fetch student list error:', err)
    }
  }

  // Fetch calendar logs for student
  const fetchCalendarLogs = async () => {
    if (!selectedStudentId || !calendarMonth) return
    setCalendarLoading(true)
    const [yearStr, monthStr] = calendarMonth.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr) - 1

    const startDate = `${yearStr}-${monthStr}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

    if (isDemo) {
      const localLogs = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
      const matched = localLogs.filter(log => 
        log.student_id === selectedStudentId && 
        log.date >= startDate && 
        log.date <= endDate
      )
      setStudentCalendarLogs(matched)
      setCalendarLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('date', startDate)
        .lte('date', endDate)
      if (error) throw error
      setStudentCalendarLogs(data || [])
    } catch (err) {
      console.error('Fetch calendar logs error:', err)
    } finally {
      setCalendarLoading(false)
    }
  }

  useEffect(() => {
    fetchStudentsList()
  }, [isDemo])

  useEffect(() => {
    fetchCalendarLogs()
  }, [selectedStudentId, calendarMonth, isDemo])

  // Compute summary stats for the selected student & month
  const getSummaryStats = () => {
    if (!calendarMonth) return { present: 0, absent: 0, rate: 0 }
    const [yearStr, monthStr] = calendarMonth.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    
    let present = 0
    let absent = 0
    
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isFuture = d > new Date()
      
      const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`
      const log = studentCalendarLogs.find(l => l.date === dateStr)
      
      if (log) {
        if (log.status === 'Present') present++
        else absent++
      } else if (!isWeekend && !isFuture) {
        absent++
      }
    }
    
    const totalSchoolDays = present + absent
    const rate = totalSchoolDays > 0 ? Math.round((present / totalSchoolDays) * 100) : 0
    return { present, absent, rate }
  }

  const summaryStats = getSummaryStats()

  // Generate calendar days cells
  const getCalendarCells = () => {
    if (!calendarMonth) return []
    const [yearStr, monthStr] = calendarMonth.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr) - 1
    
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startDayIndex = new Date(year, month, 1).getDay()
    
    const cells = []
    // Padding
    for (let i = 0; i < startDayIndex; i++) {
      cells.push({ type: 'pad' })
    }
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`
      const log = studentCalendarLogs.find(l => l.date === dateStr)
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isFuture = d > new Date()
      
      cells.push({
        type: 'day',
        day,
        dateStr,
        log,
        isWeekend,
        isFuture
      })
    }
    return cells
  }

  const calendarCells = getCalendarCells()

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <FiCalendar className="text-blue-600 w-6 h-6" />
            Attendance Calendar
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Browse student-specific monthly calendar cards. Present marks are recorded automatically by the barcode scanner.
          </p>
        </div>
        
        {/* Retention Policy Banner */}
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/50 rounded-lg p-2.5 max-w-sm text-xs text-amber-800 dark:text-amber-400">
          <FiInfo className="w-5 h-5 shrink-0" />
          <span>Auto-Delete Policy: Attendance history is safely kept for 7 days (1 week) before automated database pruning.</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 space-y-6">
          {/* Student & Month Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            
            {/* Student Dropdown */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-zinc-500 mb-1.5">Select Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-100 font-medium"
              >
                <option value="">-- Choose Student --</option>
                {studentsList.map(s => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.student_name} ({s.student_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-zinc-500 mb-1.5">Select Month</label>
              <input
                type="month"
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(e.target.value)}
                className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-100 font-medium"
              />
            </div>

            {/* Stats Summary Panel */}
            <div className="flex items-center justify-around bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 p-2 rounded-lg gap-2 text-center shadow-inner">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">Present</span>
                <span className="text-md font-black text-emerald-600">{summaryStats.present}</span>
              </div>
              <div className="h-6 w-px bg-zinc-200"></div>
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">Absent</span>
                <span className="text-md font-black text-rose-600">{summaryStats.absent}</span>
              </div>
              <div className="h-6 w-px bg-zinc-200"></div>
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">Rate</span>
                <span className="text-md font-black text-blue-600">{summaryStats.rate}%</span>
              </div>
            </div>

          </div>

          {/* Calendar Grid */}
          {calendarLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-zinc-500 font-semibold">Analyzing attendance calendar...</p>
            </div>
          ) : selectedStudentId ? (
            <div className="space-y-4">
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1">{d}</div>)}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  if (cell.type === 'pad') {
                    return <div key={`pad-${idx}`} className="aspect-square bg-zinc-50/25 dark:bg-zinc-900/5 rounded-lg border border-transparent"></div>
                  }

                  // Determine cell styling
                  let bgClass = 'bg-zinc-50/50 dark:bg-zinc-900/20 text-zinc-700 dark:text-zinc-350 border-zinc-200 dark:border-zinc-800'
                  let statusIcon = null
                  let label = ''

                  if (cell.log) {
                    if (cell.log.status === 'Present') {
                      bgClass = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-250 dark:border-emerald-800/50 shadow-sm shadow-emerald-100/50'
                      statusIcon = <FiCheck className="w-3.5 h-3.5" />
                      const entryStr = cell.log.entry_time ? new Date(cell.log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                      label = `Checked in at ${entryStr}`
                    } else {
                      bgClass = 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-455 border-rose-250 dark:border-rose-800/50'
                      statusIcon = <FiX className="w-3.5 h-3.5" />
                      label = 'Marked Absent'
                    }
                  } else if (cell.isWeekend) {
                    bgClass = 'bg-zinc-100/50 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-855 border-dashed'
                    label = 'Weekend'
                  } else if (cell.isFuture) {
                    bgClass = 'bg-zinc-50/25 dark:bg-zinc-900/10 text-zinc-300 dark:text-zinc-600 border-zinc-150 dark:border-zinc-850 opacity-60'
                    label = 'Upcoming School Day'
                  } else {
                    // Past day with no log
                    bgClass = 'bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-500 border-rose-200/50 dark:border-rose-900/25'
                    statusIcon = <FiX className="w-3.5 h-3.5" />
                    label = 'No Attendance Logged (Absent)'
                  }

                  return (
                    <div
                      key={cell.dateStr}
                      className={`relative aspect-square border rounded-lg p-2 flex flex-col justify-between group transition-all hover:scale-[1.02] ${bgClass}`}
                      title={`${cell.dateStr}: ${label}`}
                    >
                      {/* Day number */}
                      <span className="text-xs font-bold font-mono">{cell.day}</span>
                      
                      {/* Icon or Label */}
                      <div className="flex items-center justify-between mt-auto">
                        {statusIcon}
                        {cell.log && cell.log.entry_time && (
                          <span className="hidden sm:inline-block text-[8px] opacity-75 font-mono">
                            {new Date(cell.log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Tooltip Hover Info */}
                      <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-zinc-900 text-zinc-100 text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 text-center pointer-events-none">
                        <p className="font-extrabold font-mono border-b border-zinc-750 pb-1 mb-1">{cell.dateStr}</p>
                        <p className="font-medium">{label}</p>
                        {cell.log?.exit_time && (
                          <p className="mt-1 text-zinc-400 font-mono">Exit: {new Date(cell.log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900"></div>
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-500">
              <FiUserCheck className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
              <p className="font-bold text-zinc-700 dark:text-zinc-350">No Student Selected</p>
              <p className="text-xs text-zinc-550 mt-1">Please select a student from the dropdown above to view their attendance calendar.</p>
            </div>
          )}

        </div>
      </div>
      
    </div>
  )
}

export default AttendanceCalendar
