import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import {
  FiSearch,
  FiCalendar,
  FiDownload,
  FiFileText,
  FiMail,
  FiFilter
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'

// Mock Offline Data for Reports
const MOCK_STUDENT_ATTENDANCE = [
  { student_id: 'STU84391', name: 'John Doe', course: 'Computer Science', date: '2026-06-28', entry_time: '2026-06-28T08:15:00Z', exit_time: '2026-06-28T15:30:00Z', status: 'Present' },
  { student_id: 'STU92834', name: 'Alex Mercer', course: 'Bio-Technology', date: '2026-06-28', entry_time: '2026-06-28T08:24:00Z', exit_time: null, status: 'Present' },
  { student_id: 'STU84391', name: 'John Doe', course: 'Computer Science', date: '2026-06-27', entry_time: '2026-06-27T08:10:00Z', exit_time: '2026-06-27T15:40:00Z', status: 'Present' },
  { student_id: 'STU92834', name: 'Alex Mercer', course: 'Bio-Technology', date: '2026-06-27', entry_time: null, exit_time: null, status: 'Absent' }
]

const MOCK_TEACHER_ATTENDANCE = [
  { employee_id: 'TCH43281', name: 'Sarah Connor', department: 'History', date: '2026-06-28', entry_time: '2026-06-28T08:20:00Z', exit_time: '2026-06-28T16:00:00Z', status: 'Present' },
  { employee_id: 'TCH58231', name: 'Dr. Bruce Banner', department: 'Physics', date: '2026-06-28', entry_time: '2026-06-28T07:45:00Z', exit_time: null, status: 'Present' }
]

export const Reports = () => {
  const { isDemo, user } = useAuth()
  const [reportType, setReportType] = useState('Student') // 'Student' or 'Teacher'
  const [subReport, setSubReport] = useState('Daily') // 'Daily', 'Monthly', 'Absent', 'Individual', 'Hours'
  
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0])
  const [filterMonth, setFilterMonth] = useState('2026-06')
  const [loading, setLoading] = useState(false)
  const [emailing, setEmailing] = useState(false)
  
  const [studentLogs, setStudentLogs] = useState([])
  const [teacherLogs, setTeacherLogs] = useState([])

  // Fetch report data
  const loadReportData = async () => {
    setLoading(true)
    if (isDemo) {
      // Load from localStorage or mock
      const localSAtt = localStorage.getItem('school_demo_student_attendance')
      const localStudents = JSON.parse(localStorage.getItem('school_demo_students') || '[]')
      const localTAtt = localStorage.getItem('school_demo_staff_attendance')
      const localTeachers = JSON.parse(localStorage.getItem('school_demo_teachers') || '[]')

      let sAtt = localSAtt ? JSON.parse(localSAtt) : []
      let tAtt = localTAtt ? JSON.parse(localTAtt) : []

      // If empty in storage, seed mock
      if (sAtt.length === 0) sAtt = MOCK_STUDENT_ATTENDANCE
      if (tAtt.length === 0) tAtt = MOCK_TEACHER_ATTENDANCE

      // Map details
      const studentReports = sAtt.map(log => {
        const studentInfo = localStudents.find(s => s.student_id === log.student_id) || 
          MOCK_STUDENT_ATTENDANCE.find(s => s.student_id === log.student_id) || {}
        return {
          ...log,
          name: studentInfo.student_name || studentInfo.name || 'Unknown student',
          course: studentInfo.course || 'N/A'
        }
      })

      const teacherReports = tAtt.filter(log => log.employee_type === 'Teacher').map(log => {
        const teacherInfo = localTeachers.find(t => t.employee_id === log.employee_id) ||
          MOCK_TEACHER_ATTENDANCE.find(t => t.employee_id === log.employee_id) || {}
        return {
          ...log,
          name: teacherInfo.teacher_name || teacherInfo.name || 'Unknown teacher',
          department: teacherInfo.department || 'N/A'
        }
      })

      setStudentLogs(studentReports)
      setTeacherLogs(teacherReports)
      setLoading(false)
      return
    }

    // Online DB queries
    try {
      if (reportType === 'Student') {
        const { data, error } = await supabase
          .from('student_attendance')
          .select('*, students(student_name, course)')
          .order('date', { ascending: false })
        if (error) throw error

        const mapped = data.map(log => ({
          id: log.id,
          student_id: log.student_id,
          date: log.date,
          entry_time: log.entry_time,
          exit_time: log.exit_time,
          status: log.status,
          name: log.students?.student_name || 'Deleted student',
          course: log.students?.course || 'N/A'
        }))
        setStudentLogs(mapped)
      } else {
        const { data, error } = await supabase
          .from('staff_attendance')
          .select('*, teachers(teacher_name, department)')
          .eq('employee_type', 'Teacher')
          .order('date', { ascending: false })
        if (error) throw error

        const mapped = data.map(log => ({
          id: log.id,
          employee_id: log.employee_id,
          date: log.date,
          entry_time: log.entry_time,
          exit_time: log.exit_time,
          status: log.status,
          name: log.teachers?.teacher_name || 'Deleted teacher',
          department: log.teachers?.department || 'N/A'
        }))
        setTeacherLogs(mapped)
      }
    } catch (err) {
      console.error('Fetch reports db error:', err)
      toast.error('Failed to query database for report statistics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [reportType, subReport, isDemo])

  // Get active dataset based on filters
  const getFilteredData = () => {
    if (reportType === 'Student') {
      let data = [...studentLogs]
      
      // Daily Filter
      if (subReport === 'Daily') {
        data = data.filter(log => log.date === filterDate)
      }
      
      // Monthly Filter
      if (subReport === 'Monthly') {
        data = data.filter(log => log.date.startsWith(filterMonth))
      }

      // Absent Filter
      if (subReport === 'Absent') {
        data = data.filter(log => log.date === filterDate && log.status === 'Absent')
      }

      // Search matches
      if (search) {
        data = data.filter(log => 
          log.name.toLowerCase().includes(search.toLowerCase()) ||
          log.student_id.toLowerCase().includes(search.toLowerCase()) ||
          log.course.toLowerCase().includes(search.toLowerCase())
        )
      }

      return data
    } else {
      let data = [...teacherLogs]

      // Daily Filter
      if (subReport === 'Daily' || subReport === 'Hours') {
        data = data.filter(log => log.date === filterDate)
      }

      // Monthly Filter
      if (subReport === 'Monthly') {
        data = data.filter(log => log.date.startsWith(filterMonth))
      }

      // Search matching
      if (search) {
        data = data.filter(log => 
          log.name.toLowerCase().includes(search.toLowerCase()) ||
          log.employee_id.toLowerCase().includes(search.toLowerCase()) ||
          log.department.toLowerCase().includes(search.toLowerCase())
        )
      }

      return data
    }
  }

  const activeRecords = getFilteredData()

  // Calculate Working Hours
  const calculateWorkingHours = (entry, exit) => {
    if (!entry) return '0h 0m'
    if (!exit) return 'In Progress'
    const start = new Date(entry)
    const end = new Date(exit)
    const diffMs = end - start
    if (diffMs < 0) return '0h 0m'
    const totalMinutes = Math.floor(diffMs / 1000 / 60)
    const hrs = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    return `${hrs}h ${mins}m`
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (activeRecords.length === 0) {
      toast.error('No records available to export')
      return
    }

    let headers = []
    let rows = []

    if (reportType === 'Student') {
      headers = ['Date', 'Student ID', 'Student Name', 'Course', 'Entry Time', 'Exit Time', 'Status']
      rows = activeRecords.map(log => [
        log.date,
        log.student_id,
        log.name,
        log.course,
        log.entry_time ? new Date(log.entry_time).toLocaleTimeString() : '-',
        log.exit_time ? new Date(log.exit_time).toLocaleTimeString() : '-',
        log.status
      ])
    } else {
      headers = ['Date', 'Employee ID', 'Teacher Name', 'Department', 'Entry Time', 'Exit Time', 'Working Hours', 'Status']
      rows = activeRecords.map(log => [
        log.date,
        log.employee_id,
        log.name,
        log.department,
        log.entry_time ? new Date(log.entry_time).toLocaleTimeString() : '-',
        log.exit_time ? new Date(log.exit_time).toLocaleTimeString() : '-',
        calculateWorkingHours(log.entry_time, log.exit_time),
        log.status
      ])
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `report_${reportType}_${subReport}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Excel-friendly CSV downloaded!')
  }

  // Print PDF Trigger
  const handlePrintPDF = () => {
    window.print()
  }

  // Email Report to Admin
  const handleEmailReport = () => {
    if (activeRecords.length === 0) {
      toast.error('No records available to email')
      return
    }
    
    setEmailing(true)

    // Simulate sending email via API
    setTimeout(() => {
      setEmailing(false)
      toast.success(`Excel and PDF report dispatched to ${user?.email || 'admin@school.com'}!`)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      
      {/* Upper Navigation & Tabs */}
      <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        
        {/* Main tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-lg">
          <button
            onClick={() => {
              setReportType('Student')
              setSubReport('Daily')
            }}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              reportType === 'Student'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Student Reports
          </button>
          <button
            onClick={() => {
              setReportType('Teacher')
              setSubReport('Daily')
            }}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
              reportType === 'Teacher'
                ? 'bg-indigo-650 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Teacher Reports
          </button>
        </div>

        {/* Sub Navigation Segmented Controls */}
        <div className="flex flex-wrap gap-2">
          {reportType === 'Student' ? (
            <>
              {['Daily', 'Monthly', 'Absent', 'History'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSubReport(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    subReport === tab
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-[#09090b] text-zinc-650 dark:text-zinc-450 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  {tab === 'History' ? 'Attendance History' : `${tab} List`}
                </button>
              ))}
            </>
          ) : (
            <>
              {['Daily', 'Monthly', 'Hours'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSubReport(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    subReport === tab
                      ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850'
                      : 'bg-white dark:bg-[#09090b] text-zinc-655 dark:text-zinc-455 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  {tab === 'Hours' ? 'Working Hours' : `${tab} List`}
                </button>
              ))}
            </>
          )}
        </div>

      </div>

      {/* Filter and Export Bar */}
      <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-4 items-center justify-between bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            <FiSearch className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder={reportType === 'Student' ? 'Search students...' : 'Search teachers...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
          />
        </div>

        {/* Date / Month Picker */}
        <div className="flex items-center gap-2">
          <FiFilter className="w-3.5 h-3.5 text-zinc-400" />
          {subReport === 'Monthly' ? (
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs shadow-sm text-zinc-950 dark:text-zinc-100 focus:outline-none flex-grow"
            />
          ) : (
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs shadow-sm text-zinc-950 dark:text-zinc-100 focus:outline-none flex-grow"
            />
          )}
        </div>

        {/* Export Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleExportCSV}
            type="button"
            className="flex items-center gap-1 bg-white hover:bg-zinc-50 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs rounded-lg font-bold text-zinc-700 dark:text-zinc-250 cursor-pointer shadow-sm"
          >
            <FiDownload className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={handlePrintPDF}
            type="button"
            className="flex items-center gap-1 bg-white hover:bg-zinc-50 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs rounded-lg font-bold text-zinc-700 dark:text-zinc-250 cursor-pointer shadow-sm"
          >
            <FiFileText className="w-3.5 h-3.5" />
            PDF / Print
          </button>
          <button
            onClick={handleEmailReport}
            disabled={emailing}
            type="button"
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs rounded-lg font-bold cursor-pointer shadow-sm disabled:opacity-50"
          >
            {emailing ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FiMail className="w-3.5 h-3.5" />
            )}
            Email Admin
          </button>
        </div>

      </div>

      {/* Report Data Table area */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden print-area">
        
        {/* Print Only Header */}
        <div className="hidden print:block text-center p-6 border-b border-zinc-300">
          <h1 className="text-2xl font-black text-blue-900 uppercase">Apex Academy Attendance Report</h1>
          <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">
            Category: {reportType}s • Type: {subReport} list • Date: {subReport === 'Monthly' ? filterMonth : filterDate}
          </p>
        </div>

        <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center no-print">
          <div>
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-50 text-sm">
              {reportType} {subReport} Attendance List
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Showing attendance results filtered by date criteria
            </p>
          </div>
          <span className="text-xs bg-zinc-100 dark:bg-zinc-850 text-zinc-650 dark:text-zinc-350 font-bold px-2 py-0.5 rounded-full">
            {activeRecords.length} Entries found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase text-[9px] font-bold tracking-wider border-b border-zinc-150 dark:border-zinc-850">
              {reportType === 'Student' ? (
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Student ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Course</th>
                  <th className="px-5 py-3.5">Entry Time</th>
                  <th className="px-5 py-3.5">Exit Time</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Employee ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Entry Time</th>
                  <th className="px-5 py-3.5">Exit Time</th>
                  {subReport === 'Hours' && <th className="px-5 py-3.5">Working Hours</th>}
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-650 dark:text-zinc-350">
              {activeRecords.length > 0 ? (
                activeRecords.map((log, index) => {
                  const idField = reportType === 'Student' ? log.student_id : log.employee_id
                  const formattedEntry = log.entry_time
                    ? new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-'
                  const formattedExit = log.exit_time
                    ? new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '-'

                  return (
                    <tr key={log.id || index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                      <td className="px-5 py-3 font-mono">{log.date}</td>
                      <td className="px-5 py-3 font-bold font-mono text-zinc-900 dark:text-zinc-200">{idField}</td>
                      <td className="px-5 py-3 font-bold text-zinc-850 dark:text-zinc-200">{log.name}</td>
                      {reportType === 'Student' ? (
                        <td className="px-5 py-3 truncate max-w-[150px]">{log.course}</td>
                      ) : (
                        <td className="px-5 py-3">{log.department}</td>
                      )}
                      <td className="px-5 py-3">{formattedEntry}</td>
                      <td className="px-5 py-3">{formattedExit}</td>
                      {reportType === 'Teacher' && subReport === 'Hours' && (
                        <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-200">
                          {calculateWorkingHours(log.entry_time, log.exit_time)}
                        </td>
                      )}
                      <td className="px-5 py-3">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                          log.status === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-455'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={reportType === 'Student' ? 8 : subReport === 'Hours' ? 8 : 7}
                    className="px-5 py-12 text-center text-zinc-500 font-medium"
                  >
                    No attendance records found for the selected dates and search queries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  )
}

export default Reports
