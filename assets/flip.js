(function () {
  'use strict';

  var D;
  try { D = JSON.parse(document.getElementById('kitap-veri').textContent); } catch (e) { return; }
  if (!window.St || !window.St.PageFlip) { var y0 = document.getElementById('yukleniyor'); if (y0) y0.textContent = 'Kitap görünümü bu cihazda açılamadı.'; return; }

  var NO = (D.no < 10 ? '0' : '') + D.no;
  var K_POS = 'hk:gorunum:' + NO;
  var N = D.adet, imgs = [], pf = null, cur = 0, hazir = false, nesil = 0, mesgul = false, asil = 0;
  var ONCE = 2, SONRA = 5;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sessiz */ } }
  function $(id) { return document.getElementById(id); }
  function pad(i) { return (i < 10 ? '00' : i < 100 ? '0' : '') + i; }

  var sahne = $('sahne'), kitap = null, elems = [], modCift = false, modPw = 0, rt = null;

  /* ---------- sayfalar ve tembel yükleme ---------- */

  function yukle(i) {
    var im = imgs[i];
    if (!im || im.getAttribute('src')) return;
    im.src = D.yol + pad(i + 1) + '.jpg';
  }
  function yakinYukle(c) {
    for (var j = c - ONCE; j <= c + SONRA; j++) yukle(j);
  }

  /* ---------- durum ---------- */

  function landscape() { return !!pf && pf.getOrientation() === 'landscape'; }
  function gorunen(c) {
    if (landscape() && c > 0 && c + 1 < N) return [c, c + 1];
    return [c];
  }
  function durum() {
    var g = gorunen(cur), t = g.length > 1 ? (g[0] + 1) + '–' + (g[1] + 1) : String(g[0] + 1);
    $('sayfa-no').textContent = 'Sayfa ' + t + ' / ' + N;
    var bitti = g[g.length - 1] + 1;
    $('cubuk-i').style.width = (bitti / N * 100) + '%';
  }
  function git(c) {
    cur = c;
    if (gorunen(c).indexOf(asil) < 0) asil = c;
    yakinYukle(c);
    durum();
    if (hazir) lsSet(K_POS, String(c));
  }
  function sesCal() { if (window.HkSes) window.HkSes.cal(); }

  /* ---------- kitap ---------- */

  /* Sayfa boyutu sabit verilir: tek sayfada kıvrılan sayfanın sol kenarı ekranın içinde kalır,
     parmak o kenarı geçince sayfa çevrilir (kütüphane bu eşiği sayfanın sol kenarına koyar). */
  function olcu() {
    var aw = sahne.clientWidth, ah = sahne.clientHeight - 16, oran = D.w / D.h;
    var ph = Math.floor(ah * oran), pw;
    if (aw >= 700 && aw > ah) pw = Math.min(Math.floor(aw / 2), ph);
    else pw = Math.min(aw - 2 * Math.max(14, Math.round(aw * 0.05)), ph);
    pw = Math.max(pw, 120);
    return { aw: aw, ah: ah, pw: pw, ph: Math.round(pw / oran), cift: aw >= 2 * pw };
  }

  function kur(start) {
    var o = olcu();
    modCift = o.cift;
    modPw = o.pw;
    mesgul = false;
    var nz = ++nesil;
    kitap = document.createElement('div');
    kitap.id = 'kitap';
    sahne.insertBefore(kitap, sahne.firstChild);
    elems = [];
    imgs = [];
    for (var i = 0; i < N; i++) {
      var d = document.createElement('div');
      d.className = 'sf';
      if (i === 0) d.setAttribute('data-density', 'hard');
      var im = document.createElement('img');
      im.alt = 'Sayfa ' + (i + 1);
      im.draggable = false;
      im.decoding = 'async';
      im.addEventListener('load', function () { this.className = 'y'; });
      d.appendChild(im);
      kitap.appendChild(d);
      elems.push(d);
      imgs.push(im);
    }
    cur = start;
    asil = start;
    var p = pf = new window.St.PageFlip(kitap, {
      width: o.pw, height: o.ph, size: 'fixed',
      showCover: true, usePortrait: true, startPage: start, drawShadow: true, maxShadowOpacity: 0.55,
      flippingTime: 800, swipeDistance: 30, mobileScrollSupport: false, clickEventForward: false, showPageCorners: true,
      useMouseEvents: true, autoSize: false, startZIndex: 0
    });
    p.loadFromHTML(elems);
    p.on('init', function () {
      if (nz !== nesil) return;
      hazir = true;
      git(p.getCurrentPageIndex());
      var y = $('yukleniyor'); if (y) y.parentNode.removeChild(y);
      document.documentElement.setAttribute('data-hazir', String(N));
    });
    p.on('flip', function (e) { if (nz === nesil) git(e.data); });
    p.on('changeOrientation', function () { if (nz === nesil) durum(); });
    p.on('changeState', function (e) {
      if (nz !== nesil) return;
      if (e.data === 'flipping') sesCal();
      plegi = e.data === 'user_fold';
      mesgul = e.data === 'flipping' || e.data === 'user_fold';
    });
    imgs.forEach(function (im, i) { if (yuklu[i]) yukle(i); });
    yakinYukle(start);
  }

  var yuklu = {}, plegi = false, tp = null;
  var saved = parseInt(lsGet(K_POS), 10);
  kur((saved >= 0 && saved < N) ? saved : 0);

  function yenidenKur() {
    if (!hazir) return;
    var o = olcu();
    if (o.cift === modCift && Math.abs(o.pw - modPw) <= modPw * 0.15) {
      try { pf.update(); } catch (e) { /* sessiz */ }
      return;
    }
    if (mesgul) { boyutDegisti(); return; }
    var c = asil, eski = pf;
    nesil++;
    try { eski.getRender().stopped = true; eski.destroy(); } catch (e) { /* sessiz */ }
    if (kitap && kitap.parentNode) kitap.parentNode.removeChild(kitap);
    for (var i = 0; i < imgs.length; i++) if (imgs[i].getAttribute('src')) yuklu[i] = true;
    hazir = false;
    kur(c);
  }
  function boyutDegisti() { clearTimeout(rt); rt = setTimeout(yenidenKur, mesgul ? 400 : 200); }
  if (window.ResizeObserver) new window.ResizeObserver(boyutDegisti).observe(sahne);
  window.addEventListener('resize', boyutDegisti);
  window.addEventListener('orientationchange', boyutDegisti);

  /* ---------- dokunma ve sürükleme ---------- */

  /* Kütüphane çok kısa dokunuşları (250 ms altı) çevirme saymaz; kısa dokunuşu burada çeviriyoruz.
     Sürüklenen sayfa bırakıldığında (kıvrılma ya da geri dönüş) kâğıt sesi çalar. */
  function bitisSesi() { if (plegi) { plegi = false; sesCal(); } }
  window.addEventListener('mouseup', bitisSesi, true);
  window.addEventListener('touchend', bitisSesi, true);

  sahne.addEventListener('touchstart', function (ev) {
    if (ev.touches.length !== 1) { tp = null; return; }
    var t = ev.touches[0];
    tp = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true, capture: true });
  sahne.addEventListener('touchend', function (ev) {
    var b = tp; tp = null;
    if (!b || !pf || ev.touches.length) return;
    var t = ev.changedTouches[0];
    if (Date.now() - b.t >= 240 || Math.abs(t.clientX - b.x) > 10 || Math.abs(t.clientY - b.y) > 10) return;
    var r = sahne.getBoundingClientRect(), k = landscape() ? r.left + r.width / 2 : null;
    if (k === null) {
      var items = kitap.querySelectorAll('.stf__item'), L = 1e9, W = 0;
      Array.prototype.forEach.call(items, function (e) {
        if (getComputedStyle(e).display === 'none') return;
        var q = e.getBoundingClientRect();
        if (q.width > 0 && q.left < L) { L = q.left; W = q.width; }
      });
      k = L + W * 0.4;
    }
    var kose = t.clientY < r.top + r.height / 2 ? 'top' : 'bottom';
    if (t.clientX < k) pf.flipPrev(kose); else pf.flipNext(kose);
  }, { passive: true, capture: true });

  /* ---------- klavye ---------- */

  document.addEventListener('keydown', function (ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (!$('zoom').hidden) { if (ev.key === 'Escape') kapat(); return; }
    var k = ev.key, onBtn = ev.target && ev.target.closest && ev.target.closest('button,a');
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !onBtn)) { ev.preventDefault(); pf.flipNext(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); pf.flipPrev(); }
    else if (k === 'Home') { ev.preventDefault(); sesCal(); pf.turnToPage(0); git(pf.getCurrentPageIndex()); }
    else if (k === 'End') { ev.preventDefault(); sesCal(); pf.turnToPage(N - 1); git(pf.getCurrentPageIndex()); }
  });

  /* ---------- ses düğmesi ---------- */

  function sesUI() {
    var a = window.HkSes ? window.HkSes.acik() : false, b = $('btn-ses');
    b.setAttribute('aria-pressed', a ? 'true' : 'false');
    $('ses-yazi').textContent = a ? 'Ses: Açık' : 'Ses: Kapalı';
  }
  $('btn-ses').addEventListener('click', function () {
    if (window.HkSes) window.HkSes.ayarla(!window.HkSes.acik());
    sesUI();
  });
  if (window.HkSes && window.HkSes.degisince) window.HkSes.degisince(sesUI);
  sesUI();

  /* ---------- geri ---------- */

  $('btn-geri').addEventListener('click', function (ev) {
    var ayni = false;
    try { ayni = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1; } catch (e) { /* sessiz */ }
    if (ayni) { ev.preventDefault(); history.back(); }
  });

  /* ---------- büyüt ---------- */

  /* Yakınlaştırma uygulama içindedir (tarayıcı zoom'u kapalı): sayfa genişliğe sığar, + / − ya da dokunuşla büyür, büyükken kaydırılır.
     Pencere açılınca bir geçmiş girdisi eklenir; Android geri tuşu yalnız pencereyi kapatır. */
  var zoom = $('zoom'), zkap = $('zoom-kap'), ZS = [1, 1.5, 2, 3], zi = 0, itildi = false;
  function zoomUygula(yeni) {
    yeni = Math.max(0, Math.min(ZS.length - 1, yeni));
    var ox = zkap.scrollWidth ? (zkap.scrollLeft + zkap.clientWidth / 2) / zkap.scrollWidth : 0.5;
    var oy = zkap.scrollHeight ? (zkap.scrollTop + zkap.clientHeight / 2) / zkap.scrollHeight : 0;
    zi = yeni;
    zkap.style.setProperty('--z', String(ZS[zi]));
    zkap.className = zi > 0 ? 'buyuk' : '';
    $('zoom-art').disabled = zi >= ZS.length - 1;
    $('zoom-azal').disabled = zi <= 0;
    zkap.scrollLeft = ox * zkap.scrollWidth - zkap.clientWidth / 2;
    zkap.scrollTop = oy * zkap.scrollHeight - zkap.clientHeight / 2;
  }
  function ac() {
    zkap.textContent = '';
    gorunen(cur).forEach(function (i) {
      var im = document.createElement('img');
      im.src = D.yol + pad(i + 1) + '.jpg';
      im.alt = 'Sayfa ' + (i + 1) + ' büyük';
      zkap.appendChild(im);
    });
    zoom.hidden = false;
    zoomUygula(0);
    zkap.scrollTop = 0;
    zkap.scrollLeft = 0;
    try { history.pushState({ hkBuyut: 1 }, ''); itildi = true; } catch (e) { itildi = false; }
    $('zoom-kapat').focus();
  }
  function kapatGercek() {
    zoom.hidden = true;
    zkap.textContent = '';
    $('btn-buyut').focus();
  }
  function kapat() {
    if (zoom.hidden) return;
    kapatGercek();
    if (itildi) { itildi = false; history.back(); }
  }
  window.addEventListener('popstate', function () {
    if (zoom.hidden) return;
    itildi = false;
    kapatGercek();
  });
  zkap.addEventListener('click', function (ev) {
    if (ev.target.tagName === 'IMG') zoomUygula(zi === 0 ? 2 : 0);
  });
  zoom.addEventListener('gesturestart', function (ev) { ev.preventDefault(); });
  $('zoom-art').addEventListener('click', function () { zoomUygula(zi + 1); });
  $('zoom-azal').addEventListener('click', function () { zoomUygula(zi - 1); });
  $('btn-buyut').addEventListener('click', ac);
  $('zoom-kapat').addEventListener('click', kapat);
})();
