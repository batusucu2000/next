"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"

const YEAR = new Date().getFullYear()

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const phoneE164 = "+905511862221"
  const phonePretty = "+90 (551) 186 22 21"
  const mapsQuery = encodeURIComponent("Mimar Sinan Mah. Mimar Sinan Cad. No:23 D:2, Çekmeköy, İstanbul")

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <main className="px-landing">
      {/* ÜST MENÜ */}
      <header className={`px-topbar ${scrolled ? "scrolled" : ""}`}>
        <div className="px-container px-topbar-inner">
          <div className="px-brand">
            <span className="px-logo">Nil SEZGIN</span>
            <span className="px-sub">Fizyoterapi Kliniği</span>
          </div>

          <nav className="px-nav">
            <a href="#giris">Giriş</a>
            <a href="#hizmetler">Hizmetler</a>
            <a href="#hakkinda">Hakkında</a>
            <a href="#iletisim">İletişim</a>
          </nav>

          <div className="px-actions">
            <Link href="/register" className="px-btn">Kayıt Ol</Link>
            <Link href="/login" className="px-btn px-primary">Giriş Yap</Link>
          </div>
        </div>
      </header>

      {/* HERO - Görsel arkaplan */}
      <section id="giris" className="px-section px-hero-with-bg">
        {/* DİKKAT: klasörde `hero-bg.jpg.png` var, yolu buna göre düzeltildi */}
        <img
          src="/images/hero-bg.jpg.png"
          alt="Fizyoterapi tedavisi"
          className="px-hero-bg"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
        <div className="px-hero-overlay" />

        <div className="px-container">
          <div className="px-hero-content">
            <h1>Bilimsel ve kişiye özel fizyoterapi.</h1>
            <p>
              Nil Sezgin ile ağrısız, güçlü ve dengeli bir yaşama adım atın. Online randevu,
              uzman yaklaşım ve modern ekipmanlarla hizmetinizdeyiz.
            </p>
            <div className="px-cta">
              <Link href="/login" className="px-btn px-primary">
                <span>🎯</span> Randevu Al
              </Link>
              <a href={`tel:${phoneE164}`} className="px-btn">
                <span>📞</span> {phonePretty}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* VURGULAR BANDI */}
      <section className="px-band px-pattern-bg">
        <div className="px-container px-band-grid">
          <div className="px-band-item">
            <div className="px-card-icon">🎯</div>
            <h3>Kanıta Dayalı Yaklaşım</h3>
            <p>Değerlendirme → hedef → kişiye özel plan → ölçülebilir ilerleme.</p>
          </div>
          <div className="px-band-item">
            <div className="px-card-icon">🌿</div>
            <h3>Bütüncül Bakış</h3>
            <p>Manuel terapi, osteopatik bakış ve egzersiz tedavisini entegre eder.</p>
          </div>
          <div className="px-band-item">
            <div className="px-card-icon">💫</div>
            <h3>Şeffaf Süreç</h3>
            <p>Online randevu, hatırlatmalar ve net bilgilendirme.</p>
          </div>
        </div>
      </section>

      {/* HİZMETLER */}
      <section id="hizmetler" className="px-section px-pattern-bg">
        <div className="px-container">
          <h2>Uzmanlık Alanlarımız</h2>
          <p style={{
            textAlign: "center",
            color: "var(--muted)",
            maxWidth: "600px",
            margin: "0 auto 48px",
            fontSize: "18px",
            lineHeight: "1.6"
          }}>
            Modern fizyoterapi yöntemleriyle size özel çözümler sunuyoruz
          </p>

          <div className="px-grid">
            <ServiceCard icon="🦴" title="Ortopedik Rehabilitasyon" text="Ameliyat sonrası ve spor yaralanmalarında fonksiyonel geri dönüş." />
            <ServiceCard icon="🧠" title="Nörolojik Rehabilitasyon" text="Nörolojik durumlarda günlük yaşam fonksiyonlarını artırmaya yönelik programlar." />
            <ServiceCard icon="⚽" title="Sporcu Sağlığı & Rehabilitasyon" text="Sakatlanma sonrası saha dönüşü ve performans odaklı iyileşme." />
            <ServiceCard icon="👐" title="Manuel Terapi & Osteopatik Yaklaşımlar" text="Eklemsel mobilizasyon, yumuşak doku teknikleri ve osteopatik değerlendirme." />
            <ServiceCard icon="🧘" title="Klinik Pilates" text="Çekirdek stabilizasyonu ve postür odaklı klinik pilates seansları." />
            <ServiceCard icon="🌸" title="Pelvik Taban Sağlığı" text="Pelvik taban değerlendirmesi ve kişisel güçlendirme programları." />
            <ServiceCard icon="📊" title="Postür Analizi" text="Duruş bozukluklarının tespiti ve düzeltici egzersiz planları." />
            <ServiceCard icon="💪" title="Bireysel Egzersiz Programları" text="Hedeflerinize ve günlük rutininize uygun egzersiz reçeteleri." />
          </div>
        </div>
      </section>

      {/* HAKKINDA */}
      <section id="hakkinda" className="px-section">
        <div className="px-container">
          <h2>Hakkımda</h2>
          <div className="px-about">
            <div className="px-about-grid">
              <div>
                <p>
                  Merhaba, ben <strong>Fizyoterapist Nil Sezgin</strong>. 2021 yılında Karabük Üniversitesi Fizyoterapi ve
                  Rehabilitasyon Bölümü'nden mezun oldum. Mezuniyetten bu yana, insan vücudunun hareket kapasitesini,
                  dengesini ve fonksiyonel gücünü korumaya odaklanan bir anlayışla fizyoterapi alanında aktif olarak
                  hizmet veriyorum.
                </p>
                <p>
                  Mesleki vizyonum; yalnızca mevcut ağrı ve kısıtlılıkları gidermek değil, danışanlarımın yaşam kalitesini
                  artırarak <strong>uzun vadeli bir sağlık bilinci</strong> kazanmalarını sağlamaktır. Bu doğrultuda
                  Osteopati eğitiminin ikinci yılındayım ve edindiğim <strong>bütüncül yaklaşımı</strong>, kliniğimdeki tedavi
                  süreçlerine entegre ediyorum.
                </p>
                <p>
                  <strong>İstanbul Çekmeköy Mimar Sinan Mahallesi</strong>'nde yer alan kliniğimizde modern fizyoterapi
                  yöntemleri ile kişiye özel değerlendirme ve tedavi programları sunuyoruz:
                </p>
                <ul className="px-bullets">
                  <li>Ortopedik ve nörolojik rehabilitasyon</li>
                  <li>Sporcu sağlığı, manuel terapi ve osteopatik yaklaşımlar</li>
                  <li>Klinik pilates ve pelvik taban sağlığı</li>
                  <li>Postür analizi ve duruş bozukluklarının tedavisi</li>
                  <li>Bireysel egzersiz programları</li>
                </ul>
                <p>
                  Her bireyin ihtiyaçları farklıdır; her danışanı bütüncül bir yaklaşımla değerlendiriyor,
                  hem bedensel hem de fonksiyonel açıdan <strong>en etkili çözümleri</strong> hedefliyoruz.
                </p>
              </div>

              {/* Sağ görsel: Next/Image ile */}
              <div className="px-image-hover px-about-photo">
                <Image
                  src="/images/therapy-2.jpg"
                  alt="Fizyoterapi seansı"
                  fill
                  priority
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* İLETİŞİM */}
      <section id="iletisim" className="px-section px-pattern-bg">
        <div className="px-container">
          <h2>İletişim</h2>
          <p style={{ textAlign: "center", color: "var(--muted)", maxWidth: "500px", margin: "0 auto 48px", fontSize: "18px" }}>
            Size nasıl yardımcı olabiliriz? Hemen iletişime geçin.
          </p>

          <div className="px-contact">
            <div className="px-card px-card-with-image">
              <h3>📍 Konum</h3>
              <p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mimar Sinan Mah. Mimar Sinan Cad. No:23 D:2<br />
                  Çekmeköy / İstanbul
                </a>
              </p>
            </div>
            <div className="px-card px-card-with-image">
              <h3>📞 Telefon</h3>
              <p><a href={`tel:${phoneE164}`}>{phonePretty}</a></p>
            </div>
            <div className="px-card px-card-with-image">
              <h3>💬 WhatsApp</h3>
              <p>
                <a href={`https://wa.me/${phoneE164.replace("+", "")}`} target="_blank" rel="noopener noreferrer">
                  Hemen Yazın
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-footer">
        <div className="px-container">
          <p>© {YEAR} Nil Sezgin Fizyoterapi Kliniği • Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </main>
  )
}

function ServiceCard({ icon, title, text }) {
  return (
    <div className="px-card px-card-with-image">
      <div className="px-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
