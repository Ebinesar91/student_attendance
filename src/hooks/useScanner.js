import { useState, useRef, useEffect, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export const useScanner = (onScanSuccess) => {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  
  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)
  const controlsRef = useRef(null)

  // Initialize Code Reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader()
    
    // Retrieve available video inputs
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((videoDevices) => {
        setDevices(videoDevices)
        if (videoDevices.length > 0) {
          // Look for rear/back camera
          const rearCamera = videoDevices.find(
            (device) =>
              device.label.toLowerCase().includes('back') ||
              device.label.toLowerCase().includes('rear') ||
              device.label.toLowerCase().includes('environment') ||
              device.label.toLowerCase().includes('out')
          )
          setSelectedDeviceId(rearCamera ? rearCamera.deviceId : videoDevices[0].deviceId)
        }
      })
      .catch((err) => {
        console.error('Error listing camera devices:', err)
        setError('No camera devices found.')
      })

    return () => {
      // Clean up camera stream on unmount
      if (controlsRef.current) {
        controlsRef.current.stop()
      }
    }
  }, [])

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop()
      } catch (err) {
        console.error('Failed to stop camera stream:', err)
      }
      controlsRef.current = null
    }
    setIsScanning(false)
  }, [])

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!videoRef.current || !codeReaderRef.current) {
      setError('Scanner elements not ready.')
      return
    }

    setError(null)
    stopScanning() // Stop any current streams first

    try {
      setIsScanning(true)
      
      const deviceId = selectedDeviceId || undefined
      
      const controls = await codeReaderRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, decodeErr) => {
          if (result) {
            const scannedText = result.getText()
            onScanSuccess(scannedText)
          }
          if (decodeErr && !(decodeErr.name === 'NotFoundException')) {
            // Log other decoding errors, but ignore NotFoundException which happens constantly during active search
            console.debug('Decoding feedback:', decodeErr)
          }
        }
      )
      
      controlsRef.current = controls
    } catch (err) {
      console.error('Camera starting error:', err)
      setError(err.message || 'Could not start camera. Ensure permission is granted.')
      setIsScanning(false)
    }
  }, [selectedDeviceId, onScanSuccess, stopScanning])

  return {
    videoRef,
    isScanning,
    startScanning,
    stopScanning,
    error,
    devices,
    selectedDeviceId,
    setSelectedDeviceId
  }
}

export default useScanner
