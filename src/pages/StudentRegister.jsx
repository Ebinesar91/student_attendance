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
  FiEye,
  FiX,
  FiUpload,
  FiPrinter,
  FiUser
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'

// Mock Initial Students for Offline/Demo Mode
const MOCK_STUDENTS = [
  {
    student_id: 'STU84391',
    student_name: 'John Doe',
    course: 'Computer Science',
    parent_name: 'Robert Doe',
    parent_mobile: '9876543210',
    parent_email: 'robert.doe@example.com',
    address: '123 Academic Street, College Town',
    photo_url: '',
    barcode: 'STU84391'
  },
  {
    student_id: 'STU92834',
    student_name: 'Alex Mercer',
    course: 'Bio-Technology',
    parent_name: 'William Mercer',
    parent_mobile: '9876543211',
    parent_email: 'william.mercer@example.com',
    address: '456 Biotech Blvd, Science District',
    photo_url: '',
    barcode: 'STU92834'
  }
]

export const StudentRegister = () => {
  const { isDemo } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Selection / Editing State
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // ID Card Modal
  const [showCardModal, setShowCardModal] = useState(false)
  const [cardData, setCardData] = useState(null)

  // Form Fields
  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [course, setCourse] = useState('Computer Science')
  const [parentName, setParentName] = useState('')
  const [parentMobile, setParentMobile] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [address, setAddress] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [barcodeGenerated, setBarcodeGenerated] = useState(false)

  // Fetch Students list
  const fetchStudents = async () => {
    setLoading(true)
    if (isDemo) {
      const localData = localStorage.getItem('school_demo_students')
      if (localData) {
        setStudents(JSON.parse(localData))
      } else {
        setStudents(MOCK_STUDENTS)
        localStorage.setItem('school_demo_students', JSON.stringify(MOCK_STUDENTS))
      }
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setStudents(data || [])
    } catch (err) {
      console.error('Fetch students error:', err)
      toast.error('Failed to load students from database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [isDemo])

  // Auto Generate Student ID
  const generateStudentId = () => {
    const randomDigits = Math.floor(10000 + Math.random() * 90000)
    const generated = `STU${randomDigits}`
    setStudentId(generated)
    setBarcodeGenerated(false)
    toast.success(`ID Generated: ${generated}`)
  }

  // Handle Photo File selection and upload
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setPhotoFile(file)

    // Quick local preview (also works as the actual storage URL in Demo mode)
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
        .from('student-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('student-photos')
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
    setStudentId('')
    setStudentName('')
    setCourse('Computer Science')
    setParentName('')
    setParentMobile('')
    setParentEmail('')
    setAddress('')
    setPhotoFile(null)
    setPhotoUrl('')
    setBarcodeGenerated(false)
    setIsEditing(false)
  }

  // Edit/Select Student
  const handleSelectStudent = (stud) => {
    setSelectedStudent(stud)
    setStudentId(stud.student_id)
    setStudentName(stud.student_name)
    setCourse(stud.course)
    setParentName(stud.parent_name)
    setParentMobile(stud.parent_mobile)
    setParentEmail(stud.parent_email)
    setAddress(stud.address)
    setPhotoUrl(stud.photo_url || '')
    setBarcodeGenerated(!!stud.barcode)
    setIsEditing(true)
    setShowForm(true)
  }

  // Save / Update Student
  const handleSave = async (e) => {
    e.preventDefault()
    if (!studentId) {
      toast.error('Please generate or enter a Student ID')
      return
    }

    setLoading(true)
    let finalPhotoUrl = photoUrl

    // Upload to Supabase if not in demo mode and there's a new file
    if (!isDemo && photoFile) {
      const uploadedUrl = await uploadPhotoToSupabase(photoFile, studentId)
      if (uploadedUrl) finalPhotoUrl = uploadedUrl
    }

    const payload = {
      student_id: studentId,
      student_name: studentName,
      course,
      parent_name: parentName,
      parent_mobile: parentMobile,
      parent_email: parentEmail,
      address,
      photo_url: finalPhotoUrl,
      barcode: studentId // barcode field stores the ID to encode
    }

    if (isDemo) {
      // Offline CRUD
      let updatedStudents = [...students]
      if (isEditing) {
        updatedStudents = updatedStudents.map(s => s.student_id === studentId ? payload : s)
        toast.success('Student updated locally!')
      } else {
        if (students.some(s => s.student_id === studentId)) {
          toast.error('Student ID already exists!')
          setLoading(false)
          return
        }
        updatedStudents.unshift(payload)
        toast.success('Student saved locally!')
      }
      setStudents(updatedStudents)
      localStorage.setItem('school_demo_students', JSON.stringify(updatedStudents))
      resetForm()
      setShowForm(false)
      setLoading(false)
      return
    }

    // Supabase Online CRUD
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('student_id', studentId)
        if (error) throw error
        toast.success('Student details updated successfully!')
      } else {
        const { error } = await supabase
          .from('students')
          .insert([payload])
        if (error) throw error
        toast.success('Student registered successfully!')
      }
      fetchStudents()
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('Save student database error:', err)
      toast.error(err.message || 'Database error occurred while saving.')
    } finally {
      setLoading(false)
    }
  }

  // Delete Student
  const handleDelete = async (idToDelete = null, nameToDelete = null) => {
    const id = idToDelete || studentId
    const name = nameToDelete || studentName
    if (!id) return
    if (!window.confirm(`Are you sure you want to delete student ${name}? This will cascade delete all attendance logs and notifications for this student!`)) {
      return
    }

    setLoading(true)

    if (isDemo) {
      const updated = students.filter(s => s.student_id !== id)
      setStudents(updated)
      localStorage.setItem('school_demo_students', JSON.stringify(updated))
      toast.success('Student deleted locally!')
      resetForm()
      setShowForm(false)
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('student_id', id)
      if (error) throw error
      toast.success('Student deleted from database')
      fetchStudents()
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('Delete database error:', err)
      toast.error(err.message || 'Failed to delete student.')
    } finally {
      setLoading(false)
    }
  }

  // Print card modal trigger
  const handleOpenPrintModal = (stud) => {
    setCardData(stud)
    setShowCardModal(true)
  }

  // Filter lists based on search
  const filteredStudents = students.filter(s =>
    s.student_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    s.course.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      
      {/* Search and Action Bar */}
      <div className="no-print flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            <FiSearch className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, ID or course..."
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
          Register Student
        </button>
      </div>

      {/* Main Layout Split */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Table List Pane */}
        <div className={`w-full transition-all duration-300 ${showForm ? 'lg:w-2/3' : 'w-full'} bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden`}>
          <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Registered Students</h3>
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full">
              {filteredStudents.length} Students
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-650 dark:text-zinc-350 border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-150 dark:border-zinc-850">
                <tr>
                  <th className="px-5 py-3">Photo</th>
                  <th className="px-5 py-3">ID & Name</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Parent Details</th>
                  <th className="px-5 py-3 no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((stud) => (
                    <tr
                      key={stud.student_id}
                      onClick={() => handleSelectStudent(stud)}
                      className={`hover:bg-zinc-50/75 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer ${
                        selectedStudent?.student_id === stud.student_id
                          ? 'bg-blue-50/50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                          {stud.photo_url ? (
                            <img src={stud.photo_url} alt={stud.student_name} className="w-full h-full object-cover" />
                          ) : (
                            <FiUser className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-200">{stud.student_name}</span>
                          <span className="font-mono text-xs text-zinc-500 mt-0.5">{stud.student_id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-300">{stud.course}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-300">{stud.parent_name}</span>
                          <span className="text-zinc-500 mt-0.5">{stud.parent_mobile}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenPrintModal(stud)}
                            type="button"
                            className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                            title="Print ID Card"
                          >
                            <FiPrinter className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSelectStudent(stud)}
                            type="button"
                            className="p-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            title="Edit Student"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(stud.student_id, stud.student_name)}
                            type="button"
                            className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                            title="Delete Student"
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
                      No students found matching your search.
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
                {isEditing ? 'Edit Registration' : 'New Registration'}
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
              
              {/* Photo Upload Section */}
              <div className="flex flex-col items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="w-20 h-20 rounded-full border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-150 flex items-center justify-center relative group">
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
                  <label className="text-xs font-medium text-zinc-500 mb-1">Student ID (Auto-Generated)</label>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Click Generate →"
                    value={studentId}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-2 text-sm shadow-sm font-mono cursor-not-allowed focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateStudentId}
                  disabled={isEditing}
                  className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs px-3 py-2.5 font-bold transition-all disabled:opacity-50"
                >
                  Generate
                </button>
              </div>

              {/* Basic Fields */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Course (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                />
              </div>

              {/* Parent Info */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg space-y-3 border border-zinc-100 dark:border-zinc-850">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Parent Details</p>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-zinc-500 mb-1">Parent Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Parent Full Name"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-zinc-500 mb-1">Parent Mobile</label>
                    <input
                      type="tel"
                      required
                      placeholder="Mobile Number"
                      value={parentMobile}
                      onChange={(e) => setParentMobile(e.target.value)}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-zinc-500 mb-1">Parent Email</label>
                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Address Field */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Address (Optional)</label>
                <textarea
                  placeholder="Parent permanent home address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows="2"
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                ></textarea>
              </div>

              {/* Barcode Display if Generated */}
              {studentId && (
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
                      <BarcodeGenerator value={studentId} width={1.5} height={45} />
                    </div>
                  )}
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
                  >
                    {isEditing ? 'Update Student' : 'Save Student'}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleOpenPrintModal(selectedStudent)}
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
                    Delete Student Record
                  </button>
                )}
              </div>

            </form>
          </div>
        )}

      </div>

      {/* printable ID Card Overlay Modal */}
      {showCardModal && cardData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl relative max-w-sm w-full animate-scale-up">
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
            >
              <FiX className="w-5 h-5" />
            </button>
            <h3 className="text-md font-extrabold text-zinc-900 dark:text-zinc-50 mb-4 text-center">
              Student ID Card Preview
            </h3>
            <IDCard data={cardData} type="Student" />
          </div>
        </div>
      )}

    </div>
  )
}

export default StudentRegister
