import React, { useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  FiSettings,
  FiUser,
  FiDatabase,
  FiClock,
  FiMail,
  FiSun,
  FiMoon,
  FiSend,
  FiMessageCircle,
  FiTrash2
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'

export const Settings = () => {
  const { user, isDemo } = useAuth()
  const { darkMode, toggleTheme } = useTheme()

  // App parameters
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('school_setting_name') || 'Apex Academy')
  const [adminEmail, setAdminEmail] = useState(user?.email || 'admin@school.com')
  const [retentionDays] = useState(7)
  const [pruning, setPruning] = useState(false)

  const [activeChannel, setActiveChannel] = useState(() => localStorage.getItem('school_setting_active_channel') || 'whatsapp')
  const [telegramBotToken, setTelegramBotToken] = useState(() => localStorage.getItem('school_setting_tg_token') || '')
  const [telegramChatId, setTelegramChatId] = useState(() => localStorage.getItem('school_setting_tg_chat') || '')
  const [resendApiKey, setResendApiKey] = useState(() => localStorage.getItem('school_setting_resend_key') || '')
  const [senderEmail, setSenderEmail] = useState(() => localStorage.getItem('school_setting_sender_email') || 'alerts@school.com')
  const [whatsappGatewayUrl, setWhatsappGatewayUrl] = useState(() => localStorage.getItem('school_setting_whatsapp_gateway_url') || 'http://localhost:3005')

  const handlePruneLogs = async (wipeAll = false) => {
    const confirmMsg = wipeAll 
      ? 'WARNING: Are you sure you want to permanently delete ALL student, staff, and teacher attendance logs and notifications? This cannot be undone!'
      : 'Are you sure you want to delete all attendance logs and notifications older than 7 days manually?'
    
    if (!window.confirm(confirmMsg)) return

    setPruning(true)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const dateLimitStr = sevenDaysAgo.toISOString().split('T')[0]
    const timestampLimitStr = sevenDaysAgo.toISOString()

    if (isDemo) {
      // 1. Student Attendance
      const localSAtt = JSON.parse(localStorage.getItem('school_demo_student_attendance') || '[]')
      const updatedSAtt = wipeAll ? [] : localSAtt.filter(log => log.date >= dateLimitStr)
      localStorage.setItem('school_demo_student_attendance', JSON.stringify(updatedSAtt))

      // 2. Staff Attendance
      const localStaffAtt = JSON.parse(localStorage.getItem('school_demo_staff_attendance') || '[]')
      const updatedStaffAtt = wipeAll ? [] : localStaffAtt.filter(log => log.date >= dateLimitStr)
      localStorage.setItem('school_demo_staff_attendance', JSON.stringify(updatedStaffAtt))

      // 3. Notifications
      const localNotif = JSON.parse(localStorage.getItem('school_demo_notifications') || '[]')
      const updatedNotif = wipeAll ? [] : localNotif.filter(log => log.sent_at >= dateLimitStr)
      localStorage.setItem('school_demo_notifications', JSON.stringify(updatedNotif))

      toast.success(wipeAll ? 'All local logs wiped successfully!' : 'Local logs older than 7 days pruned!')
      setPruning(false)
      return
    }

    try {
      if (wipeAll) {
        // Wipe all logs
        const { error: sError } = await supabase.from('student_attendance').delete().neq('status', 'placeholder_hack')
        const { error: stError } = await supabase.from('staff_attendance').delete().neq('status', 'placeholder_hack')
        const { error: nError } = await supabase.from('notifications').delete().neq('status', 'placeholder_hack')

        if (sError || stError || nError) throw new Error('Some deletions failed.')
        toast.success('All database logs wiped successfully!')
      } else {
        // Prune older than 7 days
        const { error: sError } = await supabase.from('student_attendance').delete().lt('date', dateLimitStr)
        const { error: stError } = await supabase.from('staff_attendance').delete().lt('date', dateLimitStr)
        const { error: nError } = await supabase.from('notifications').delete().lt('sent_at', timestampLimitStr)

        if (sError || stError || nError) throw new Error('Pruning failed.')
        toast.success('Database logs older than 7 days pruned!')
      }
    } catch (err) {
      console.error('Manual prune error:', err)
      toast.error('Cleanup operation failed.')
    } finally {
      setPruning(false)
    }
  }

  const handleSaveConfigs = (e) => {
    e.preventDefault()
    localStorage.setItem('school_setting_name', schoolName)
    localStorage.setItem('school_setting_active_channel', activeChannel)
    localStorage.setItem('school_setting_tg_token', telegramBotToken)
    localStorage.setItem('school_setting_tg_chat', telegramChatId)
    localStorage.setItem('school_setting_resend_key', resendApiKey)
    localStorage.setItem('school_setting_sender_email', senderEmail)
    localStorage.setItem('school_setting_whatsapp_gateway_url', whatsappGatewayUrl)
    toast.success('System configuration updated successfully!')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      
      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2 pb-3 border-b border-zinc-150 dark:border-zinc-800">
            <FiUser className="text-blue-600" />
            Admin Profile Details
          </h3>
          <div className="mt-4 space-y-3.5 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-900">
              <span className="text-zinc-500 font-semibold">User Role</span>
              <span className="font-bold text-blue-650 dark:text-blue-400">System Administrator</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-900">
              <span className="text-zinc-500 font-semibold">Email ID</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono">{adminEmail}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500 font-semibold">Status</span>
              <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold uppercase text-[9px]">
                Active Session
              </span>
            </div>
          </div>
        </div>

        {/* Database Status Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2 pb-3 border-b border-zinc-150 dark:border-zinc-800">
            <FiDatabase className="text-indigo-650" />
            Supabase Connection Info
          </h3>
          <div className="mt-4 space-y-3.5 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-900">
              <span className="text-zinc-500 font-semibold">Connection Mode</span>
              <span className={`font-bold ${isDemo ? 'text-amber-600' : 'text-emerald-650'}`}>
                {isDemo ? 'Offline Local Demo' : 'Online PostgreSQL'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-900">
              <span className="text-zinc-500 font-semibold">URL Configured</span>
              <span className="font-bold font-mono truncate max-w-[180px] text-zinc-650 dark:text-zinc-400">
                {import.meta.env.VITE_SUPABASE_URL || 'Offline Mock'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500 font-semibold">Row Level Security</span>
              <span className="text-zinc-800 dark:text-zinc-200 font-bold">Enabled (Permissive)</span>
            </div>
          </div>
        </div>

        {/* Attendance Retention Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2 pb-3 border-b border-zinc-150 dark:border-zinc-800">
            <FiClock className="text-teal-650" />
            Retention & Auto Cleanup
          </h3>
          <div className="mt-4 space-y-4 text-xs">
            <p className="text-zinc-550 leading-relaxed">
              Attendance records are set to automatically prune to optimize database storage and keep logs fresh.
            </p>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-900">
              <span className="text-zinc-550 font-bold">Auto-Delete Logs Older Than</span>
              <span className="font-extrabold text-teal-600 dark:text-teal-400">{retentionDays} Days (1 Week)</span>
            </div>

            {/* Manual control buttons */}
            <div className="flex gap-2 pt-1.5">
              <button
                type="button"
                disabled={pruning}
                onClick={() => handlePruneLogs(false)}
                className="flex-grow bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-2 rounded-lg transition-colors cursor-pointer text-center"
              >
                {pruning ? 'Pruning...' : 'Run 7-Day Prune'}
              </button>
              <button
                type="button"
                disabled={pruning}
                onClick={() => handlePruneLogs(true)}
                className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 text-rose-650 dark:text-rose-400 font-bold py-2 px-3 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center"
                title="Wipe all logs"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/20 border border-teal-150 dark:border-teal-900/40 rounded-lg text-[10px] text-teal-800 dark:text-teal-400">
              Note: This is managed securely by a PostgreSQL daily cron job (`delete-old-attendance-daily`) running inside your Supabase project instance.
            </div>
          </div>
        </div>

        {/* Appearance Control Card */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2 pb-3 border-b border-zinc-150 dark:border-zinc-800">
              {darkMode ? <FiMoon className="text-indigo-400" /> : <FiSun className="text-amber-500" />}
              Appearance Mode
            </h3>
            <p className="text-xs text-zinc-555 mt-3 leading-relaxed">
              Adjust your theme preference. Apex Portal is optimized for high-contrast dark environments during late admin checks.
            </p>
          </div>
          <button
            onClick={toggleTheme}
            type="button"
            className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 rounded-lg text-xs transition-colors mt-4 cursor-pointer"
          >
            Toggle {darkMode ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>

        {/* Configurations Form */}
        <div className="md:col-span-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2 pb-3 border-b border-zinc-150 dark:border-zinc-800 mb-4">
            <FiSettings className="text-zinc-550" />
            Notification Channels & Free Alert Settings
          </h3>
          
          <form onSubmit={handleSaveConfigs} className="space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-zinc-500 mb-1">Institution Name</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-zinc-500 mb-1">Active Notification Channel (Free & Unlimited)</label>
                <select
                  value={activeChannel}
                  onChange={(e) => setActiveChannel(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-955 dark:text-zinc-100"
                >
                  <option value="whatsapp">WhatsApp Direct Redirect (100% Free)</option>
                  <option value="whatsapp-auto">WhatsApp Auto-Send Gateway (100% Free & Automated)</option>
                  <option value="telegram">Telegram Bot Alerts (100% Free & Automated)</option>
                  <option value="email">Email Alerts via Resend SMTP (Free up to 3000/mo)</option>
                  <option value="none">Disabled (No parent notifications)</option>
                </select>
              </div>
            </div>

            {activeChannel === 'whatsapp-auto' && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/40 p-4 rounded-xl space-y-4 animate-scale-up">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-450 flex items-center gap-1.5 uppercase tracking-wider">
                  <FiMessageCircle className="w-4 h-4" /> WhatsApp Gateway Configuration
                </h4>
                <div className="flex flex-col">
                  <label className="text-[10px] font-semibold text-zinc-555 mb-1">WhatsApp Gateway Server URL</label>
                  <input
                    type="url"
                    placeholder="e.g. http://localhost:3005 or https://your-tunnel.ngrok-free.app"
                    value={whatsappGatewayUrl}
                    onChange={(e) => setWhatsappGatewayUrl(e.target.value)}
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Default is <code>http://localhost:3005</code>. If you are accessing this portal on mobile devices or tablets, 
                  start ngrok and paste your secure <strong>HTTPS forwarding URL</strong> (e.g. <code>https://nondemonstratively-skaldic-marcela.ngrok-free.dev</code>) above!
                </p>
              </div>
            )}

            {activeChannel === 'telegram' && (
              <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-150 dark:border-blue-900/40 p-4 rounded-xl space-y-4 animate-scale-up">
                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-450 flex items-center gap-1.5 uppercase tracking-wider">
                  <FiSend className="w-4 h-4" /> Telegram Bot Configuration
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-zinc-500 mb-1">Telegram Bot Token</label>
                    <input
                      type="text"
                      placeholder="e.g. 5984328402:AAHfe84..."
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-zinc-500 mb-1">Telegram Chat/Channel ID (or Username)</label>
                    <input
                      type="text"
                      placeholder="e.g. -100185938491 or @MySchoolAlerts"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  How to setup: Message <strong>@BotFather</strong> on Telegram and type <code>/newbot</code>. 
                  Paste the token here, create a Channel, add your bot as an Admin, and paste your Channel name (e.g. <code>@MySchoolAlerts</code>) above.
                </p>
              </div>
            )}

            {activeChannel === 'email' && (
              <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-150 dark:border-indigo-900/40 p-4 rounded-xl space-y-4 animate-scale-up">
                <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <FiMail className="w-4 h-4" /> Resend Email Configuration
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-zinc-500 mb-1">Resend API Key</label>
                    <input
                      type="password"
                      placeholder="re_843uDfs98234..."
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-955 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-zinc-500 mb-1">Sender Email Address</label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-855 rounded-lg px-3 py-2 text-xs shadow-sm focus:outline-none text-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  How to setup: Sign up at <strong>Resend.com</strong> (free 3,000 emails/month). Create a free API key, 
                  verify your domain or use <code>onboarding@resend.dev</code> for test emails.
                </p>
              </div>
            )}

            {activeChannel === 'whatsapp' && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/40 p-4 rounded-xl space-y-2 animate-scale-up">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-455 flex items-center gap-1.5 uppercase tracking-wider">
                  <FiMessageCircle className="w-4 h-4" /> WhatsApp Quick-Send Redirect
                </h4>
                <p className="text-[10px] text-emerald-800 dark:text-emerald-400 leading-relaxed font-medium">
                  Ideal for direct alerts. Scanning a barcode automatically shows a prominent "WhatsApp Alert" button on-screen. 
                  Clicking it instantly launches WhatsApp Web with the parent's phone number and the message pre-filled. No API keys needed!
                </p>
              </div>
            )}

            {activeChannel === 'whatsapp-auto' && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/40 p-4 rounded-xl space-y-2 animate-scale-up">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-455 flex items-center gap-1.5 uppercase tracking-wider">
                  <FiMessageCircle className="w-4 h-4" /> WhatsApp Auto-Send Local Gateway
                </h4>
                <p className="text-[10px] text-emerald-800 dark:text-emerald-400 leading-relaxed font-medium">
                  Sends messages completely automatically in the background using your local gateway. 
                  Make sure you have started the local node service inside <code>whatsapp-gateway/</code> and scanned the QR code in your terminal.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-xs shadow transition-colors cursor-pointer"
            >
              Save Configurations
            </button>
          </form>
        </div>

      </div>

    </div>
  )
}

export default Settings
