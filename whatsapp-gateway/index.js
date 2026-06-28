const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 3005

app.use(cors())
app.use(express.json())

// Initialize WhatsApp Client with Local Session Authentication
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './session'
    }),
    puppeteer: {
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
})

// Generate QR Code in terminal
client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH YOUR WHATSAPP APP (LINKED DEVICES) ---')
    qrcode.generate(qr, { small: true })
    console.log('------------------------------------------------------------------\n')
})

client.on('ready', () => {
    console.log('✅ WhatsApp API Gateway is fully connected and ready!')
})

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failure:', msg)
})

// API endpoint to send a message
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body

    if (!number || !message) {
        return res.status(400).json({ success: false, error: 'Missing number or message parameter.' })
    }

    try {
        // Format number to WhatsApp ID format: e.g. 919876543210 -> 919876543210@c.us
        let cleanNumber = number.replace(/\D/g, '') // remove non-digits
        if (cleanNumber.length < 8) {
            return res.status(400).json({ success: false, error: 'Invalid phone number format. Must contain at least 8 digits.' })
        }
        
        // Auto-prepend India country code '91' if it is a standard 10-digit mobile number
        if (cleanNumber.length === 10 && ['6', '7', '8', '9'].includes(cleanNumber[0])) {
            cleanNumber = '91' + cleanNumber
            console.log(`ℹ️ Formatted 10-digit number to: ${cleanNumber}`)
        }

        const chatId = `${cleanNumber}@c.us`
        
        await client.sendMessage(chatId, message)
        console.log(`📤 Message sent automatically to ${cleanNumber}: "${message}"`)
        res.json({ success: true, message: 'Message sent successfully.' })
    } catch (err) {
        console.error('Failed to send message:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Local WhatsApp Gateway running on http://localhost:${PORT}`)
    console.log('Initializing WhatsApp Web client...')
    client.initialize()
})
