import React, { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { BarcodeGenerator } from '../components/BarcodeGenerator'
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiUpload,
  FiUser
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'

// Mock Initial Staff for Offline/Demo Mode
const MOCK_STAFF = [
  {
    employee_id: 'STF28439',
    name: 'Jane Miller',
    department: 'Administration',
    mobile: '9876543230',
    address: '89 Administration Row, East Wing',
    photo_url: '',
    barcode: 'STF28439'
  },
  {
    employee_id: 'STF93210',
    name: 'Marcus Vance',
    department: 'IT Support',
    mobile: '9876543231',
    address: '12 Server Way, Basement Lab',
    photo_url: '',
    barcode: 'STF93210'
  }
]

export const StaffRegister = () => {
  const { isDemo } = useAuth()
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Selection / Editing State
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form Fields
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [barcodeGenerated, setBarcodeGenerated] = useState(false)

  // Fetch Staff list
  const fetchStaffList = async () => {
    setLoading(true)
    if (isDemo) {
      const localData = localStorage.getItem('school_demo_staff')
      if (localData) {
        setStaffList(JSON.parse(localData))
      } else {
        setStaffList(MOCK_STAFF)
        localStorage.setItem('school_demo_staff', JSON.stringify(MOCK_STAFF))
      }
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setStaffList(data || [])
    } catch (err) {
      console.error('Fetch staff error:', err)
      toast.error('Failed to load staff list from database.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaffList()
  }, [isDemo])

  // Auto Generate Staff ID
  const generateEmployeeId = () => {
    const randomDigits = Math.floor(10000 + Math.random() * 90000)
    const generated = `STF${randomDigits}`
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
        .from('staff-photos')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('staff-photos')
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
    setName('')
    setDepartment('')
    setMobile('')
    setAddress('')
    setPhotoFile(null)
    setPhotoUrl('')
    setBarcodeGenerated(false)
    setIsEditing(false)
  }

  // Edit/Select Staff
  const handleSelectStaff = (stf) => {
    setSelectedStaff(stf)
    setEmployeeId(stf.employee_id)
    setName(stf.name)
    setDepartment(stf.department)
    setMobile(stf.mobile)
    setAddress(stf.address)
    setPhotoUrl(stf.photo_url || '')
    setBarcodeGenerated(!!stf.barcode)
    setIsEditing(true)
    setShowForm(true)
  }

  // Save / Update Staff
  const handleSave = async (e) => {
    e.preventDefault()
    if (!employeeId) {
      toast.error('Please generate or enter an Employee ID')
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
      name,
      department,
      mobile,
      address,
      photo_url: finalPhotoUrl,
      barcode: employeeId
    }

    if (isDemo) {
      let updatedList = [...staffList]
      if (isEditing) {
        updatedList = updatedList.map(s => s.employee_id === employeeId ? payload : s)
        toast.success('Staff updated locally!')
      } else {
        if (staffList.some(s => s.employee_id === employeeId)) {
          toast.error('Staff ID already exists!')
          setLoading(false)
          return
        }
        updatedList.unshift(payload)
        toast.success('Staff saved locally!')
      }
      setStaffList(updatedList)
      localStorage.setItem('school_demo_staff', JSON.stringify(updatedList))
      resetForm()
      setShowForm(false)
      setLoading(false)
      return
    }

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('staff')
          .update(payload)
          .eq('employee_id', employeeId)
        if (error) throw error
        toast.success('Staff details updated!')
      } else {
        const { error } = await supabase
          .from('staff')
          .insert([payload])
        if (error) throw error
        toast.success('Staff member registered!')
      }
      fetchStaffList()
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('Save staff error:', err)
      toast.error(err.message || 'Database error while saving.')
    } finally {
      setLoading(false)
    }
  }

  // Delete Staff
  const handleDelete = async (idToDelete = null, nameToDelete = null) => {
    const id = idToDelete || employeeId
    const nameVal = nameToDelete || name
    if (!id) return
    if (!window.confirm(`Are you sure you want to delete staff member ${nameVal}? This will cascade delete their attendance logs!`)) {
      return
    }

    setLoading(true)

    if (isDemo) {
      const updated = staffList.filter(s => s.employee_id !== id)
      setStaffList(updated)
      localStorage.setItem('school_demo_staff', JSON.stringify(updated))
      toast.success('Staff deleted locally!')
      resetForm()
      setShowForm(false)
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('employee_id', id)
      if (error) throw error

      // Also clean up staff attendance logs
      await supabase.from('staff_attendance').delete().eq('employee_id', id)

      toast.success('Staff deleted from database')
      fetchStaffList()
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('Delete database error:', err)
      toast.error(err.message || 'Failed to delete staff member.')
    } finally {
      setLoading(false)
    }
  }

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.employee_id.toLowerCase().includes(search.toLowerCase()) ||
    s.department.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            <FiSearch className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search staff by name, ID or department..."
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
          Register Staff
        </button>
      </div>

      {/* Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Table List */}
        <div className={`w-full transition-all duration-300 ${showForm ? 'lg:w-2/3' : 'w-full'} bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden`}>
          <div className="p-5 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Support Staff Members</h3>
            <span className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-650 dark:text-teal-400 font-bold px-2 py-0.5 rounded-full">
              {filteredStaff.length} Staff
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-650 dark:text-zinc-350 border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-150 dark:border-zinc-850">
                <tr>
                  <th className="px-5 py-3">Photo</th>
                  <th className="px-5 py-3">ID & Name</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((stf) => (
                    <tr
                      key={stf.employee_id}
                      onClick={() => handleSelectStaff(stf)}
                      className={`hover:bg-zinc-50/75 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer ${
                        selectedStaff?.employee_id === stf.employee_id
                          ? 'bg-blue-50/50 dark:bg-blue-900/20'
                          : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                          {stf.photo_url ? (
                            <img src={stf.photo_url} alt={stf.name} className="w-full h-full object-cover" />
                          ) : (
                            <FiUser className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-200">{stf.name}</span>
                          <span className="font-mono text-xs text-zinc-500 mt-0.5">{stf.employee_id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-zinc-800 dark:text-zinc-300">{stf.department}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-zinc-600 dark:text-zinc-400">{stf.mobile}</span>
                      </td>
                      <td className="px-5 py-3 no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectStaff(stf)}
                            type="button"
                            className="p-1.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            title="Edit Staff Member"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(stf.employee_id, stf.name)}
                            type="button"
                            className="p-1.5 rounded bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                            title="Delete Staff Member"
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
                      No staff members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Details Pane */}
        {showForm && (
          <div className="w-full lg:w-1/3 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden animate-slide-left">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/20">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
                {isEditing ? 'Edit Staff Details' : 'Register Staff Member'}
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
                <label className="text-xs font-medium text-zinc-500 mb-1">Staff Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Miller"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                />
              </div>

              {/* Department */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-zinc-500 mb-1">Department (Optional)</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-sm shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                >
                  <option value="">Select Department (Optional)</option>
                  {['Administration', 'IT Support', 'Security', 'Maintenance', 'Library', 'Accounts'].map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Mobile */}
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
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
                >
                  {isEditing ? 'Update Details' : 'Save Details'}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-sm transition-colors cursor-pointer"
                  >
                    Delete Staff Member
                  </button>
                )}
              </div>

            </form>
          </div>
        )}

      </div>

    </div>
  )
}

export default StaffRegister
