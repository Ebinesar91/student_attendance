import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { useScanner } from '../hooks/useScanner'
import { FiCamera, FiAlertCircle, FiCheckCircle, FiUser, FiInfo, FiMessageCircle } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import { sendSMS } from '../services/notificationService'

export const AttendanceScanner = () => {
  const { isDemo } = useAuth()
  const [scannedId, setScannedId] = useState('')
  const [studentDetails, setStudentDetails] = useState(null)
  const [attendanceMsg, setAttendanceMsg] = useState('')
  const [attendanceType, setAttendanceType] = useState('') // 'Entry' or 'Exit'
  const [manualId, setManualId] = useState('')
  const [processing, setProcessing] = useState(false)

  const lastScanRef = useRef({ code: '', time: 0 })

  // Success handler for barcode scanner
  const handleScanSuccess = async (text) => {
    const now = Date.now()
    if (lastScanRef.current.code === text && now - lastScanRef.current.time < 5000) {
      return // Ignore duplicate scans within 5 seconds
    }
    lastScanRef.current = { code: text, time: now }

    if (processing) return
    setProcessing(true)
    setScannedId(text)
    await processAttendance(text)
    setProcessing(false)
  }

  const {
    videoRef,
    isScanning,
    startScanning,
    stopScanning,
    error: cameraError,
    devices,
    selectedDeviceId,
    setSelectedDeviceId
  } = useScanner(handleScanSuccess)

  // Trigger camera start
  const handleStartCamera = async () => {
    setStudentDetails(null)
    setAttendanceMsg('')
    await startScanning()
  }

  // Handle webcam device switching
  const handleDeviceChange = async (e) => {
    const devId = e.target.value
    setSelectedDeviceId(devId)
    if (isScanning) {
      stopScanning()
      setTimeout(async () => {
        await startScanning()
      }, 150)
    }
  }

  // Process Attendance log logic
  const processAttendance = async (studentIdValue) => {
    const id = studentIdValue.trim()
    if (!id) return

    setAttendanceMsg('')
    setStudentDetails(null)

    // 1. Find Student Details
    let student = null
    if (isDemo) {
      const localStudents = JSON.parse(localStorage.getItem('school_demo_students') || '[]')
      student = localStudents.find((s) => s.student_id === id)
    } else {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('student_id', id)
          .single()
        if (!error) student = data
      } catch (err) {
        console.error('Database query error:', err)
      }
    }

    if (!student) {
      toast.error(`Student ID ${id} not found in system.`)
      return
    }

    setStudentDetails(student)

    // 2. Fetch or Record Today's Attendance
    const todayStr = new Date().toISOString().split('T')[0]
    let attendanceRecord = null

    if (isDemo) {
      const localAtt = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
      attendanceRecord = localAtt.find((a) => a.student_id === id && a.date === todayStr)
    } else {
      try {
        const { data, error } = await supabase
          .from('student_attendance')
          .select('*')
          .eq('student_id', id)
          .eq('date', todayStr)
          .maybeSingle()
        if (!error) attendanceRecord = data
      } catch (err) {
        console.error('Fetch attendance error:', err)
      }
    }

    let type = 'Entry'
    const nowTimestamp = new Date().toISOString()

    if (!attendanceRecord) {
      // Create Entry Record
      type = 'Entry'
      const newRecord = {
        id: Math.random().toString(), // local placeholder
        student_id: id,
        date: todayStr,
        entry_time: nowTimestamp,
        exit_time: null,
        status: 'Present'
      }

      if (isDemo) {
        const localAtt = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
        localAtt.unshift(newRecord)
        localStorage.setItem('school_demo_student_attendance', JSON.stringify(localAtt))
      } else {
        try {
          const { error } = await supabase
            .from('student_attendance')
            .insert([{
              student_id: id,
              date: todayStr,
              entry_time: nowTimestamp,
              status: 'Present'
            }])
          if (error) throw error
        } catch (err) {
          toast.error('Failed to save attendance in database')
          return
        }
      }
      setAttendanceType('Entry')
      setAttendanceMsg('Attendance Recorded Successfully: Entry Recorded')
      toast.success('Entry log recorded successfully')
    } else {
      // Update Exit Record
      type = 'Exit'
      
      if (isDemo) {
        const localAtt = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
        const updated = localAtt.map((a) =>
          a.student_id === id && a.date === todayStr ? { ...a, exit_time: nowTimestamp } : a
        )
        localStorage.setItem('school_demo_student_attendance', JSON.stringify(updated))
      } else {
        try {
          const { error } = await supabase
            .from('student_attendance')
            .update({ exit_time: nowTimestamp })
            .eq('id', attendanceRecord.id)
          if (error) throw error
        } catch (err) {
          toast.error('Failed to update exit record in database')
          return
        }
      }
      setAttendanceType('Exit')
      setAttendanceMsg('Attendance Recorded Successfully: Exit Recorded')
      toast.success('Exit log recorded successfully')
    }

    // 3. Send Notification to Parents (Twilio SMS / Simulation Log)
    const notifMsg = `Apex Academy Alert: Your child ${student.student_name} registered their ${type === 'Entry' ? 'ENTRY' : 'EXIT'} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    
    // Call SMS notification service and check status
    const sentSuccessfully = await sendSMS(student.parent_mobile, notifMsg)

    if (sentSuccessfully) {
      if (isDemo) {
        const localNotifs = JSON.parse(localStorage.getItem('school_demo_notifications') || '[]')
        localNotifs.unshift({
          id: Math.random().toString(),
          student_id: id,
          message: notifMsg,
          sent_at: nowTimestamp,
          status: 'Sent'
        })
        localStorage.setItem('school_demo_notifications', JSON.stringify(localNotifs))
      } else {
        try {
          await supabase.from('notifications').insert([{
            student_id: id,
            message: notifMsg,
            status: 'Sent'
          }])
        } catch (err) {
          console.error('Insert notification error:', err)
        }
      }
    }
  }

  // Handle Manual submit
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualId) return
    setProcessing(true)
    await processAttendance(manualId)
    setManualId('')
    setProcessing(false)
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side: Camera Preview */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 pb-2 border-b border-zinc-150 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <FiCamera className="text-blue-600" />
              Live Scanner Portal
            </h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              isScanning 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 animate-pulse'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'
            }`}>
              {isScanning ? 'Scanner Active' : 'Scanner Idle'}
            </span>
          </div>

          {/* Scanner Viewport */}
          <div className="w-full aspect-[4/3] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-950 flex items-center justify-center">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {!isScanning && (
              <div className="text-center text-zinc-550 p-6 flex flex-col items-center gap-3 absolute inset-0 flex justify-center items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <FiCamera className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-300">Camera Feed Off</p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                      Start the camera to begin scanning student Code 128 barcodes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Target overlay indicator */}
            {isScanning && (
              <div className="absolute inset-0 border-[35px] border-black/40 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-20 border-2 border-dashed border-blue-500 relative">
                  <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-rose-500 animate-bounce"></div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full mt-4 flex flex-col sm:flex-row gap-3">
            {isScanning ? (
              <button
                onClick={stopScanning}
                type="button"
                className="flex-grow bg-zinc-850 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors cursor-pointer text-center text-sm"
              >
                Stop Camera
              </button>
            ) : (
              <button
                onClick={handleStartCamera}
                type="button"
                className="flex-grow bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow transition-colors cursor-pointer text-center text-sm"
              >
                Start Camera
              </button>
            )}
          </div>

          {/* Camera Selection Dropdown */}
          {devices && devices.length > 1 && (
            <div className="w-full mt-3 flex flex-col">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">
                Camera Source
              </label>
              <select
                value={selectedDeviceId || ''}
                onChange={handleDeviceChange}
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-100 font-medium"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Webcam ${device.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cameraError && (
            <div className="w-full mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-800/30 text-rose-800 dark:text-rose-400 text-xs rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Manual Entry Fallback */}
          <form onSubmit={handleManualSubmit} className="w-full mt-6 pt-4 border-t border-zinc-150 dark:border-zinc-800 flex gap-2 items-end">
            <div className="flex-grow flex flex-col">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">
                Manual ID Entry (for Testing)
              </label>
              <input
                type="text"
                placeholder="e.g. STU84391"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={processing}
              className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold px-4 py-2 text-xs rounded-lg transition-all"
            >
              Verify ID
            </button>
          </form>

        </div>

        {/* Right Side: Log Feedback & Student Card */}
        <div className="space-y-6">
          
          {/* Status Message */}
          {attendanceMsg && (
            <div className={`p-4 rounded-xl border flex gap-3 items-center animate-scale-up ${
              attendanceType === 'Entry'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-800/30 text-amber-800 dark:text-amber-400'
            }`}>
              <FiCheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-extrabold text-sm">Attendance Recorded Successfully</p>
                <p className="text-xs opacity-90">{attendanceType === 'Entry' ? 'Entry Logged' : 'Exit Logged'}. parent alerted.</p>
              </div>
            </div>
          )}

          {/* Student Details Card */}
          {studentDetails ? (
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-md flex flex-col items-center text-center space-y-4 animate-scale-up">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100 dark:border-zinc-850 w-full">
                Active Scanner Result
              </h4>
              
              {/* Photo */}
              <div className="w-28 h-28 rounded-full border-4 border-blue-100 dark:border-blue-900 overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center shadow-inner">
                {studentDetails.photo_url ? (
                  <img src={studentDetails.photo_url} alt={studentDetails.student_name} className="w-full h-full object-cover" />
                ) : (
                  <FiUser className="w-14 h-14 text-zinc-400" />
                )}
              </div>

              {/* Basic Meta */}
              <div>
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">{studentDetails.student_name}</h3>
                <span className="inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs px-3 py-0.5 rounded-full mt-1.5 border border-blue-100 dark:border-blue-900/50">
                  {studentDetails.student_id}
                </span>
              </div>

              {/* Secondary stats */}
              <div className="w-full grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl text-left border border-zinc-150 dark:border-zinc-850">
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Course</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate block">{studentDetails.course}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Parent Mobile</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">{studentDetails.parent_mobile}</span>
                </div>
              </div>

              {localStorage.getItem('school_setting_active_channel') === 'whatsapp' && (
                <button
                  onClick={() => {
                    const typeText = attendanceType === 'Entry' ? 'ENTRY' : 'EXIT'
                    const messageText = `Apex Academy Alert: Your child ${studentDetails.student_name} registered their ${typeText} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                    const cleanMobile = studentDetails.parent_mobile.replace(/\s+/g, '')
                    const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(messageText)}`
                    window.open(url, '_blank')
                  }}
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FiMessageCircle className="w-4 h-4" />
                  Send WhatsApp Alert
                </button>
              )}

              <div className="w-full flex items-center justify-center gap-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/25 rounded-lg text-[10px] text-blue-650 dark:text-blue-400">
                <FiInfo className="w-4 h-4 shrink-0" />
                <span>Parent notifications are sent securely via Apex Notification Engine.</span>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center h-[350px]">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-3">
                <FiInfo className="w-6 h-6" />
              </div>
              <p className="font-bold text-zinc-800 dark:text-zinc-350">Awaiting Scan</p>
              <p className="text-xs text-zinc-500 max-w-xs mt-1">
                Activate the camera on the left and align a student Code 128 barcode. The student card and attendance confirmation will populate here automatically.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}

export default AttendanceScanner
