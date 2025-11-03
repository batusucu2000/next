/* === Tema === */
:root{
  --bg:#FAF9F6; --panel:#fff; --line:#F0EDE7; --text:#1A1D29; --muted:#5D6477;
  --accent:#2563eb; --accent-light:#3B82F6;
  --gradient:linear-gradient(135deg,#2563eb 0%,#3B82F6 100%);
  --shadow:0 8px 32px rgba(0,0,0,0.08); --shadow-hover:0 12px 40px rgba(0,0,0,0.12);
  --radius:20px; --radius-sm:12px;
}

/* === Reset === */
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  background:var(--bg); color:var(--text);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  line-height:1.6; font-size:16px;
}

/* === Genel yerleşim === */
.px-container{max-width:1200px;margin:0 auto;padding:0 24px}
.px-landing{min-height:100svh;overflow-x:hidden}

/* === Topbar (site) === */
.px-topbar{position:sticky;top:0;z-index:50;backdrop-filter:saturate(180%) blur(12px);
  background:rgba(250,249,246,.92);border-bottom:1px solid var(--line);transition:.3s}
.px-topbar.scrolled{background:rgba(250,249,246,.98);box-shadow:0 4px 20px rgba(0,0,0,.06)}
.px-topbar-inner{display:flex;align-items:center;justify-content:space-between;height:80px;gap:32px}
.px-brand{display:flex;flex-direction:column}
.px-logo{font-weight:800;font-size:24px;letter-spacing:-.02em;background:var(--gradient);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.px-sub{font-size:12px;color:var(--muted);margin-top:2px;letter-spacing:.5px}

.px-nav{display:flex;gap:32px;align-items:center}
.px-nav a{font-size:15px;color:var(--muted);text-decoration:none;font-weight:500;position:relative;transition:color .2s}
.px-nav a:hover{color:var(--text)}
.px-nav a::after{content:'';position:absolute;bottom:-4px;left:0;width:0;height:2px;background:var(--gradient);transition:width .3s}
.px-nav a:hover::after{width:100%}

.px-actions{display:flex;gap:12px;align-items:center}

/* === Butonlar === */
.px-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border-radius:12px;
  background:var(--panel);color:var(--text);border:1.5px solid var(--line);font-weight:600;font-size:14px;gap:8px;cursor:pointer;transition:.3s}
.px-btn:hover{transform:translateY(-2px);box-shadow:var(--shadow-hover);border-color:var(--accent-light)}
.px-btn.px-primary{background:var(--gradient);color:#fff;border:none;box-shadow:0 4px 16px rgba(37,99,235,.3)}
.px-btn.px-primary:hover{box-shadow:0 6px 24px rgba(37,99,235,.4);transform:translateY(-2px)}

/* === Hero === */
.px-hero{padding:120px 0 80px;position:relative;overflow:hidden}
.px-hero::before{content:'';position:absolute;top:-50%;right:-20%;width:600px;height:600px;background:var(--gradient);opacity:.03;border-radius:50%}
.px-hero-content{max-width:680px;position:relative;z-index:2}
.px-hero h1{font-size:clamp(42px,5vw,64px);line-height:1.1;letter-spacing:-.03em;font-weight:800;
  background:linear-gradient(135deg,#1A1D29 0%,#2D3748 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.px-hero p{font-size:18px;color:var(--muted);line-height:1.7;margin:24px 0 32px;max-width:560px}
.px-cta{display:flex;gap:16px;align-items:center;flex-wrap:wrap}

/* === Görsel arkaplanlı hero === */
.px-hero-with-bg{padding:120px 0 80px;position:relative;overflow:hidden}
.px-hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;opacity:.18}
.px-hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(250,249,246,.90) 0%,rgba(250,249,246,.78) 100%);z-index:-1}

/* === Vurgular & Kartlar === */
.px-band{padding:60px 0;background:var(--panel);border-block:1px solid var(--line)}
.px-band-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.px-band-item{background:var(--bg);border:1px solid var(--line);border-radius:var(--radius);padding:32px 24px;text-align:center;position:relative;overflow:hidden;transition:.3s}
.px-band-item::before{content:'';position:absolute;top:0;left:0;width:100%;height:3px;background:var(--gradient);transform:scaleX(0);transition:transform .3s}
.px-band-item:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover)}
.px-band-item:hover::before{transform:scaleX(1)}
.px-band-item h3{font-size:18px;font-weight:700;margin-bottom:12px;color:var(--text)}
.px-band-item p{color:var(--muted);font-size:15px;line-height:1.6}

.px-section{padding:100px 0}
.px-section h2{font-size:clamp(32px,4vw,48px);font-weight:800;text-align:center;margin-bottom:48px;letter-spacing:-.02em}
.px-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:24px;margin-top:32px}
.px-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:32px;position:relative;overflow:hidden;transition:.3s}
.px-card::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;background:var(--gradient);transform:scaleY(0);transition:transform .3s}
.px-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover)}
.px-card:hover::before{transform:scaleY(1)}
.px-card h3{font-size:20px;font-weight:700;margin-bottom:12px}
.px-card p{color:var(--muted);line-height:1.6;font-size:15px}

/* === Hakkında === */
.px-about{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:48px;box-shadow:var(--shadow);position:relative}
.px-about::before{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background:var(--gradient);border-radius:var(--radius) var(--radius) 0 0}
.px-about p{margin-bottom:20px;line-height:1.7}
.px-about strong{font-weight:700}
.px-bullets{margin:24px 0;padding-left:24px;list-style:none}
.px-bullets li{position:relative;margin-bottom:12px;padding-left:28px;color:var(--muted);line-height:1.6}
.px-bullets li::before{content:'✓';position:absolute;left:0;top:0;color:var(--accent);font-weight:bold;background:var(--gradient);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

/* === İletişim === */
.px-contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:32px}
.px-contact .px-card{text-align:center}
.px-contact a{color:var(--muted);text-decoration:none;transition:color .2s}
.px-contact a:hover{color:var(--accent)}

/* === Footer === */
.px-footer{padding:60px 0;border-top:1px solid var(--line);background:var(--panel);text-align:center;color:var(--muted)}

/* === Auth (Login/Register) === */
.px-auth-container{min-height:100vh;display:grid;grid-template-columns:1fr;background:var(--bg)}
.px-auth-header{position:sticky;top:0;z-index:40;backdrop-filter:saturate(180%) blur(12px);
  background:rgba(250,249,246,.95);border-bottom:1px solid var(--line);padding:0 24px}
.px-auth-header-inner{display:flex;align-items:center;justify-content:space-between;height:72px;max-width:1200px;margin:0 auto}
.px-auth-main{display:grid;place-items:center;padding:40px 24px}
.px-auth-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:48px 40px;box-shadow:var(--shadow);width:100%;max-width:440px;position:relative}
.px-auth-card::before{content:'';position:absolute;top:0;left:0;width:100%;height:4px;background:var(--gradient);border-radius:var(--radius) var(--radius) 0 0}
.px-auth-title{font-size:32px;font-weight:800;text-align:center;margin-bottom:8px;background:linear-gradient(135deg,#1A1D29 0%,#2D3748 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.px-auth-subtitle{text-align:center;color:var(--muted);margin-bottom:32px;font-size:15px}

.px-form{display:flex;flex-direction:column;gap:20px}
.px-form-group{display:flex;flex-direction:column;gap:8px}
.px-form-label{font-weight:600;font-size:14px;color:var(--text);display:flex;align-items:center;gap:4px}
.px-form-label::after{content:'*';color:#EF4444}
.px-form-input{height:52px;padding:0 16px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);font-size:15px;transition:.3s;outline:none}
.px-form-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.1);background:var(--panel)}
.px-form-input::placeholder{color:#9CA3AF}
.px-form-helper{font-size:13px;color:var(--muted);margin-top:4px}

.px-alert{padding:16px;border-radius:12px;font-size:14px;font-weight:500;display:flex;align-items:flex-start;gap:12px;line-height:1.5}
.px-alert-error{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA}
.px-alert-icon{font-size:16px;flex-shrink:0;margin-top:1px}

.px-auth-btn{width:100%;height:52px;border:none;border-radius:12px;background:var(--gradient);color:#fff;font-weight:600;font-size:15px;
  cursor:pointer;transition:.3s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px}
.px-auth-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 25px rgba(37,99,235,.35)}
.px-auth-btn:disabled{opacity:.7;cursor:not-allowed}
.px-auth-footer{text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid var(--line)}
.px-auth-link{color:var(--accent);text-decoration:none;font-weight:600;transition:color .2s;background:none;border:none;font-size:14px;cursor:pointer;font-family:inherit}
.px-auth-link:hover{color:var(--accent-light);text-decoration:underline}

.px-spinner{width:18px;height:18px;border:2px solid transparent;border-top:2px solid currentColor;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* === Patients (layout) — masaüstü varsayılan === */
.pl-shell{height:100dvh;min-height:100dvh;background:#fff;color:#000;font-family:Arial,sans-serif;display:flex;flex-direction:column}
.pl-sticky{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #eee}
.pl-content{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;max-width:960px;width:100%;margin:0 auto;padding:16px}
.pl-welcome{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid #eaeaea;border-radius:10px;margin-bottom:12px;background:#fafafa}
.pl-welcome-text{font-size:16px}
.pl-main{padding:0}

/* Mobil sekmeler: default KAPALI (masaüstü asla gösterme) */
.pl-mobile-tabs{display:none !important;background:#fff}

/* === RESPONSIVE === */

/* Tablet/Küçük ekranlar (görsel bölümler) */
@media (max-width:1024px){
  .px-band-grid{grid-template-columns:1fr 1fr;gap:20px}
}

/* Telefon/küçük tablet: genel sayfalar */
@media (max-width:768px){
  .px-topbar-inner{height:70px}
  /* ÖNEMLİ: px-nav'ı genişliğe göre gizlemiyoruz (çift menüye sebep olmasın) */
  .px-hero{padding:100px 0 60px;text-align:center}
  .px-hero-content{margin:0 auto}
  .px-cta{justify-content:center}
  .px-band-grid{grid-template-columns:1fr}
  .px-grid{grid-template-columns:1fr}
  .px-section{padding:80px 0}
  .px-about{padding:32px 24px}
}

/* Küçük telefon detayları */
@media (max-width:480px){
  .px-container{padding:0 16px}
  .px-actions{display:none}
  .px-btn{height:48px;width:100%;max-width:280px}
  .px-cta{flex-direction:column}
  .px-auth-card{padding:32px 24px;margin:0 16px}
  .px-auth-title{font-size:28px}
  .px-auth-main{padding:24px 16px}
}

/* === SADECE GERÇEK MOBİL/TABLET (touch) için kurallar === */
@media (hover:none) and (pointer:coarse){
  /* Patients layout: tek sayfa hissi + mobil sekmeler AÇIK */
  body{overflow:hidden}
  .pl-content{max-width:none;padding:12px 12px}
  .pl-welcome{flex-direction:column;align-items:flex-start;gap:6px;padding:10px 12px}
  .pl-welcome-text{font-size:15px;line-height:1.35;word-break:break-word}
  .pl-mobile-tabs{display:block !important;border-top:1px solid #eee;border-bottom:1px solid #eee}
  .pl-tabs-scroll{display:flex;gap:18px;overflow-x:auto;white-space:nowrap;overscroll-behavior-inline:contain;
    -webkit-overflow-scrolling:touch;scrollbar-width:thin;padding:10px 14px;scroll-snap-type:x proximity;
    mask-image:linear-gradient(to right,rgba(0,0,0,0),rgba(0,0,0,1) 20px,rgba(0,0,0,1) calc(100% - 20px),rgba(0,0,0,0))}
  .pl-tabs-scroll::-webkit-scrollbar{height:6px}
  .pl-tabs-scroll::-webkit-scrollbar-thumb{background:#d0d0d0;border-radius:999px}
  .pl-tab{text-decoration:none;color:#111;font-weight:600;padding:10px 0;border-bottom:2px solid transparent;scroll-snap-align:start}
  .pl-tab.is-active{color:#2563eb;border-bottom-color:#2563eb}

  /* Patients/Book sayfasının eski sol boşluklarını sıfırla */
  .pl-content .px-container{padding-left:0 !important}
  .pl-content .px-page{width:100% !important}
  .pl-content .px-days-scroll{margin-left:0 !important}

  /* TopBar (patients) içindeki nav'ı MOBİLDE gizle → çift menü sorunu biter */
  .tb-wrap .topbar-nav,
  .tb-wrap nav{display:none !important}
}

/* === SADECE MOUSE/Fare (masaüstü) için güvenlik: mobil sekmeler hep kapalı === */
@media (hover:hover) and (pointer:fine){
  .pl-mobile-tabs{display:none !important}
  .tb-wrap .topbar-nav{display:flex !important}
}
