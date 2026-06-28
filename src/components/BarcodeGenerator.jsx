import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { FiDownload, FiPrinter } from 'react-icons/fi'

export const BarcodeGenerator = ({ value, width = 1.5, height = 50, displayValue = true }) => {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: displayValue,
          fontSize: 12,
          fontOptions: 'bold',
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        })
      } catch (err) {
        console.error('Barcode generation error:', err)
      }
    }
  }, [value, width, height, displayValue])

  const downloadBarcode = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `barcode_${value}.png`
    link.href = url
    link.click()
  }

  const printBarcode = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode ${value}</title>
          <style>
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background-color: #ffffff;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            @page {
              size: auto;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <img src="${url}" />
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="bg-white p-2 rounded border border-zinc-100">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
      <div className="flex gap-4">
        <button
          onClick={downloadBarcode}
          type="button"
          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 focus:outline-none cursor-pointer"
        >
          <FiDownload className="w-3.5 h-3.5" />
          Download
        </button>
        <button
          onClick={printBarcode}
          type="button"
          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 focus:outline-none cursor-pointer"
        >
          <FiPrinter className="w-3.5 h-3.5" />
          Print
        </button>
      </div>
    </div>
  )
}

export default BarcodeGenerator
