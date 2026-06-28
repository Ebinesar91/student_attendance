import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import {
  FiUsers,
  FiUserCheck,
  FiUserMinus,
  FiBell,
  FiActivity,
  FiCalendar,
  FiBriefcase
} from 'react-icons/fi'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'
import { toast } from 'react-hot-toast'

// Fallback Mock Data for demo mode or empty databases
const MOCK_STATS = {
  totalStudents: 156,
  totalTeachers: 24,
  totalStaff: 12,
  presentStudents: 142,
  absentStudents: 14,
  presentTeachers: 22,
  notificationsSent: 142
}

const MOCK_CHART_DATA = [
  { day: 'Mon', Students: 135, Staff: 30 },
  { day: 'Tue', Students: 140, Staff: 32 },
  { day: 'Wed', Students: 138, Staff: 31 },
  { day: 'Thu', Students: 142, Staff: 34 },
  { day: 'Fri', Students: 145, Staff: 33 },
  { day: 'Sat', Students: 95, Staff: 15 },
  { day: 'Sun', Students: 0, Staff: 0 }
]

const MOCK_RECENT_ATTENDANCE = [
  { id: '1', name: 'John Doe', type: 'Student', details: 'Grade 10-A', time: '08:15 AM', status: 'Entry', photo: '' },
  { id: '2', name: 'Sarah Connor', type: 'Teacher', details: 'History Dept', time: '08:20 AM', status: 'Entry', photo: '' },
  { id: '3', name: 'Alex Mercer', type: 'Student', details: 'Grade 11-B', time: '08:24 AM', status: 'Entry', photo: '' },
  { id: '4', name: 'Jane Miller', type: 'Staff', details: 'Admin Office', time: '08:30 AM', status: 'Entry', photo: '' },
  { id: '5', name: 'John Doe', type: 'Student', details: 'Grade 10-A', time: '03:30 PM', status: 'Exit', photo: '' }
]

export const Dashboard = () => {
  const { isDemo } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(MOCK_STATS)
  const [chartData, setChartData] = useState(MOCK_CHART_DATA)
  const [recentAttendance, setRecentAttendance] = useState(MOCK_RECENT_ATTENDANCE)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (isDemo) {
        setStats(MOCK_STATS)
        setChartData(MOCK_CHART_DATA)
        setRecentAttendance(MOCK_RECENT_ATTENDANCE)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const todayStr = new Date().toISOString().split('T')[0]

        // 1. Fetch counts
        const { count: studentsCount } = await supabase.from('students').select('*', { count: 'exact', head: true })
        const { count: teachersCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true })
        const { count: staffCount } = await supabase.from('staff').select('*', { count: 'exact', head: true })

        // 2. Fetch today's student attendance
        const { data: studentAttToday } = await supabase
          .from('student_attendance')
          .select('*')
          .eq('date', todayStr)

        const studentPresent = studentAttToday?.filter(a => a.entry_time)?.length || 0
        const studentsTotal = studentsCount || 0
        const studentAbsent = Math.max(0, studentsTotal - studentPresent)

        // 3. Fetch today's staff attendance
        const { data: staffAttToday } = await supabase
          .from('staff_attendance')
          .select('*')
          .eq('date', todayStr)

        const teachersPresent = staffAttToday?.filter(a => a.employee_type === 'Teacher' && a.entry_time)?.length || 0

        // 4. Fetch notifications sent today
        const { count: notifsCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', `${todayStr}T00:00:00Z`)
          .eq('status', 'Sent')

        // 5. Fetch recent student logs for the list
        const { data: studentLogs } = await supabase
          .from('student_attendance')
          .select('*, students(student_name, course, photo_url)')
          .eq('date', todayStr)
          .order('entry_time', { ascending: false })
          .limit(5)

        // 6. Fetch recent staff logs for the list
        const { data: staffLogs } = await supabase
          .from('staff_attendance')
          .select('*, teachers(teacher_name, department, photo_url), staff(name, department, photo_url)')
          .eq('date', todayStr)
          .order('entry_time', { ascending: false })
          .limit(5)

        // Map recent activity lists
        let combinedLogs = []
        if (studentLogs) {
          studentLogs.forEach(log => {
            const time = log.exit_time 
              ? new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            
            combinedLogs.push({
              id: `stud-${log.id}`,
              name: log.students?.student_name || 'Unknown Student',
              type: 'Student',
              details: log.students?.course || '',
              time,
              status: log.exit_time ? 'Exit' : 'Entry',
              photo: log.students?.photo_url || '',
              timestamp: log.exit_time || log.entry_time
            })
          })
        }

        if (staffLogs) {
          staffLogs.forEach(log => {
            const isTeacher = log.employee_type === 'Teacher'
            const staffName = isTeacher 
              ? log.teachers?.teacher_name 
              : log.staff?.name
            const dept = isTeacher 
              ? log.teachers?.department 
              : log.staff?.department
            const photo = isTeacher 
              ? log.teachers?.photo_url 
              : log.staff?.photo_url

            const time = log.exit_time 
              ? new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(log.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            combinedLogs.push({
              id: `staff-${log.id}`,
              name: staffName || 'Staff Member',
              type: log.employee_type,
              details: dept || 'Support',
              time,
              status: log.exit_time ? 'Exit' : 'Entry',
              photo: photo || '',
              timestamp: log.exit_time || log.entry_time
            })
          })
        }

        // Sort combined list by time desc
        combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

        setStats({
          totalStudents: studentsCount || 0,
          totalTeachers: teachersCount || 0,
          totalStaff: staffCount || 0,
          presentStudents: studentPresent,
          absentStudents: studentAbsent,
          presentTeachers: teachersPresent,
          notificationsSent: notifsCount || 0
        })

        if (combinedLogs.length > 0) {
          setRecentAttendance(combinedLogs.slice(0, 5))
        } else {
          setRecentAttendance(MOCK_RECENT_ATTENDANCE)
        }

        // 7. Get attendance chart data for past week
        // We will build a basic aggregation for last 5 weekdays dynamically
        const dates = []
        for (let i = 4; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          dates.push(d.toISOString().split('T')[0])
        }

        // Fetch counts for these dates
        const charts = await Promise.all(dates.map(async (dt) => {
          const dayName = new Date(dt).toLocaleDateString([], { weekday: 'short' })
          
          const { data: sAtt } = await supabase.from('student_attendance').select('id').eq('date', dt)
          const { data: stAtt } = await supabase.from('staff_attendance').select('id').eq('date', dt)

          return {
            day: dayName,
            Students: sAtt?.length || 0,
            Staff: stAtt?.length || 0
          }
        }))

        // Verify if we have database data, otherwise default to mock
        const hasDbData = charts.some(c => c.Students > 0 || c.Staff > 0)
        if (hasDbData) {
          setChartData(charts)
        } else {
          setChartData(MOCK_CHART_DATA)
        }

      } catch (err) {
        console.error('Error fetching dashboard statistics:', err)
        toast.error('Could not fetch database stats. Showing offline demo data.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [isDemo])

  // Custom stat card builder
  const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }) => (
    <div className={`bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300 hover:shadow-md hover:border-zinc-350 dark:hover:border-zinc-700`}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</span>
        <span className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</span>
      </div>
      <div className={`p-3.5 rounded-xl ${colorClass} text-white`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 h-28 rounded-xl animate-pulse p-5 flex items-center justify-between">
              <div className="space-y-2.5">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 w-24 rounded"></div>
                <div className="h-8 bg-zinc-350 dark:bg-zinc-700 w-16 rounded"></div>
              </div>
              <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-[#0c0c0f] h-[400px] border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"></div>
          <div className="bg-white dark:bg-[#0c0c0f] h-[400px] border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={stats.totalStudents}
          icon={FiUsers}
          colorClass="bg-blue-600 dark:bg-blue-600"
        />
        <StatCard
          title="Total Teachers"
          value={stats.totalTeachers}
          icon={FiBriefcase}
          colorClass="bg-indigo-600 dark:bg-indigo-655"
        />
        <StatCard
          title="Total Staff"
          value={stats.totalStaff}
          icon={FiUsers}
          colorClass="bg-teal-600 dark:bg-teal-650"
        />
        <StatCard
          title="Students Present Today"
          value={stats.presentStudents}
          icon={FiUserCheck}
          colorClass="bg-emerald-600 dark:bg-emerald-600"
        />
        <StatCard
          title="Students Absent Today"
          value={stats.absentStudents}
          icon={FiUserMinus}
          colorClass="bg-rose-600 dark:bg-rose-600"
        />
        <StatCard
          title="Teachers Present Today"
          value={stats.presentTeachers}
          icon={FiUserCheck}
          colorClass="bg-sky-600 dark:bg-sky-600"
        />
        <StatCard
          title="Notifications Sent Today"
          value={stats.notificationsSent}
          icon={FiBell}
          colorClass="bg-amber-600 dark:bg-amber-600"
        />
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border border-transparent rounded-xl p-5 flex items-center justify-between shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider">Attendance Rate</span>
            <span className="text-3xl font-extrabold tracking-tight">
              {stats.totalStudents > 0
                ? Math.round((stats.presentStudents / stats.totalStudents) * 100)
                : 100}
              %
            </span>
          </div>
          <div className="p-3 bg-white/20 rounded-xl text-white">
            <FiActivity className="w-5 h-5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Grid: Visuals & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Charts Container */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Attendance Analytics</h3>
              <p className="text-xs text-zinc-500">Weekly attendance count for students and staff</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium">
              <FiCalendar className="w-4 h-4" />
              <span>Last 7 Days</span>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorStaff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800/40" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    color: '#0f172a'
                  }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Students" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorStudents)" />
                <Area type="monotone" dataKey="Staff" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorStaff)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Attendance Scanner Log */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Recent Attendance</h3>
                <p className="text-xs text-zinc-500">Live checks from scanner portal</p>
              </div>
            </div>

            <div className="space-y-3.5 max-h-[310px] overflow-y-auto pr-1">
              {recentAttendance.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/25 flex items-center justify-center font-bold text-blue-700 dark:text-blue-400 text-sm overflow-hidden border border-blue-50 dark:border-blue-950">
                      {log.photo ? (
                        <img src={log.photo} alt={log.name} className="w-full h-full object-cover" />
                      ) : (
                        log.name.split(' ').map(n => n[0]).join('')
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{log.name}</span>
                      <span className="text-[10px] text-zinc-500 font-semibold">{log.type} • {log.details}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono font-medium text-zinc-500">{log.time}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      log.status === 'Entry'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-450'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Dashboard
