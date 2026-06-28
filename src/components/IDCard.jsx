import React, { useRef } from 'react'
import { FiPrinter, FiUser } from 'react-icons/fi'
import { BarcodeGenerator } from './BarcodeGenerator'

export const IDCard = ({ data, type = 'Student' }) => {
  const cardRef = useRef(null)

  const handlePrint = () => {
    // We add a print class to the body, trigger print, and clean up.
    // In index.css, we defined print media styles.
    const originalTitle = document.title
    document.title = `${type}_ID_${data.student_id || data.employee_id}`
    window.print()
    document.title = originalTitle
  }

  const isStudent = type === 'Student'
  const name = isStudent ? data.student_name : (data.teacher_name || data.name)
  const id = isStudent ? data.student_id : data.employee_id
  const photo = data.photo_url

  return (
    <div className="flex flex-col items-center gap-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-[#0c0c0f]">
      {/* Printable ID Card Area */}
      <div 
        ref={cardRef} 
        className="print-area w-[320px] h-[480px] bg-white text-zinc-900 border-2 border-blue-600 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between relative p-4 font-sans select-none"
        style={{ colorScheme: 'light' }}
      >
        {/* Card Header */}
        <div className="text-center pb-2 border-b border-zinc-200">
          <h2 className="text-lg font-bold text-blue-800 tracking-tight">APEX ACADEMY</h2>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Identity Card</p>
        </div>

        {/* Card Body */}
        <div className="flex flex-col items-center my-3 gap-2 flex-grow justify-center">
          {/* Photo */}
          <div className="w-24 h-24 rounded-full border-2 border-blue-100 overflow-hidden bg-zinc-100 flex items-center justify-center shadow-inner">
            {photo ? (
              <img src={photo} alt={name} className="w-full h-full object-cover" />
            ) : (
              <FiUser className="w-12 h-12 text-zinc-400" />
            )}
          </div>

          {/* Name & Role */}
          <div className="text-center">
            <h3 className="text-base font-extrabold text-zinc-800 uppercase leading-snug">{name}</h3>
            <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-bold text-white bg-blue-600 rounded-full uppercase">
              {type}
            </span>
          </div>

          {/* Key Details Grid */}
          <div className="w-full grid grid-cols-2 gap-x-2 gap-y-1.5 text-left bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 text-xs">
            <div>
              <p className="text-[9px] text-zinc-400 font-semibold uppercase">ID Number</p>
              <p className="font-bold text-zinc-800 font-mono">{id}</p>
            </div>
            {isStudent ? (
              <div>
                <p className="text-[9px] text-zinc-400 font-semibold uppercase">Course</p>
                <p className="font-bold text-zinc-800 truncate">{data.course || 'N/A'}</p>
              </div>
            ) : (
              <div>
                <p className="text-[9px] text-zinc-400 font-semibold uppercase">Department</p>
                <p className="font-bold text-zinc-800 truncate">{data.department || 'N/A'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer with Barcode */}
        <div className="flex flex-col items-center border-t border-zinc-100 pt-2 bg-white">
          <BarcodeGenerator value={id} width={1.2} height={35} displayValue={false} />
          <p className="text-[8px] text-zinc-400 mt-1 text-center font-medium">
            If found, please return to Apex Academy Administration.
          </p>
        </div>
      </div>

      {/* Control Panel (Hide on print) */}
      <button
        onClick={handlePrint}
        type="button"
        className="no-print flex items-center justify-center gap-2 w-full max-w-[320px] bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow transition-colors cursor-pointer"
      >
        <FiPrinter className="w-4 h-4" />
        Print ID Card
      </button>
    </div>
  )
}

export default IDCard
