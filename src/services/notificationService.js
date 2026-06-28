import { toast } from 'react-hot-toast'

/**
 * Sends a parent notification based on the configured channel.
 * Supporting: WhatsApp Link, Telegram Bot API, Resend Email API, or Twilio SMS fallback.
 * 
 * @param {object} student - Student record including parent_mobile and parent_email
 * @param {string} message - Message text
 * @returns {Promise<boolean>}
 */
export const sendSMS = async (student, message) => {
  if (!student) return false

  let parentMobile = ''
  let parentEmail = ''

  if (typeof student === 'string') {
    parentMobile = student
  } else if (student && typeof student === 'object') {
    parentMobile = student.parent_mobile ? student.parent_mobile.trim() : ''
    parentEmail = student.parent_email ? student.parent_email.trim() : ''
  }

  // 1. Check Twilio env variables first (legacy fallback)
  const TWILIO_SID = import.meta.env.VITE_TWILIO_SID
  const TWILIO_AUTH_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN
  const TWILIO_FROM_NUMBER = import.meta.env.VITE_TWILIO_FROM_NUMBER

  if (TWILIO_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && parentMobile) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
      const authHeader = 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_AUTH_TOKEN}`)
      const params = new URLSearchParams()
      params.append('To', parentMobile)
      params.append('From', TWILIO_FROM_NUMBER)
      params.append('Body', message)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      })
      if (response.ok) {
        console.log(`Twilio SMS sent successfully.`)
        toast.success(`Twilio SMS sent to parent!`)
        return true
      }
    } catch (err) {
      console.error('Twilio SMS error:', err)
    }
  }

  // 2. Read selected free channel from Settings dashboard
  const activeChannel = localStorage.getItem('school_setting_active_channel') || 'whatsapp'

  if (activeChannel === 'none') {
    console.log('Notifications are muted in settings.')
    return true
  }

  if (activeChannel === 'whatsapp') {
    // WhatsApp redirect mode: we toast and log. The scanner UI handles rendering a click button.
    console.log(`WhatsApp Alert pre-filled: ${message}`)
    toast.success(`WhatsApp redirect generated!`, {
      icon: '💬',
      duration: 3000
    })
    return true
  }

  if (activeChannel === 'whatsapp-auto') {
    const cleanNumber = parentMobile ? parentMobile.replace(/\D/g, '') : ''
    if (!cleanNumber || cleanNumber.length < 8) {
      console.warn('WhatsApp Auto dispatch failed: Invalid parent mobile.')
      toast.error('Could not send WhatsApp alert: Registered parent mobile number is invalid.')
      return false
    }

    try {
      const response = await fetch('http://localhost:3005/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: parentMobile,
          message: message
        })
      })
      if (response.ok) {
        console.log('Automated WhatsApp message sent.')
        toast.success('Parent alert sent via WhatsApp!', { icon: '💬' })
        return true
      } else {
        const errData = await response.json()
        console.error('WhatsApp Gateway error:', errData)
        toast.error(`WhatsApp Gateway Error: ${errData.error || 'Failed to send'}`)
        return false
      }
    } catch (err) {
      console.error('WhatsApp Gateway network error:', err)
      toast.error('Could not connect to local WhatsApp Gateway. Make sure it is running.')
      return false
    }
  }

  if (activeChannel === 'telegram') {
    const tgToken = localStorage.getItem('school_setting_tg_token')
    const tgChatId = localStorage.getItem('school_setting_tg_chat')

    if (!tgToken || !tgChatId) {
      console.warn('Telegram Bot not configured in Settings.')
      toast.error('Telegram Bot is active but missing Token/Chat ID in Settings.')
      return false
    }

    try {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: message
        })
      })
      if (response.ok) {
        console.log('Telegram message dispatched successfully.')
        toast.success('Telegram Bot alert sent!', { icon: '🤖' })
        return true
      } else {
        const errData = await response.json()
        console.error('Telegram API error:', errData)
        toast.error(`Telegram Bot Error: ${errData.description || 'Failed to send'}`)
        return false
      }
    } catch (err) {
      console.error('Telegram network error:', err)
      toast.error('Network failure sending Telegram alert.')
      return false
    }
  }

  if (activeChannel === 'email') {
    const resendKey = localStorage.getItem('school_setting_resend_key')
    const senderEmail = localStorage.getItem('school_setting_sender_email') || 'alerts@school.com'

    if (!parentEmail) {
      console.warn('Email dispatch failed: Student does not have parent_email.')
      toast.error('Could not send email alert: No parent email registered.')
      return false
    }

    if (!resendKey) {
      console.warn('Resend API key not configured in Settings.')
      toast.error('Email alert is active but missing Resend API key in Settings.')
      return false
    }

    try {
      const url = 'https://api.resend.com/emails'
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `Apex School Alerts <${senderEmail}>`,
          to: [parentEmail],
          subject: '🔔 Student Attendance Alert',
          text: message
        })
      })

      if (response.ok) {
        console.log('Resend email sent successfully.')
        toast.success(`Email alert sent to parent!`, { icon: '📧' })
        return true
      } else {
        const errData = await response.json()
        console.error('Resend API error:', errData)
        toast.error(`Email Error: ${errData.message || 'Resend error'}`)
        return false
      }
    } catch (err) {
      console.error('Resend network error:', err)
      toast.error('Network failure sending email alert.')
      return false
    }
  }

  // Final fallback simulation
  console.log(`[Notification simulation] Channel: ${activeChannel} | Alert text: "${message}"`)
  return true
}
