// components/ContactForm.jsx
'use client'

import { useState } from 'react'

export default function ContactForm() {
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    // TODO: Burada veriyi alıp API'ne POST edebilirsin:
    // const form = new FormData(e.currentTarget)
    // await fetch('/api/contact', { method:'POST', body: form })

    alert('Mesaj alındı! (örnek)')
    setSending(false)
  }

  return (
    <form className="px-form" onSubmit={handleSubmit}>
      <label>
        Ad Soyad
        <input name="name" type="text" placeholder="Adınız" required />
      </label>
      <label>
        Telefon
        <input name="phone" type="tel" placeholder="+90 5xx xxx xx xx" />
      </label>
      <label>
        Mesaj
        <textarea name="message" rows={4} placeholder="Kısaca yazın..." />
      </label>
      <button className="px-btn px-primary" type="submit" disabled={sending}>
        {sending ? 'Gönderiliyor...' : 'Mesaj Gönder'}
      </button>
    </form>
  )
}
