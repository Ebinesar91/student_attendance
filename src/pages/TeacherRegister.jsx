import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { BarcodeGenerator } from '../components/BarcodeGenerator'
import { IDCard } from '../components/IDCard'
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiUpload,
  FiPrinter,
  FiUser
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'

// Mock Initial Teachers for Offline/Demo Mode
const MOCK_TEACHERS = [
  {
    employee_id: 'TCH43281',
    teacher_name: 'Sarah Connor',
    department: 'History',
    mobile: '9876543220',
    email: 'sarah.connor@example.com',
    address: '45 Chronos St, Retro City',
    photo_url: '',
    barcode: 'TCH43281'
  },
  {
    employee_id: 'TCH58231',
    teacher_name: 'Dr. Bruce Banner',
    department: 'Physics',
    mobile: '9876543221',
    email: 'bruce.banner@example.com',
    address: 'Gamma Lab Suite 5, Science City',
    photo_url: '',
    barcode: 'TCH58231'
  }
]

export const TeacherRegister = () => {
  const { isDemo } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Selection / Editing State
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // ID Card Modal
  const [showCardModal, setShowCardModal] = useState(false)
  const [cardData, setCardData] = useState(null)

  // Form Fields
  const [employeeId, setEmployeeId] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [barcodeGenerated, setBarcodeGenerated] = useState(false)

  // Fetch Teachers list
  const fetchTeachers = async () => {
    setLoading(true)
    if (isDemo) {
      const localData = localStorage.getItem('school_demo_teachers')
      if (localData) {
        setTeachers(JSON.parse(localData))
      } else {
        setTeachers(MOCK_TEACHERS)
        localStorage.setItem('school_demo_teachers', JSON.stringify(MOCK_TEACHERS))
      }
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTeachers(data || [])
    } catch (err) {
      console.error('Fetch teachers error:', err)
      toast.error('Failed to load teachers from database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeachers()
  }, [isDemo])

  // Auto Generate Teacher ID
  const generateEmployeeId = () => {
    const randomDigits = Math.floor(10000 + Math.random() * 90000)
    const generated = `TCH${randomDigits}`
    setEmployeeId(generated)
    setBarcodeGenerated(false)
    toast.success(`ID Generated: ${generated}`)
  }

  // Handle Photo selection
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setPhotoFile(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Upload photo to Supabase storage
  const uploadPhotoToSupabase = async (file, id) => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}_${Date.now()}.${fileExt}`
      const filePath = `photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('teacher-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('teacher-photos')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('Photo upload failed:', err)
      toast.error('Storage bucket error. Photo url fallback applied.')
      return ''
    } finally {
      setUploading(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setEmployeeId('')
    setTeacherName('')
    setDepartment('')
    setMobile('')
    setEmail('')
    setAddress('')
    setPhotoFile(null)
    setPhotoUrl('')
    setBarcodeGenerated(false)
    setIsEditing(false)
  }

  // Edit/Select Teacher
  const handleSelectTeacher = (tch) => {
    setSelectedTeacher(tch)
    setEmployeeId(tch.employee_id)
    setTeacherName(tch.teacher_name)
    setDepartment(tch.department)
    setMobile(tch.mobile)
    setEmail(tch.email)
    setAddress(tch.address)
    setPhotoUrl(tch.photo_url || '')
    setBarcodeGenerated(!!tch.barcode)
    setIsEditing(true)
    setShowForm(true)
  }

  // Save / Update Teacher
  const handleSave = async (e) => {
    e.preventDefault()
    if (!employeeId) {
      toast.error('Please generate or enter a Teacher ID')
      return
    }

    setLoading(true)
    let finalPhotoUrl = photoUrl

    if (!isDemo && photoFile) {
      const uploadedUrl = await uploadPhotoToSupabase(photoFile, employeeId)
      if (uploadedUrl) finalPhotoUrl = uploadedUrl
    }

    const payload = {
      employee_id: employeeId,
      teacher_name: teacherName,
      department,
      mobile,
      email,
      address,
      photo_url: finalPhotoUrl,
      barcode: employeeId
    }

    if (isDemo) {
      let updatedTeachers = [...teachers]
      if (isEditing) {
        updatedTeachers = updatedTeachers.map(t => t.employee_id === employeeId ? payload : t)
        toast.success('Teacher updated locally!')
      } else {
        if (teachers.some(t => t.employee_id === employeeId)) {
          toast.error('Teacher ID already exists!')
          setLoading(false)
          return
        }
        updatedTeachers.unshift(payload)
        toast.success('Teacher saved locally!')
      }
      setTeachers(updatedTeachers)
      localStorage.setItem('school_demo_teachers', JSON.stringify(updatedTeachers))
      resetForm()
      setShowForm(false)
      setLoading(false)
      return
    }

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('teachers')
          .update(payload)
          .eq('employee_id', employeeId)
        if (error) throw error
        toast.success('Teacher details updated!')
      } else {
        const { error } = await supabase
          .from('teachers')
          .insert([payload])
        if (error) throw error
        toast.success('Teacher registered!')
      }
      fetchTeachers()
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('Save teacher error:', err)
      toast.error(err.message || 'Database error while saving.')
    } finally {
      setLoading(false)
    }
  }

  // Delete Teacher
  const handleDelete = async (idToDelete = null, nameToDelete = null) => {
    const id = idToDelete || employeeId
    const name = nameToDelete || teacherName
    if (!id) return
    if (!window.confirm(`Are you sure you want to delete teacher ${name}? This will cascade delete their attendance logs!`)) {
      return
    }

    setLoading(true)

    if (isDemo) {
      const updated = teachers.filter(t => t.employee_id !== id)
      setTeachers(updated)
      localStorage.setItem('school_demo_teachers', JSON.stringify(updated))
      toast.success('Teacher deleted locally!')
      resetForm()
      setShowForm(false)
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('employee_id', id)
      if (error) throw error
      
      // Also delete from staff_attendance to clean up
      await supabase.from('staff_attendance').delete().eq('employee_id', id)

      toast.success('Teacher deleted from database')
      fetchTeachers()
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('Delete database error:', err)
      toast.error(err.message || 'Failed to delete teacher.')
    } finally {
      setLoading(false)
    }
  }

  // Print card trigger
  const handleOpenPrintModal = (tch) => {
    setCardData(tch)
    setShowCardModal(true)
  }

  const filteredTeachers = teachers.filter(t =>
    t.teacher_name.toLowerCase().includes(search.toLowerCase()) ||
    t.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    t.department.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      
      {/* Action Bar */}
      <div className="no-print flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            <FiSearch className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search teachers by name, ID or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-zinc-950 dark:text-zinc-100"
          />
        </div>
        <button
          onClick={() => {
            resetForm()
            setIsEditing(false)
            setShowForm(true)
          }}
          type="button"
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <FiPlus className="w-4 h-4" />
          Register Teacher
        </button>
      </div>

      {/* Main Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Table Pane */}
        <div className={`w-full transition-all duration-300 ${showForm ? 'lg:w-2/3' : 'w-full'} bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden`}>
          <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Registered Teachers</h3>
            <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full">
              {filteredTeachers.length} Teachers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-650 dark:text-zinc-350 border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-150 dark:border-zinc-850">
                <tr>
                  <th className="px-5 py-3">Photo</th>
                  <th className="px-5 py-3">ID & Name</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Contact Details</th>
                  <th className="px-5 py-3 no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map((tch) => (
                    <tr
                      key={tch.employee_id}
                      onClick={() => handleSelectTeacher(tch)}
                      className={`hover:bg-zinc-50/75 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer ${
                        selectedTeacher?.employee_id === tch.employee_id
                          ? 'bg-blue-50/50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                          {tch.photo_url ? (
                            <img src={tch.photo_url} alt={tch.teacher_name} className="w-full h-full object-cover" />
                          ) : (
                            <FiUser className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-200">{tch.teacher_name}</span>
                          <span className="font-mono text-xs text-zinc-500 mt-0.5">{tch.employee_id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-300">{tch.department} Department</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-zinc-855 dark:text-zinc-300">{tch.mobile}</span>
                          <span className="text-zinc-500 mt-0.5 truncate max-w-[150px]">{tch.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenPrintModal(tch)}
                            type="button"
                            className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                            title="Print Staff ID Card"
                          >
                            <FiPrinter className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSelectTeacher(tch)}
                            type="button"
                            className="p-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            title="Edit Teacher"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tch.employee_id, tch.teacher_name)}
                            type="button"
                            className="p-1.5 rounded bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                            title="Delete Teacher"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-5 py-10 text-center text-zinc-500">
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Details Pane */}
        {showForm && (
          <div className="no-print w-full lg:w-1/3 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden animate-slide-left">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/20">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                {isEditing ? 'Edit Teacher Details' : 'Register Teacher'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              
              {/* Photo Select */}
              <div className="flex flex-col items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="w-20 h-20 rounded-full border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-150 flex items-center justify-center relative">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <FiUser className="w-10 h-10 text-zinc-400" />
                  )}
                </div>
                <label className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-white dark:bg-[#09090b] rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer shadow-sm hover:bg-zinc-50 transition-colors">
                  <FiUpload className="w-3.5 h-3.5" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* ID Generator Grid */}
              <div className="flex gap-2 items-end">
                <div className="flex-grow flex flex-col">
                  <label className="text-xs font-medium text-zinc-500 mb-1">Employee ID (Auto-Generated)</label>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Click Generate →"
                    value={employeeId}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-2 text-sm shadow-sm font-mono cursor-not-allowed focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateEmployeeId}
                  disabled={isEditing}
                  className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs px-3 py-2.5 font-bold transition-all disabled:opacity-50"
                >
                  Generate
                </button>
              </div>

              {/* Name */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Teacher Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Connor"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                />
              </div>

              {/* Dept select only */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Department (Optional)</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-855 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                >
                  <option value="">Select Department (Optional)</option>
                  {['Science', 'Mathematics', 'History', 'English', 'Physics', 'Chemistry', 'Biology'].map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Mobile / Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-zinc-500 mb-1">Mobile Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-zinc-500 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="Email ID"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-855 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Address (Optional)</label>
                <textarea
                  placeholder="Permanent residential address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows="2"
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                ></textarea>
              </div>

              {/* Barcode */}
              {employeeId && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setBarcodeGenerated(true)}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold py-2 rounded-lg text-xs transition-colors"
                  >
                    Generate Barcode
                  </button>
                  {barcodeGenerated && (
                    <div className="flex justify-center p-2 bg-white rounded border border-zinc-150">
                      <BarcodeGenerator value={employeeId} width={1.5} height={45} />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
                  >
                    {isEditing ? 'Update Details' : 'Save Details'}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleOpenPrintModal(selectedTeacher)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                      title="Print ID Card"
                    >
                      <FiPrinter className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    Delete Teacher
                  </button>
                )}
              </div>

            </form>
          </div>
        )}

      </div>

      {/* Printable ID Modal */}
      {showCardModal && cardData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl relative max-w-sm w-full animate-scale-up">
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
            >
              <FiX className="w-5 h-5" />
            </button>
            <h3 className="text-md font-extrabold text-zinc-900 dark:text-zinc-50 mb-4 text-center">
              Staff ID Card Preview
            </h3>
            <IDCard data={cardData} type="Teacher" />
          </div>
        </div>
      )}

    </div>
  )
}

export default TeacherRegister
