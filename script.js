/* =========================================================
   PORTOFOLIO "DESIGNER ➜ CODER" — script.js
   Interaksi: tema (auto/gelap/terang), warna aksen, menu mobile,
   kartu "Desain ⇄ Code", reveal saat scroll, filter karya.
   ========================================================= */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function simpan(kunci, nilai) {
    try { localStorage.setItem(kunci, nilai); } catch (e) { /* mode privat: abaikan */ }
  }
  function ambil(kunci) {
    try { return localStorage.getItem(kunci); } catch (e) { return null; }
  }

  /* ---------------------------------------------------------
     1b. EFEK SUARA (Web Audio API)
     Blip halus saat klik ikon/tombol, tick tipis saat kursor
     masuk kartu, dan sweep lembut saat pindah section.
     Semua nada dibangkitkan di browser — tanpa file audio.
     --------------------------------------------------------- */
  var soundToggle = document.getElementById('soundToggle');
  var soundIcon = document.getElementById('soundIcon');
  var soundText = document.getElementById('soundText');
  var suaraAktif = ambil('porto-sound') !== 'off'; /* default: nyala */
  var audioCtx = null;
  var sectionAktifTerakhir = null;
  var waktuHoverTerakhir = 0;

  function ctxAudio() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  /* satu nada pendek dengan amplop lembut biar tidak "kasar" */
  function nada(o) {
    var ctx = ctxAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    var dur = o.dur || 0.1;
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqKe) osc.frequency.exponentialRampToValueAtTime(o.freqKe, t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.vol || 0.05, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  var SUARA = {
    klik:  function () { nada({ freq: 880, freqKe: 1320, dur: .09, vol: .05 }); },
    hover: function () { nada({ freq: 1560, dur: .035, vol: .012 }); },
    nyala: function () {
      nada({ freq: 660, dur: .09, vol: .05 });
      nada({ freq: 990, dur: .12, vol: .045, delay: .07 });
    },
    mati:  function () { nada({ freq: 620, freqKe: 320, dur: .14, vol: .05 }); },
    geser: function () { nada({ freq: 520, freqKe: 900, dur: .17, vol: .02, type: 'triangle' }); }
  };

  function bunyi(nama) {
    if (!suaraAktif) return;
    var f = SUARA[nama];
    if (f) f();
  }

  function terapkanSuara() {
    if (soundIcon) soundIcon.textContent = suaraAktif ? '🔊' : '🔇';
    if (soundText) soundText.textContent = suaraAktif ? 'Suara' : 'Bisu';
    if (soundToggle) {
      soundToggle.classList.toggle('is-off', !suaraAktif);
      soundToggle.setAttribute('aria-pressed', String(suaraAktif));
      soundToggle.setAttribute('aria-label', suaraAktif ? 'Matikan efek suara' : 'Nyalakan efek suara');
    }
  }
  terapkanSuara();

  /* iOS/Safari baru mengizinkan audio setelah ada interaksi user */
  function bukaAudio() {
    var ctx = ctxAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', bukaAudio, { passive: true });
  window.addEventListener('keydown', bukaAudio);

  if (soundToggle) {
    soundToggle.addEventListener('click', function () {
      suaraAktif = !suaraAktif;
      simpan('porto-sound', suaraAktif ? 'on' : 'off');
      terapkanSuara();
      bukaAudio();
      if (suaraAktif) bunyi('nyala'); else SUARA.mati();
    });
  }

  /* klik pada ikon, tombol, atau link */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a, button, .switcher__dot') : null;
    if (!el || el === soundToggle) return;
    bunyi('klik');
  });

  /* tick tipis saat kursor masuk elemen interaktif (khusus perangkat berkursor) */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var sedangHover = null;
    document.addEventListener('pointerover', function (e) {
      var el = e.target && e.target.closest
        ? e.target.closest('.btn, .work, .service, .bento__card, .minicard, .filter, .nav__menu a, .switcher__dot, .theme, .totop, .contact__list a, .floatchip')
        : null;
      if (!el || el === sedangHover) return;
      var kini = new Date().getTime();
      if (kini - waktuHoverTerakhir < 70) return;
      sedangHover = el;
      waktuHoverTerakhir = kini;
      bunyi('hover');
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      if (sedangHover && !sedangHover.contains(e.relatedTarget)) sedangHover = null;
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     1. MODE TAMPILAN: Auto ➜ Terang ➜ Gelap
     --------------------------------------------------------- */
  var themeToggle = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var themeText = document.getElementById('themeText');
  var metaTema = document.querySelectorAll('meta[name="theme-color"]');

  var URUTAN = ['auto', 'light', 'dark'];
  var LABEL = {
    auto:  { ikon: '◐', teks: 'Auto',  aria: 'Mode tampilan: ikut sistem. Klik untuk ganti.' },
    light: { ikon: '☀', teks: 'Terang', aria: 'Mode tampilan: terang. Klik untuk ganti.' },
    dark:  { ikon: '☾', teks: 'Gelap',  aria: 'Mode tampilan: gelap. Klik untuk ganti.' }
  };

  function temaSekarang() {
    var t = root.getAttribute('data-theme');
    return URUTAN.indexOf(t) > -1 ? t : 'auto';
  }

  function terapkanTema(nama) {
    if (nama === 'auto') {
      root.setAttribute('data-theme', 'auto');
    } else {
      root.setAttribute('data-theme', nama);
    }
    var info = LABEL[nama];
    if (themeIcon) themeIcon.textContent = info.ikon;
    if (themeText) themeText.textContent = info.teks;
    if (themeToggle) themeToggle.setAttribute('aria-label', info.aria);
    perbaruiWarnaBarStatus(nama);
    simpan('porto-theme', nama);
  }

  /* warna address bar mengikuti tema (iOS Safari / Android) */
  function perbaruiWarnaBarStatus(nama) {
    if (!metaTema.length) return;
    var gelapSistem = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var gelap = nama === 'dark' || (nama === 'auto' && gelapSistem);

    /* JS mengambil alih meta theme-color, jadi media query-nya dilepas */
    metaTema[0].removeAttribute('media');
    metaTema[0].setAttribute('content', gelap ? '#07050f' : '#f6f4ff');
    for (var i = 1; i < metaTema.length; i++) {
      metaTema[i].parentNode.removeChild(metaTema[i]);
    }
  }

  terapkanTema(temaSekarang());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var lanjut = URUTAN[(URUTAN.indexOf(temaSekarang()) + 1) % URUTAN.length];
      terapkanTema(lanjut);
    });
  }

  /* ikut berubah kalau user ganti tema OS saat masih mode Auto */
  var mediaGelap = window.matchMedia('(prefers-color-scheme: dark)');
  var onMediaChange = function () { if (temaSekarang() === 'auto') perbaruiWarnaBarStatus('auto'); };
  if (mediaGelap.addEventListener) mediaGelap.addEventListener('change', onMediaChange);
  else if (mediaGelap.addListener) mediaGelap.addListener(onMediaChange);

  /* ---------------------------------------------------------
     2. GANTI WARNA AKSEN
     --------------------------------------------------------- */
  var dotAksen = document.querySelectorAll('.switcher__dot');

  function setAksen(nama) {
    root.setAttribute('data-accent', nama);
    dotAksen.forEach(function (dot) {
      var aktif = dot.dataset.accent === nama;
      dot.classList.toggle('is-active', aktif);
      dot.setAttribute('aria-pressed', String(aktif));
    });
    simpan('porto-accent', nama);
  }

  var aksenTersimpan = ambil('porto-accent');
  setAksen(aksenTersimpan || root.getAttribute('data-accent') || 'pink');

  dotAksen.forEach(function (dot) {
    dot.addEventListener('click', function () { setAksen(dot.dataset.accent); });
  });

  /* ---------------------------------------------------------
     3. MENU MOBILE
     --------------------------------------------------------- */
  var burger = document.getElementById('burger');
  var navMenu = document.getElementById('navMenu');

  function tutupMenu() {
    if (!navMenu || !burger) return;
    navMenu.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Buka menu');
  }

  if (burger && navMenu) {
    burger.addEventListener('click', function () {
      var terbuka = !navMenu.classList.contains('is-open');
      navMenu.classList.toggle('is-open', terbuka);
      burger.classList.toggle('is-open', terbuka);
      burger.setAttribute('aria-expanded', String(terbuka));
      burger.setAttribute('aria-label', terbuka ? 'Tutup menu' : 'Buka menu');
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', tutupMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') tutupMenu();
    });
  }

  /* ---------------------------------------------------------
     4. KARTU "DESAIN ⇄ CODE"
     --------------------------------------------------------- */
  var modeCard = document.getElementById('modeCard');
  var modeToggle = document.getElementById('modeToggle');
  var modeLabel = document.getElementById('modeLabel');
  var modeHint = document.getElementById('modeHint');

  var TEKS_HINT = {
    desain: 'Aku mulai dari grid, warna, dan tipografi — lalu semua itu aku bangun ulang jadi kode.',
    code: 'Hasil akhirnya: HTML, CSS, dan JavaScript yang rapi — desainnya tetap sama, tapi sekarang hidup.'
  };

  function setMode(code) {
    if (!modeCard) return;
    modeCard.classList.toggle('is-code', code);
    if (modeToggle) modeToggle.setAttribute('aria-pressed', String(code));
    if (modeLabel) modeLabel.textContent = code ? 'Mode: Code' : 'Mode: Desain';
    if (modeHint) modeHint.textContent = code ? TEKS_HINT.code : TEKS_HINT.desain;
  }

  if (modeToggle && modeCard) {
    modeToggle.addEventListener('click', function () {
      setMode(!modeCard.classList.contains('is-code'));
    });
  }

  /* ---------------------------------------------------------
     5. PROGRESS BAR, NAVBAR, LINK AKTIF, TOMBOL KE ATAS
     --------------------------------------------------------- */
  var progressBar = document.getElementById('progressBar');
  var nav = document.getElementById('nav');
  var toTop = document.getElementById('toTop');
  var sections = document.querySelectorAll('main section[id]');
  var navLinks = document.querySelectorAll('.nav__menu a[href^="#"]');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var jarak = document.documentElement.scrollHeight - window.innerHeight;

    if (progressBar) progressBar.style.width = (jarak > 0 ? (y / jarak) * 100 : 0) + '%';
    if (nav) nav.classList.toggle('is-stuck', y > 8);
    if (toTop) toTop.classList.toggle('is-visible', y > 620);

    var idAktif = '';
    sections.forEach(function (section) {
      if (y >= section.offsetTop - 150) idAktif = section.id;
    });

    /* sweep lembut tiap kali masuk section baru */
    if (idAktif && idAktif !== sectionAktifTerakhir) {
      if (sectionAktifTerakhir !== null) bunyi('geser');
      sectionAktifTerakhir = idAktif;
    }

    navLinks.forEach(function (link) {
      var aktif = link.getAttribute('href') === '#' + idAktif;
      link.classList.toggle('is-active', aktif);
      if (aktif) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------
     6. ANIMASI MUNCUL SAAT SCROLL + ISI BAR SKILL
     --------------------------------------------------------- */
  var itemReveal = document.querySelectorAll('.reveal');
  var semuaBar = document.querySelectorAll('.bar');
  var meter = document.querySelector('.meter__track i');

  function isiBar(bar) {
    var isi = bar.querySelector('i');
    if (isi) isi.style.width = bar.dataset.level + '%';
  }

  function isiMeter() {
    if (!meter) return;
    var nilai = meter.style.getPropertyValue('--split') || '62%';
    meter.style.width = nilai.trim();
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    itemReveal.forEach(function (el) { el.classList.add('is-in'); });
    semuaBar.forEach(isiBar);
    isiMeter();
  } else {
    var pengamat = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry, index) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        setTimeout(function () { el.classList.add('is-in'); }, index * 70);

        if (el.classList.contains('bar')) {
          setTimeout(function () { isiBar(el); }, 180);
        }
        if (el.classList.contains('meter')) {
          setTimeout(isiMeter, 200);
        }
        obs.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.reveal, .bar, .meter').forEach(function (el) { pengamat.observe(el); });
  }

  /* ---------------------------------------------------------
     7. FILTER KATEGORI KARYA
     --------------------------------------------------------- */
  var tombolFilter = document.querySelectorAll('.filter');
  var daftarKarya = document.querySelectorAll('.work');
  var karyaKosong = document.getElementById('worksEmpty');

  tombolFilter.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var kategori = btn.dataset.filter;
      var tampil = 0;

      tombolFilter.forEach(function (lain) {
        var aktif = lain === btn;
        lain.classList.toggle('is-active', aktif);
        lain.setAttribute('aria-selected', String(aktif));
      });

      daftarKarya.forEach(function (item) {
        var cocok = kategori === 'all' || item.dataset.cat === kategori;
        item.classList.toggle('is-hidden', !cocok);
        if (cocok) {
          tampil++;
          if (reduceMotion) { item.classList.add('is-in'); return; }
          item.classList.remove('is-in');
          void item.offsetWidth; /* paksa reflow supaya animasi ulang */
          item.classList.add('is-in');
        }
      });

      if (karyaKosong) karyaKosong.hidden = tampil > 0;
    });
  });

  /* ---------------------------------------------------------
     8. SOROT KARTU MENGIKUTI KURSOR (micro-interaction)
     --------------------------------------------------------- */
  var kartuSorot = document.querySelectorAll('.work, .service, .bento__card, .minicard');

  kartuSorot.forEach(function (kartu) {
    kartu.addEventListener('pointermove', function (e) {
      var kotak = kartu.getBoundingClientRect();
      kartu.style.setProperty('--mx', (e.clientX - kotak.left) + 'px');
      kartu.style.setProperty('--my', (e.clientY - kotak.top) + 'px');
    });
  });

  /* ---------------------------------------------------------
     8b. GALERI KARYA (lightbox)
     Klik kartu seri -> foto seri itu terbuka dan bisa dilihat
     satu per satu: tombol ‹ ›, thumbnail, tombol panah, atau geser.
     --------------------------------------------------------- */
  var lightbox = document.getElementById('lightbox');
  var lbImg = document.getElementById('lightboxImg');
  var lbJudul = document.getElementById('lightboxTitle');
  var lbHitung = document.getElementById('lightboxCount');
  var lbThumbs = document.getElementById('lightboxThumbs');
  var lbPrev = document.getElementById('lightboxPrev');
  var lbNext = document.getElementById('lightboxNext');
  var lbClose = document.getElementById('lightboxClose');
  var lbHint = document.getElementById('lightboxHint');
  var lbStage = document.getElementById('lightboxStage');
  var foto = [];
  var fotoAktif = 0;
  var pemicuTerakhir = null;
  var geserMulai = null;

  function tampilkanFoto(n, langsung) {
    if (!foto.length) return;
    if (langsung) fotoAktif = n;
    else fotoAktif = (fotoAktif + n + foto.length) % foto.length;

    lbImg.classList.remove('is-loaded');
    lbImg.src = foto[fotoAktif].src;
    lbImg.alt = foto[fotoAktif].alt;
    lbHitung.textContent = (fotoAktif + 1) + ' / ' + foto.length;
    lbThumbs.querySelectorAll('button').forEach(function (b, idx) {
      b.classList.toggle('is-active', idx === fotoAktif);
    });
  }

  lbImg.addEventListener('load', function() { lbImg.classList.add('is-loaded'); });
  lbImg.addEventListener('error', function() {
    lbImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="12" fill="white">Gagal memuat gambar</text></svg>';
  });

  function bukaGaleri(tombol) {
    var daftar = (tombol.dataset.foto || '').split('|').filter(function (src) {
      return src && src.trim();
    });
    if (!daftar.length) return;

    var kartu = tombol.closest('.work');
    var judulKartu = kartu ? kartu.querySelector('.work__body h3') : null;
    var altKartu = kartu ? kartu.querySelector('.work__img img') : null;
    var altDasar = (altKartu && altKartu.alt) ? altKartu.alt : 'Karya';

    foto = daftar.map(function (src, n) {
      return { src: src.trim(), alt: altDasar + ' — foto ' + (n + 1) };
    });

    lbJudul.textContent = tombol.dataset.judul || (judulKartu ? judulKartu.textContent : 'Karya');
    lbThumbs.innerHTML = '';

    foto.forEach(function (f, n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Lihat foto ' + (n + 1));
      var im = document.createElement('img');
      im.src = f.src;
      im.alt = '';
      im.loading = 'lazy';
      im.decoding = 'async';
      b.appendChild(im);
      b.addEventListener('click', function () {
        bunyi('klik');
        tampilkanFoto(n, true);
      });
      lbThumbs.appendChild(b);
    });

    var banyak = foto.length > 1;
    lbThumbs.hidden = !banyak;
    lbPrev.hidden = !banyak;
    lbNext.hidden = !banyak;
    if (lbHint) lbHint.hidden = !banyak;

    tampilkanFoto(0, true);

    pemicuTerakhir = tombol;
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(function () { lightbox.classList.add('is-open'); });
    lbClose.focus();
  }

  function tutupGaleri() {
    if (lightbox.hidden) return;
    lightbox.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    window.setTimeout(function () {
      lightbox.hidden = true;
      lbImg.removeAttribute('src');
      lbImg.classList.remove('is-loaded');
      if (pemicuTerakhir) pemicuTerakhir.focus();
    }, reduceMotion ? 0 : 300);
  }

  document.querySelectorAll('.work__open').forEach(function (tombol) {
    tombol.addEventListener('click', function () { bukaGaleri(tombol); });
  });

  if (lightbox) {
    if (lbClose) lbClose.addEventListener('click', tutupGaleri);
    if (lbPrev) lbPrev.addEventListener('click', function () { bunyi('klik'); tampilkanFoto(-1); });
    if (lbNext) lbNext.addEventListener('click', function () { bunyi('klik'); tampilkanFoto(1); });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target === lbStage) tutupGaleri();
    });

    /* Focus trap & keyboard navigation */
    lightbox.addEventListener('keydown', function (e) {
      var focusable = lightbox.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }

      if (e.key === 'Escape') { tutupGaleri(); }
      else if (e.key === 'ArrowRight') { bunyi('geser'); tampilkanFoto(1); }
      else if (e.key === 'ArrowLeft') { bunyi('geser'); tampilkanFoto(-1); }
    });

    if (lbStage) {
      lbStage.addEventListener('touchstart', function (e) {
        geserMulai = e.touches.length === 1
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
          : null;
      }, { passive: true });

      lbStage.addEventListener('touchend', function (e) {
        if (!geserMulai) return;
        var dx = e.changedTouches[0].clientX - geserMulai.x;
        var dy = e.changedTouches[0].clientY - geserMulai.y;
        geserMulai = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
          bunyi('geser');
          tampilkanFoto(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
    }
  }

  /* ---------------------------------------------------------
     9. TOMBOL DOWNLOAD CV
     --------------------------------------------------------- */
  var tombolCv = document.querySelector('[data-cv]');
  if (tombolCv) {
    tombolCv.addEventListener('click', function (e) {
      var href = tombolCv.getAttribute('href');
      if (!href || href === '#') {
        e.preventDefault();
        alert('Taruh file CV kamu di folder ini dengan nama "cv.pdf",\n' +
              'lalu ubah href tombol Download CV di index.html menjadi "cv.pdf".');
      }
    });
  }

  /* ---------------------------------------------------------
     10. TAHUN DI FOOTER
     --------------------------------------------------------- */
  var tahun = document.getElementById('year');
  if (tahun) tahun.textContent = new Date().getFullYear();
})();
