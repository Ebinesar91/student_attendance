import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { useScanner } from '../hooks/useScanner'
import { FiCamera, FiAlertCircle, FiCheckCircle, FiUser, FiInfo } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

export const StaffScanner = () => {
  const { isDemo } = useAuth()
  const [scannedId, setScannedId] = useState('')
  const [staffDetails, setStaffDetails] = useState(null)
  const [staffType, setStaffType] = useState('') // 'Teacher' or 'Staff'
  const [attendanceMsg, setAttendanceMsg] = useState('')
  const [attendanceType, setAttendanceType] = useState('') // 'Entry' or 'Exit'
  const [manualId, setManualId] = useState('')
  const [processing, setProcessing] = useState(false)

  const lastScanRef = useRef({ code: '', time: 0 })

  // Success handler for scanner
  const handleScanSuccess = async (text) => {
    const now = Date.now()
    if (lastScanRef.current.code === text && now - lastScanRef.current.time < 5000) {
      return // Ignore duplicate scans within 5 seconds
    }
    lastScanRef.current = { code: text, time: now }

    if (processing) return
    setProcessing(true)
    setScannedId(text)
    await processStaffAttendance(text)
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
    setStaffDetails(null)
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

  // Attendance process log
  const processStaffAttendance = async (employeeIdValue) => {
    const id = employeeIdValue.trim()
    if (!id) return

    setAttendanceMsg('')
    setStaffDetails(null)

    let type = ''
    if (id.startsWith('TCH')) {
      type = 'Teacher'
    } else if (id.startsWith('STF')) {
      type = 'Staff'
    } else {
      toast.error('Invalid Barcode Format. Must start with TCH or STF.')
      return
    }

    setStaffType(type)

    // 1. Find Employee Details in teachers or staff table
    let employee = null
    if (isDemo) {
      if (type === 'Teacher') {
        const localTeachers = JSON.parse(localStorage.getItem('school_demo_teachers') || '[]')
        employee = localTeachers.find((t) => t.employee_id === id)
      } else {
        const localStaff = JSON.parse(localStorage.getItem('school_demo_staff') || '[]')
        employee = localStaff.find((s) => s.employee_id === id)
      }
    } else {
      try {
        if (type === 'Teacher') {
          const { data, error } = await supabase
            .from('teachers')
            .select('*')
            .eq('employee_id', id)
            .single()
          if (!error) employee = data
        } else {
          const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('employee_id', id)
            .single()
          if (!error) employee = data
        }
      } catch (err) {
        console.error('Database query error:', err)
      }
    }

    if (!employee) {
      toast.error(`Employee ID ${id} not found in the ${type} database.`)
      return
    }

    setStaffDetails(employee)

    // 2. Fetch or Record Today's Staff Attendance
    const todayStr = new Date().toISOString().split('T')[0]
    let attendanceRecord = null

    if (isDemo) {
      const localAtt = JSON.parse(localStorage.getItem('school_demo_staff_attendance') || '[]')
      attendanceRecord = localAtt.find((a) => a.employee_id === id && a.date === todayStr)
    } else {
      try {
        const { data, error } = await supabase
          .from('staff_attendance')
          .select('*')
          .eq('employee_id', id)
          .eq('date', todayStr)
          .maybeSingle()
        if (!error) attendanceRecord = data
      } catch (err) {
        console.error('Fetch staff attendance error:', err)
      }
    }

    const nowTimestamp = new Date().toISOString()

    if (!attendanceRecord) {
      // Create Entry Record
      const newRecord = {
        id: Math.random().toString(),
        employee_id: id,
        employee_type: type,
        date: todayStr,
        entry_time: nowTimestamp,
        exit_time: null,
        status: 'Present'
      }

      if (isDemo) {
        const localAtt = JSON.parse(localStorage.getItem('school_demo_staff_attendance') || '[]')
        localAtt.unshift(newRecord)
        localStorage.setItem('school_demo_staff_attendance', JSON.stringify(localAtt))
      } else {
        try {
          const { error } = await supabase
            .from('staff_attendance')
            .insert([{
              employee_id: id,
              employee_type: type,
              date: todayStr,
              entry_time: nowTimestamp,
              status: 'Present'
            }])
          if (error) throw error
        } catch (err) {
          toast.error('Failed to log staff attendance in database')
          return
        }
      }
      setAttendanceType('Entry')
      setAttendanceMsg('Attendance Recorded Successfully: Entry Recorded')
      toast.success('Staff entry logged')
    } else {
      // Update Exit Record
      if (isDemo) {
        const localAtt = JSON.parse(localStorage.getItem('school_demo_staff_attendance') || '[]')
        const updated = localAtt.map((a) =>
          a.employee_id === id && a.date === todayStr ? { ...a, exit_time: nowTimestamp } : a
        )
        localStorage.setItem('school_demo_staff_attendance', JSON.stringify(updated))
      } else {
        try {
          const { error } = await supabase
            .from('staff_attendance')
            .update({ exit_time: nowTimestamp })
            .eq('id', attendanceRecord.id)
          if (error) throw error
        } catch (err) {
          toast.error('Failed to log staff exit in database')
          return
        }
      }
      setAttendanceType('Exit')
      setAttendanceMsg('Attendance Recorded Successfully: Exit Recorded')
      toast.success('Staff exit logged')
    }
  }

  // Handle Manual submit
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualId) return
    setProcessing(true)
    await processStaffAttendance(manualId)
    setManualId('')
    setProcessing(false)
  }

  // Clean up
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Camera Scanner */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 pb-2 border-b border-zinc-150 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <FiCamera className="text-indigo-650" />
              Staff & Teacher Scanner Portal
            </h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              isScanning 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 animate-pulse'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'
            }`}>
              {isScanning ? 'Scanner Active' : 'Scanner Idle'}
            </span>
          </div>

          <div className="w-full aspect-[4/3] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-955 flex items-center justify-center">
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
                      Start the camera to begin scanning Teacher (TCH) or Support Staff (STF) Code 128 barcodes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 border-[35px] border-black/40 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-20 border-2 border-dashed border-indigo-500 relative">
                  <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>
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
                className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg shadow transition-colors cursor-pointer text-center text-sm"
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
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-950 dark:text-zinc-100 font-medium"
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
            <div className="w-full mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-800/30 text-rose-800 dark:text-rose-450 text-xs rounded-lg flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4" />
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
                placeholder="e.g. TCH43281 or STF28439"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-950 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={processing}
              className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-850 dark:text-zinc-200 font-bold px-4 py-2 text-xs rounded-lg transition-all"
            >
              Verify ID
            </button>
          </form>

        </div>

        {/* Right: Employee Card Display */}
        <div className="space-y-6">
          
          {/* Status Message */}
          {attendanceMsg && (
            <div className={`p-4 rounded-xl border flex gap-3 items-center animate-scale-up ${
              attendanceType === 'Entry'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-450'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-800/30 text-amber-800 dark:text-amber-400'
            }`}>
              <FiCheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-extrabold text-sm">Attendance Recorded Successfully</p>
                <p className="text-xs opacity-90">{attendanceType === 'Entry' ? 'Entry Logged' : 'Exit Logged'}.</p>
              </div>
            </div>
          )}

          {/* Employee Details Card */}
          {staffDetails ? (
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-md flex flex-col items-center text-center space-y-4 animate-scale-up">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100 dark:border-zinc-850 w-full">
                {staffType} Verification
              </h4>
              
              {/* Photo */}
              <div className="w-28 h-28 rounded-full border-4 border-indigo-100 dark:border-indigo-900 overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center shadow-inner">
                {staffDetails.photo_url ? (
                  <img src={staffDetails.photo_url} alt={staffDetails.teacher_name || staffDetails.name} className="w-full h-full object-cover" />
                ) : (
                  <FiUser className="w-14 h-14 text-zinc-400" />
                )}
              </div>

              {/* Basic Meta */}
              <div>
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
                  {staffDetails.teacher_name || staffDetails.name}
                </h3>
                <span className="inline-block bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 font-mono font-bold text-xs px-3 py-0.5 rounded-full mt-1.5 border border-indigo-100 dark:border-indigo-900/50">
                  {staffDetails.employee_id}
                </span>
              </div>

              {/* Details grid */}
              <div className="w-full grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl text-left border border-zinc-150 dark:border-zinc-850 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Department</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate">{staffDetails.department}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Mobile Number</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{staffDetails.mobile}</span>
                </div>
              </div>

              <div className="w-full flex items-center justify-center gap-2 p-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/25 rounded-lg text-[10px] text-indigo-700 dark:text-indigo-400">
                <FiInfo className="w-4 h-4 shrink-0" />
                <span>Parent notifications are NOT triggered for staff barcode scans.</span>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center h-[350px]">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-3">
                <FiInfo className="w-6 h-6" />
              </div>
              <p className="font-bold text-zinc-800 dark:text-zinc-350">Awaiting Scanner Input</p>
              <p className="text-xs text-zinc-500 max-w-xs mt-1">
                Activate the camera on the left and align a Teacher (TCH) or general Staff (STF) barcode. Verify employee details and record entry/exit events.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}

export default StaffScanner
