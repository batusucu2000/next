// /lib/twilioClient.ts
import twilio from 'twilio'

const SID   = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const FROM  = process.env.TWILIO_WHATSAPP_FROM

// Env var kontrolleri (sırlar loglanmıyor)
if (!SID)   throw new Error('TWILIO_ACCOUNT_SID missing in environment')
if (!TOKEN) throw new Error('TWILIO_AUTH_TOKEN missing in environment')
if (!FROM)  throw new Error('TWILIO_WHATSAPP_FROM missing in environment')
if (!FROM.startsWith('whatsapp:+')) {
  throw new Error('TWILIO_WHATSAPP_FROM must start with "whatsapp:+"')
}

export const twilioClient = twilio(SID, TOKEN)
export const WA_FROM = FROM

// Eski importlar için alias (opsiyonel)
export const WHATSAPP_FROM = WA_FROM
