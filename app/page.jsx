// app/page.jsx
import Link from "next/link"
import Image from "next/image"

export default function Home() {
  const phoneE164 = "+905511862221"
  const phonePretty = "+90 (551) 186 22 21"
  const mapsQuery = encodeURIComponent("Mimar Sinan Mah. Mimar Sinan Cad. No:23 D:2, Çekmeköy, İstanbul")

  return (
    <main className="px-landing">
      {/* ÜST MENÜ */}
      <header className="px-topbar">
        <div className="px-brand">
          <span className="px-logo">Nil Sucu</span>
          <span className="px-sub">Fizyoterapi Kliniği</span>
        </div>

        <nav className="px-nav">
          <a href="#giris">Giriş</a>
          <a href="#hakkinda">Hakkında</a>
          <a href="#iletisim">İletişim</a>
        </nav>

       <div className="px-actions">
  <Link href="/register" className="px-btn">Kayıt Ol</Link>
  <Link href="/login" className="px-btn px-primary">Giriş Yap</Link>
</div>

      </header>

      {/* GİRİŞ (HERO) */}
      <section id="giris" className="px-hero">
        <h1>Bilimsel ve kişiye özel fizyoterapi.</h1>
        <p>
          Nil Sucu ile ağrısız ve güçlü bir yaşama adım atın. Online randevu, uzman yaklaşım
          ve modern ekipmanlarla hizmetinizdeyiz.
        </p>
        <div className="px-cta">
          <Link href="/login" className="px-btn px-primary">Randevu Al</Link>
          <a href={`tel:${phoneE164}`} className="px-btn">Ara: {phonePretty}</a>
        </div>
      </section>

      {/* ÖNE ÇIKAN HİZMETLER */}
      <section className="px-section">
        <h2>Hizmetler</h2>
        <div className="px-grid">
          <Card title="Ortopedik Rehabilitasyon" text="Ameliyat sonrası ve spor yaralanmalarında fonksiyonel geri dönüş." />
          <Card title="Boyun & Bel Ağrısı" text="Manuel terapi, mobilizasyon ve egzersiz reçetesi." />
          <Card title="Duruş & Ofis Egzersizleri" text="Masa başı kaynaklı ağrılara özel program." />
        </div>
      </section>

      {/* HAKKINDA */}
      <section id="hakkinda" className="px-section">
        <h2>Hakkımızda</h2>
        <div className="px-about">
          <p>
            Nil Sucu; kanıta dayalı yaklaşımlar, kişiselleştirilmiş egzersiz planları ve
            teknoloji destekli takip sistemiyle iyileşme sürecinizi hızlandırır.
            Supabase tabanlı randevu sistemimizle tüm süreç şeffaf ve güvenli.
          </p>
          <ul className="px-bullets">
            <li>Uzman fizyoterapist</li>
            <li>Online randevu ve hatırlatma</li>
            <li>Takip &amp; ilerleme raporları</li>
          </ul>
        </div>
      </section>

      {/* İLETİŞİM — sadece kart kaldı */}
      <section id="iletisim" className="px-section">
        <h2>İletişim</h2>
        <div className="px-contact" style={{gridTemplateColumns:'1fr', maxWidth:900, margin:'0 auto'}}>
          <div className="px-card">
            <h3>Nil Sucu</h3>
            <p>
              📍{" "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mimar Sinan Mah. Mimar Sinan Cad. No:23 D:2, Çekmeköy / İstanbul
              </a>
            </p>
            <p>📞 <a href={`tel:${phoneE164}`}>{phonePretty}</a></p>
            <p>
              💬{" "}
              <a href={`https://wa.me/${phoneE164.replace("+", "")}`} target="_blank" rel="noopener noreferrer">
                WhatsApp üzerinden yazın
              </a>
            </p>
          
          </div>
        </div>
      </section>

      <footer className="px-footer">
        <p>© {new Date().getFullYear()} Nil Sucu • Tüm hakları saklıdır.</p>
      </footer>
    </main>
  )
}

function Card({ title, text }) {
  return (
    <div className="px-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
