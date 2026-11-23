(function () {
  'use strict';

  var D;
  try { D = JSON.parse(document.getElementById('kitap-veri').textContent); } catch (e) { return; }

  var NO = (D.no < 10 ? '0' : '') + D.no;
  var K_POS = 'hk:konum:' + NO, K_FS = 'hk:yazi', K_TEMA = 'hk:tema';
  var FS = [17, 19, 21, 24, 27, 30];
  var DEFAULT_FS = 2;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sessiz */ } }
  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var stage = $('sahne'), kitap = $('kitap'), p1 = $('p1'), p2 = $('p2'), olcer = $('olcer');
  var olcerIc = olcer.firstElementChild;
  var ust = $('ust'), alt = $('alt');
  var blocks = [], pages = [], secPage = {};
  var cur = 0, spread = false, fsIdx = DEFAULT_FS, ready = false;
  var animating = false, animTok = 0, geomLh = 36, lastW = 0, lastH = 0;
  var backPos = null, backTimer = null, toastTimer = null, anchor = null;

  /* ---------- içerik blokları ---------- */

  function wordStarts(t) {
    var a = [0], re = /\s+/g, m;
    while ((m = re.exec(t))) {
      if (m.index + m[0].length < t.length) a.push(m.index + m[0].length);
    }
    return a;
  }

  function shareUrl() {
    if (D.url) return D.url;
    return location.href.split(/[?#]/)[0].replace(/index\.html$/, '');
  }
  function shareHref() {
    var t = '📖 ' + D.baslik + '\n' + D.tanitim + '\n' + shareUrl();
    return 'https://wa.me/?text=' + encodeURIComponent(t);
  }

  function buildBlocks() {
    var B = [];
    function add(o) {
      if (o.k === 'p' || o.k === 'kutu-p') o.starts = wordStarts(o.x);
      B.push(o);
    }
    add({ k: 'kapak', pb: 1, sec: 'kapak' });
    add({ k: 'baslik2', x: 'Önsöz', pb: 1, kwn: 1, sec: 'onsoz' });
    String(D.onsoz || '').split(/\n+/).forEach(function (t) { if (t.trim()) add({ k: 'p', x: t.trim() }); });
    add({ k: 'baslik2', x: 'İçindekiler', pb: 1, kwn: 1, sec: 'ic' });
    D.hikayeler.forEach(function (h) { add({ k: 'toc', x: h.baslik, n: h.no, hedef: 'h' + h.no }); });
    D.hikayeler.forEach(function (h) {
      add({ k: 'baslik', x: h.baslik, n: h.no, pb: 1, kwn: 1, sec: 'h' + h.no });
      if (h.tur === 'ogretici-kurgu') add({ k: 'etiket', x: 'Öğretici Kurgu' });
      (h.paragraflar || []).forEach(function (t) { add({ k: 'p', x: t }); });
      if (h.ibret) {
        add({ k: 'kutu-l', cls: 'ibret', x: 'Bu Hikâyeden Ne Öğrendik?', kwn: 1 });
        add({ k: 'kutu-p', cls: 'ibret', x: h.ibret });
      }
      if (h.kaynak) {
        add({ k: 'kutu-l', cls: 'kaynak', x: 'Kaynak', kwn: 1 });
        add({ k: 'kutu-p', cls: 'kaynak', x: h.kaynak });
      }
    });
    add({ k: 'baslik2', x: 'Kitabın Sonu', pb: 1, kwn: 1, sec: 'son' });
    if (D.kapanis) add({ k: 'p', x: D.kapanis });
    add({ k: 'btn', x: 'Kütüphaneye dön', href: D.kutuphane, cls: 'dugme dolu' });
    if (D.sonraki) {
      if (D.sonraki.hazir) add({ k: 'btn', x: 'Sonraki kitap: ' + D.sonraki.baslik, href: D.sonraki.yol, cls: 'dugme' });
      else add({ k: 'btn', x: 'Sonraki kitap hazırlanıyor', cls: 'dugme pasif' });
    }
    add({ k: 'btn', x: 'WhatsApp\'ta paylaş', share: 1, cls: 'dugme wa' });
    blocks = B;
  }

  function makeEl(f) {
    var b = blocks[f.b], e, t;
    switch (b.k) {
      case 'kapak':
        e = mk('div', 'kapak-s');
        var im = mk('img'); im.src = D.kapak; im.alt = 'Kitap kapağı'; im.draggable = false;
        e.appendChild(im);
        e.appendChild(mk('h1', '', D.baslik));
        e.appendChild(mk('p', '', D.tanitim));
        return e;
      case 'baslik':
        e = mk('h2', 'baslik');
        e.appendChild(mk('small', '', 'Hikâye ' + b.n));
        e.appendChild(document.createTextNode(b.x));
        return e;
      case 'baslik2': return mk('h2', 'baslik2', b.x);
      case 'etiket': return mk('div', 'etiket', b.x);
      case 'toc':
        e = mk('button', 'toc-i');
        e.type = 'button';
        e.setAttribute('data-hedef', b.hedef);
        e.appendChild(mk('b', '', b.n + '.'));
        e.appendChild(mk('span', '', b.x));
        return e;
      case 'kutu-l': return mk('div', 'kutu-l ' + b.cls, b.x);
      case 'kutu-p':
        return mk('p', 'kutu-p ' + b.cls + (f.s > 0 ? ' devam' : ''), b.x.slice(f.s, f.e));
      case 'btn':
        if (b.href || b.share) {
          e = mk('a', b.cls, b.x);
          e.href = b.share ? shareHref() : b.href;
          if (b.share) { e.target = '_blank'; e.rel = 'noopener'; }
        } else {
          e = mk('div', b.cls, b.x);
        }
        return e;
      default:
        t = b.x.slice(f.s, f.e);
        return mk('p', 'p' + (f.s > 0 ? ' devam' : ''), t);
    }
  }

  /* ---------- ölçüm ve sayfalama ---------- */

  function geometry() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    spread = sw >= 900 && sw > sh;
    var pw = spread ? Math.min(Math.floor((sw - 24) / 2), 560) : Math.min(sw - 8, 640);
    var ph = Math.min(sh - 8, spread ? 820 : 900);
    if (pw < 200) pw = 200;
    if (ph < 240) ph = 240;
    var px = Math.max(14, Math.min(34, Math.round(pw * 0.06)));
    var fs = FS[fsIdx];
    geomLh = Math.round(fs * 1.7);
    var s = kitap.style;
    s.setProperty('--pw', pw + 'px');
    s.setProperty('--ph', ph + 'px');
    s.setProperty('--px', px + 'px');
    s.setProperty('--py', '16px');
    s.setProperty('--fs', fs + 'px');
    s.setProperty('--lh', geomLh + 'px');
    kitap.classList.toggle('cift', spread);
    lastW = sw; lastH = sh;
  }

  function paginate() {
    var ic = olcerIc, out = [], pg = { frags: [] }, sp = {}, lh = geomLh;
    function flush() {
      if (pg.frags.length) out.push(pg);
      pg = { frags: [] };
      ic.textContent = '';
    }
    function add(f) { var e = makeEl(f); ic.appendChild(e); return e; }
    function fits() { return ic.scrollHeight <= ic.clientHeight; }
    ic.textContent = '';
    for (var bi = 0; bi < blocks.length; bi++) {
      var b = blocks[bi], f, e;
      if (b.pb && pg.frags.length) flush();
      if (b.pb) sp[b.sec] = out.length;
      if (b.k === 'kapak') { pg.frags.push({ b: bi, s: 0, e: 0 }); flush(); continue; }
      if (!b.starts) {
        f = { b: bi, s: 0, e: 0 };
        e = add(f);
        if (pg.frags.length) {
          var bad = !fits();
          if (!bad && b.kwn) {
            var pr = document.createElement('div');
            pr.style.height = (lh * 3) + 'px';
            ic.appendChild(pr);
            bad = !fits();
            ic.removeChild(pr);
          }
          if (bad) { ic.removeChild(e); flush(); add(f); }
        }
        pg.frags.push(f);
        continue;
      }
      var st = b.starts, n = st.length, ci = 0;
      while (true) {
        f = { b: bi, s: st[ci], e: b.x.length };
        e = add(f);
        if (fits()) { pg.frags.push(f); break; }
        ic.removeChild(e);
        var lo = ci, hi = n;
        while (hi - lo > 1) {
          var mid = (lo + hi) >> 1;
          f.e = st[mid];
          var e2 = add(f), ok = fits();
          ic.removeChild(e2);
          if (ok) lo = mid; else hi = mid;
        }
        if (lo === ci) {
          if (pg.frags.length) { flush(); continue; }
          lo = ci + 1;
          if (lo >= n) { f.e = b.x.length; pg.frags.push(f); break; }
        }
        pg.frags.push({ b: bi, s: st[ci], e: st[lo] });
        flush();
        ci = lo;
      }
    }
    if (pg.frags.length) out.push(pg);
    ic.textContent = '';
    out.forEach(function (p) { p.start = { b: p.frags[0].b, c: p.frags[0].s }; });
    pages = out;
    secPage = sp;
  }

  function findPage(pos) {
    var r = 0;
    for (var i = 0; i < pages.length; i++) {
      var s = pages[i].start;
      if (s.b < pos.b || (s.b === pos.b && s.c <= pos.c)) r = i; else break;
    }
    return r;
  }
  function norm(i) {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (!spread) return i;
    return i <= 0 ? -1 : i - ((i + 1) % 2);
  }

  /* ---------- gösterim ---------- */

  function mkPage(cls) {
    var s = mk('div', 'sayfa' + (cls ? ' ' + cls : ''));
    s.appendChild(mk('div', 'ic'));
    return s;
  }
  function fill(pageEl, idx) {
    var ic = pageEl.firstElementChild;
    ic.textContent = '';
    var pg = pages[idx];
    if (!pg) return;
    pg.frags.forEach(function (f) { ic.appendChild(makeEl(f)); });
  }
  function updateStatus() {
    var n = pages.length;
    var t = (spread && cur >= 0 && cur + 1 < n) ? (cur + 1) + '–' + (cur + 2) : String(Math.max(cur, 0) + 1);
    $('sayfa-no').textContent = 'Sayfa ' + t + ' / ' + n;
    var done = Math.min(cur + (spread ? 2 : 1), n);
    $('cubuk-i').style.width = (done / n * 100) + '%';
    $('cubuk').setAttribute('aria-valuenow', String(Math.round(done / n * 100)));
  }
  function savePos() {
    var pc = Math.max(cur, 0);
    if (!ready || !pages[pc]) return;
    var s = pages[pc].start;
    lsSet(K_POS, JSON.stringify({ b: s.b, c: s.c, s: pc + 1, t: pages.length }));
  }
  function render() {
    anchor = null;
    p1.classList.toggle('bos', spread && cur < 0);
    fill(p1, cur);
    if (spread) fill(p2, cur + 1);
    updateStatus();
    savePos();
  }

  function cancelAnim() {
    animTok++;
    animating = false;
    var l = kitap.querySelector('.yaprak');
    if (l) l.parentNode.removeChild(l);
    kitap.classList.remove('kayma');
  }

  function jump(target, src) {
    cancelAnim();
    var t = norm(target);
    if (t === cur) { render(); return; }
    cur = t;
    render();
    kitap.classList.remove('kayma');
    void kitap.offsetWidth;
    kitap.classList.add('kayma');
    if (src === 'user') afterUser();
  }

  function turn(dir, src) {
    if (animating) return false;
    var step = spread ? 2 : 1, ni = cur + dir * step;
    if (ni < (spread ? -1 : 0) || ni >= pages.length) return false;
    if (src === 'user') setBars(false);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      cur = ni; render();
      animating = true;
      var tk0 = ++animTok;
      kitap.classList.remove('kayma'); void kitap.offsetWidth; kitap.classList.add('kayma');
      setTimeout(function () { if (tk0 === animTok) { animating = false; kitap.classList.remove('kayma'); } }, 230);
      if (src === 'user') afterUser();
      return true;
    }
    animating = true;
    var tok = ++animTok;
    var leaf = mk('div', 'yaprak'), front = mkPage(), back = null, rot;
    if (!spread) {
      leaf.style.left = '0'; leaf.style.transformOrigin = 'left center';
      if (dir > 0) {
        fill(front, cur);
        cur = ni; fill(p1, cur);
        rot = 'rotateY(-105deg)';
        leaf.appendChild(front);
        kitap.appendChild(leaf);
        void leaf.offsetWidth;
      } else {
        fill(front, ni);
        leaf.appendChild(front);
        leaf.style.transform = 'rotateY(-105deg)';
        kitap.appendChild(leaf);
        void leaf.offsetWidth;
        rot = 'rotateY(0deg)';
      }
    } else if (dir > 0) {
      leaf.style.left = 'var(--pw)'; leaf.style.transformOrigin = 'left center';
      fill(front, cur + 1);
      back = mkPage('arka'); fill(back, ni);
      fill(p2, ni + 1);
      leaf.appendChild(front); leaf.appendChild(back);
      kitap.appendChild(leaf);
      void leaf.offsetWidth;
      rot = 'rotateY(-180deg)';
    } else {
      leaf.style.left = '0'; leaf.style.transformOrigin = 'right center';
      fill(front, cur);
      back = mkPage('arka'); fill(back, ni + 1);
      fill(p1, ni);
      p1.classList.toggle('bos', ni < 0);
      leaf.appendChild(front); leaf.appendChild(back);
      kitap.appendChild(leaf);
      void leaf.offsetWidth;
      rot = 'rotateY(180deg)';
    }
    var finished = false;
    function finish() {
      if (finished || tok !== animTok) return;
      finished = true;
      cur = ni;
      render();
      if (leaf.parentNode) leaf.parentNode.removeChild(leaf);
      animating = false;
      if (src === 'user') afterUser();
    }
    leaf.style.transition = 'transform .6s cubic-bezier(.45,.05,.3,1)';
    leaf.style.transform = rot;
    leaf.addEventListener('transitionend', function (ev) { if (ev.target === leaf) finish(); });
    setTimeout(finish, 750);
    return true;
  }

  function afterUser() {
    autoReset();
    if (sp.on && !sp.paused) speakStart(Math.max(cur, 0));
  }

  function relayout() {
    var pos = anchor || (pages.length ? pages[Math.max(cur, 0)].start : { b: 0, c: 0 });
    cancelAnim();
    geometry();
    paginate();
    cur = norm(findPage(pos));
    render();
    anchor = pos;
    hideBack();
    if (sp.on && !sp.paused) speakStart(Math.max(cur, 0));
  }

  /* ---------- araç çubuğu, bildirim, geri dön ---------- */

  function setBars(show) {
    if (!show) closePanels();
  }
  function closePanels() {
    var any = false;
    ['p-dinle', 'p-oto'].forEach(function (id) { var p = $(id); if (!p.hidden) { p.hidden = true; any = true; } });
    $('btn-dinle').setAttribute('aria-expanded', 'false');
    $('btn-oto').setAttribute('aria-expanded', 'false');
    return any;
  }
  function openPanel(id, btnId) {
    var p = $(id), was = !p.hidden;
    closePanels();
    if (!was) { setBars(true); p.hidden = false; $(btnId).setAttribute('aria-expanded', 'true'); }
  }
  function toast(msg, ms) {
    var t = $('bildirim');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2500);
  }
  function showBack() {
    var b = $('geri');
    b.textContent = 'Geri dön (s. ' + (findPage(backPos) + 1) + ')';
    b.hidden = false;
    clearTimeout(backTimer);
    backTimer = setTimeout(hideBack, 10000);
  }
  function hideBack() { $('geri').hidden = true; clearTimeout(backTimer); }
  function goSec(sec) {
    var idx = secPage[sec];
    if (idx == null) return;
    var t = norm(idx);
    if (t === cur) return;
    backPos = pages[Math.max(cur, 0)].start;
    jump(t, 'user');
    setBars(false);
    showBack();
  }

  /* ---------- yazı boyutu, gece ---------- */

  function updateFsButtons() {
    $('btn-kucult').setAttribute('aria-disabled', fsIdx <= 0 ? 'true' : 'false');
    $('btn-buyut').setAttribute('aria-disabled', fsIdx >= FS.length - 1 ? 'true' : 'false');
  }
  function setFs(i) {
    i = Math.max(0, Math.min(FS.length - 1, i));
    if (i === fsIdx) { toast(i === 0 ? 'En küçük yazı' : 'En büyük yazı', 1500); return; }
    fsIdx = i;
    lsSet(K_FS, String(i));
    updateFsButtons();
    relayout();
    toast('Yazı boyutu: ' + (i + 1) + ' / ' + FS.length, 1500);
  }
  function setTema(gece) {
    if (gece) document.documentElement.setAttribute('data-tema', 'gece');
    else document.documentElement.removeAttribute('data-tema');
    $('btn-gece').setAttribute('aria-pressed', gece ? 'true' : 'false');
    lsSet(K_TEMA, gece ? 'gece' : 'gunduz');
  }

  /* ---------- otomatik çevirme ---------- */

  var au = { sec: 0, dur: 0, t0: 0, timer: null };
  var OTOK = parseFloat((/[?&]otosure=([\d.]+)/.exec(location.search) || [])[1]) / 30 || 1;
  function autoSet(sec) {
    au.sec = sec;
    clearInterval(au.timer);
    var chips = $('p-oto').querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', String(+chips[i].getAttribute('data-sn') === sec));
    $('btn-oto').setAttribute('aria-pressed', sec ? 'true' : 'false');
    $('oto').hidden = !sec;
    $('btn-oto').hidden = !!sec;
    if (!sec) return;
    if (sp.on) speakStop();
    au.dur = sec * OTOK;
    au.t0 = Date.now();
    au.timer = setInterval(autoTick, 250);
    autoTick();
  }
  function autoReset() { if (au.sec) au.t0 = Date.now(); }
  function autoTick() {
    var el = (Date.now() - au.t0) / 1000, left = au.dur - el;
    $('oto-i').style.width = Math.max(0, left / au.dur * 100) + '%';
    if (left > 0) return;
    if (!turn(1, 'auto')) {
      if (cur + (spread ? 2 : 1) >= pages.length) { autoSet(0); toast('Son sayfaya gelindi. Otomatik çevirme durdu.', 3000); return; }
    }
    au.t0 = Date.now();
  }

  /* ---------- sesli okuma ---------- */

  var syn = window.speechSynthesis, hasTTS = !!(syn && window.SpeechSynthesisUtterance);
  var trVoice = null, voiceWait = true;
  var sp = { on: false, paused: false, page: 0, chunks: [], ci: 0, id: 0, rate: 1 };
  var NOVOICE = 'Bu cihazda Türkçe sesli okuma desteği bulunamadı.';

  function findVoice() {
    if (!hasTTS) return;
    var vs = syn.getVoices() || [];
    trVoice = null;
    for (var i = 0; i < vs.length; i++) if (/^tr([-_]|$)/i.test(vs[i].lang)) { trVoice = vs[i]; break; }
    sesUI();
  }
  function sesUI() {
    var d = $('ses-durum'), ok = hasTTS && !!trVoice;
    if (!hasTTS) d.textContent = NOVOICE;
    else if (!trVoice) d.textContent = voiceWait ? 'Türkçe ses aranıyor…' : NOVOICE;
    else if (sp.on) d.textContent = (sp.paused ? 'Duraklatıldı' : 'Okunuyor') + ' — sayfa ' + (sp.page + 1);
    else d.textContent = 'Hazır. Başlat\'a dokunun.';
    $('ses-basla').disabled = !ok || sp.on;
    $('ses-dur').disabled = !ok || !sp.on || sp.paused;
    $('ses-devam').disabled = !ok || !sp.on || !sp.paused;
    $('ses-bitir').disabled = !ok || !sp.on;
    $('btn-dinle').setAttribute('aria-pressed', sp.on ? 'true' : 'false');
    var rs = $('p-dinle').querySelectorAll('[data-hiz]');
    for (var i = 0; i < rs.length; i++) rs[i].setAttribute('aria-pressed', String(+rs[i].getAttribute('data-hiz') === sp.rate));
  }
  function chunksOf(t) {
    var parts = t.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+["”’»)]*\s*|[^.!?…]+$/g) || [];
    var out = [];
    parts.forEach(function (s) {
      s = s.trim();
      while (s.length > 170) {
        var cut = s.lastIndexOf(',', 170);
        if (cut < 60) cut = s.lastIndexOf(' ', 170);
        if (cut < 1) cut = 170;
        out.push(s.slice(0, cut + 1).trim());
        s = s.slice(cut + 1).trim();
      }
      if (s) out.push(s);
    });
    return out;
  }
  function pageText(i) {
    var pg = pages[i], r = [];
    if (!pg) return '';
    pg.frags.forEach(function (f) {
      var b = blocks[f.b], t = '';
      if (b.k === 'kapak') t = D.baslik + '. ' + D.tanitim;
      else if (b.k === 'baslik') t = 'Hikâye ' + b.n + '. ' + b.x;
      else if (b.k === 'toc') t = b.n + '. ' + b.x;
      else if (b.k === 'baslik2' || b.k === 'kutu-l') t = b.x;
      else if (b.k === 'p' || b.k === 'kutu-p') t = b.x.slice(f.s, f.e);
      t = t.trim();
      if (t && !/[.!?…]$/.test(t)) t += '.';
      if (t) r.push(t);
    });
    return r.join(' ');
  }
  function showPageFor(i) {
    var t = norm(i);
    if (t === cur) return;
    var step = spread ? 2 : 1;
    if (t === cur + step && !animating) turn(1, 'tts'); else jump(t, 'tts');
  }
  function sayNext() {
    var id = sp.id;
    while (sp.ci >= sp.chunks.length) {
      if (sp.page + 1 >= pages.length) { speakStop(); toast('Okuma bitti', 2000); return; }
      sp.page++;
      sp.chunks = chunksOf(pageText(sp.page));
      sp.ci = 0;
      showPageFor(sp.page);
      sesUI();
    }
    var u = new window.SpeechSynthesisUtterance(sp.chunks[sp.ci]);
    u.lang = (trVoice && trVoice.lang) || 'tr-TR';
    if (trVoice) u.voice = trVoice;
    u.rate = sp.rate;
    u.onend = function () { if (sp.id !== id || !sp.on || sp.paused) return; sp.ci++; sayNext(); };
    u.onerror = function (ev) {
      if (sp.id !== id) return;
      if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return;
      speakStop();
      toast('Sesli okuma durdu', 2500);
    };
    syn.speak(u);
  }
  function speakStart(page) {
    if (!hasTTS || !trVoice) { sesUI(); return; }
    if (au.sec) autoSet(0);
    sp.on = true; sp.paused = false; sp.page = page;
    sp.chunks = chunksOf(pageText(page));
    sp.ci = 0;
    sp.id++;
    syn.cancel();
    sayNext();
    sesUI();
  }
  function speakPause() {
    if (!sp.on || sp.paused) return;
    sp.paused = true; sp.id++;
    syn.cancel();
    sesUI();
  }
  function speakResume() {
    if (!sp.on || !sp.paused) return;
    sp.paused = false; sp.id++;
    syn.cancel();
    sayNext();
    sesUI();
  }
  function speakStop() {
    sp.on = false; sp.paused = false; sp.id++;
    if (hasTTS) syn.cancel();
    sesUI();
  }
  function setRate(r) {
    sp.rate = r;
    if (sp.on && !sp.paused) { sp.id++; syn.cancel(); sayNext(); }
    sesUI();
  }

  /* ---------- dokunma, kaydırma, klavye ---------- */

  function zoomed() { return !!(window.visualViewport && window.visualViewport.scale > 1.05); }
  var tch = null, multi = false, blockClickUntil = 0;

  stage.addEventListener('touchstart', function (ev) {
    if (ev.touches.length > 1) { multi = true; tch = null; return; }
    if (multi) return;
    var t = ev.touches[0];
    tch = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });
  stage.addEventListener('touchmove', function (ev) { if (ev.touches.length > 1) { multi = true; tch = null; } }, { passive: true });
  stage.addEventListener('touchend', function (ev) {
    if (ev.touches.length > 0) return;
    if (multi) { multi = false; tch = null; blockClickUntil = Date.now() + 400; return; }
    if (!tch) return;
    var t = ev.changedTouches[0], dx = t.clientX - tch.x, dy = t.clientY - tch.y;
    tch = null;
    if (zoomed()) return;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      blockClickUntil = Date.now() + 400;
      turn(dx < 0 ? 1 : -1, 'user');
    }
  }, { passive: true });
  stage.addEventListener('touchcancel', function () { tch = null; multi = false; }, { passive: true });

  stage.addEventListener('click', function (ev) {
    var tg = ev.target.closest ? ev.target.closest('.toc-i') : null;
    if (tg) { goSec(tg.getAttribute('data-hedef')); return; }
    if (ev.target.closest && ev.target.closest('a,button')) return;
    if (Date.now() < blockClickUntil || zoomed()) return;
    if (closePanels()) return;
    var r = ev.clientX / window.innerWidth;
    if (r > 0.7) turn(1, 'user');
    else if (r < 0.3) turn(-1, 'user');
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var k = ev.key, onBtn = ev.target && ev.target.closest && ev.target.closest('button,a');
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !onBtn)) { ev.preventDefault(); turn(1, 'user'); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); turn(-1, 'user'); }
    else if (k === 'Home') { ev.preventDefault(); jump(0, 'user'); }
    else if (k === 'End') { ev.preventDefault(); jump(pages.length - 1, 'user'); }
    else if (k === 'Escape') { closePanels(); }
  });
  ['touchstart', 'mousedown', 'keydown'].forEach(function (n) { document.addEventListener(n, autoReset, true); });

  /* ---------- bağlantılar ---------- */

  $('btn-ic').addEventListener('click', function () { goSec('ic'); });
  $('btn-kucult').addEventListener('click', function () { setFs(fsIdx - 1); });
  $('btn-buyut').addEventListener('click', function () { setFs(fsIdx + 1); });
  $('btn-gece').addEventListener('click', function () { setTema(!document.documentElement.hasAttribute('data-tema')); });
  $('btn-dinle').addEventListener('click', function () { openPanel('p-dinle', 'btn-dinle'); sesUI(); });
  $('btn-oto').addEventListener('click', function () { openPanel('p-oto', 'btn-oto'); });
  $('ses-basla').addEventListener('click', function () { speakStart(Math.max(cur, 0)); });
  $('ses-dur').addEventListener('click', speakPause);
  $('ses-devam').addEventListener('click', speakResume);
  $('ses-bitir').addEventListener('click', speakStop);
  Array.prototype.forEach.call($('p-dinle').querySelectorAll('[data-hiz]'), function (b) {
    b.addEventListener('click', function () { setRate(+b.getAttribute('data-hiz')); });
  });
  Array.prototype.forEach.call($('p-oto').querySelectorAll('.chip'), function (b) {
    b.addEventListener('click', function () {
      autoSet(+b.getAttribute('data-sn'));
      closePanels();
      if (au.sec) toast('Her ' + au.sec + ' saniyede bir sayfa çevrilecek', 2500);
    });
  });
  $('oto-dur').addEventListener('click', function () { autoSet(0); });
  $('geri').addEventListener('click', function () {
    if (backPos) jump(findPage(backPos), 'user');
    hideBack();
  });
  window.addEventListener('pagehide', function () { if (hasTTS) syn.cancel(); });

  var rt = null;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (!ready) return;
      if (Math.abs(stage.clientWidth - lastW) < 2 && Math.abs(stage.clientHeight - lastH) < 2) return;
      relayout();
    }, 150);
  }
  if (window.ResizeObserver) new window.ResizeObserver(onResize).observe(stage);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  /* ---------- başlangıç ---------- */

  function init() {
    var f = parseInt(lsGet(K_FS), 10);
    if (f >= 0 && f < FS.length) fsIdx = f;
    updateFsButtons();
    setTema(lsGet(K_TEMA) === 'gece');
    buildBlocks();
    geometry();
    paginate();
    var saved = null;
    try { saved = JSON.parse(lsGet(K_POS)); } catch (e) { saved = null; }
    var resumed = false;
    if (saved && typeof saved.b === 'number' && typeof saved.c === 'number' && saved.b > 0 && saved.b < blocks.length) {
      cur = norm(findPage({ b: saved.b, c: saved.c }));
      resumed = cur > 0;
    } else cur = norm(0);
    render();
    ready = true;
    savePos();
    kitap.classList.add('hazir');
    var y = $('yukleniyor'); if (y) y.parentNode.removeChild(y);
    setBars(true);
    if (resumed) toast('Kaldığınız yerden devam ediyorsunuz', 2800);
    autoSet(0);
    sesUI();
    if (hasTTS) {
      findVoice();
      if (syn.addEventListener) syn.addEventListener('voiceschanged', findVoice); else syn.onvoiceschanged = findVoice;
      setTimeout(findVoice, 800);
      setTimeout(function () { voiceWait = false; findVoice(); }, 3000);
    } else { voiceWait = false; sesUI(); }
    document.documentElement.setAttribute('data-hazir', String(pages.length));
  }

  var started = false;
  function go() { if (started) return; started = true; init(); }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(go, go);
    setTimeout(go, 1200);
  } else go();
})();
