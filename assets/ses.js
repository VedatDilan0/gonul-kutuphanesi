(function () {
  'use strict';

  var KEY = 'hk:ses';
  var N = 4;
  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/[^\/]*$/, '') + 'ses/' : 'ses/';
  var raw = [], bufs = [], ctx = null, kurulum = null, son = -1, hazir = false;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sessiz */ } }
  function Ctor() { return window.AudioContext || window.webkitAudioContext; }

  var acik = lsGet(KEY) !== 'kapali', dinleyen = [];
  function oku() {
    var yeni = lsGet(KEY) !== 'kapali';
    if (yeni === acik) return;
    acik = yeni;
    dinleyen.forEach(function (f) { try { f(acik); } catch (e) { /* sessiz */ } });
  }

  function indir() {
    if (!window.fetch) return Promise.resolve();
    var ps = [];
    for (var i = 0; i < N; i++) {
      (function (i) {
        ps.push(fetch(base + 'sayfa-' + (i + 1) + '.wav').then(function (r) {
          return r.ok ? r.arrayBuffer() : null;
        }).then(function (b) { raw[i] = b; }, function () { raw[i] = null; }));
      })(i);
    }
    return Promise.all(ps);
  }
  var indirildi = indir();

  function coz(buf) {
    return new Promise(function (ok, hata) {
      var p = ctx.decodeAudioData(buf.slice(0), ok, hata);
      if (p && p.then) p.then(ok, hata);
    });
  }

  function kur() {
    if (kurulum) return kurulum;
    if (!ctx) {
      var C = Ctor();
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
      try {
        var s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, 22050);
        s.connect(ctx.destination);
        s.start(0);
      } catch (e) { /* sessiz */ }
    }
    sesiUyandir();
    kurulum = indirildi.then(function () {
      return Promise.all(raw.map(function (b, i) {
        if (!b) return null;
        return coz(b).then(function (d) { bufs[i] = d; }, function () { /* bozuk ses: atla */ });
      }));
    }).then(function () {
      if (bufs.some(Boolean)) { hazir = true; return; }
      if (window.console && console.warn) console.warn('Kâğıt sesi yüklenemedi; bir sonraki dokunuşta yeniden denenecek.');
      kurulum = null;
      indirildi = indir();
    });
    return kurulum;
  }

  var sonT = 0;
  function cal() {
    var n = Date.now();
    if (!acik || n - sonT < 150) return;
    sonT = n;
    var k = kur();
    if (!k) return;
    k.then(function () { vur(); });
  }

  function vur() {
    var ok = [];
    for (var i = 0; i < N; i++) if (bufs[i]) ok.push(i);
    if (!ok.length || !ctx) return;
    sesiUyandir();
    var i = ok[Math.floor(Math.random() * ok.length)];
    if (ok.length > 1 && i === son) i = ok[(ok.indexOf(i) + 1 + Math.floor(Math.random() * (ok.length - 1))) % ok.length];
    son = i;
    try {
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = bufs[i];
      if (s.playbackRate) s.playbackRate.value = 0.93 + Math.random() * 0.14;
      g.gain.value = 0.5 + Math.random() * 0.15;
      s.connect(g);
      g.connect(ctx.destination);
      s.start(0);
    } catch (e) { /* sessiz */ }
  }

  function sesiUyandir() {
    if (ctx && ctx.state !== 'running' && ctx.resume) {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () { /* sessiz */ }); } catch (e) { /* sessiz */ }
    }
  }
  function ac() { if (!hazir) kur(); sesiUyandir(); }
  ['touchend', 'pointerup', 'mouseup', 'keydown'].forEach(function (n) {
    document.addEventListener(n, function () { if (acik) ac(); }, { capture: true, passive: true });
  });
  window.addEventListener('pageshow', function (ev) { if (ev.persisted) oku(); });
  window.addEventListener('storage', function (ev) { if (!ev.key || ev.key === KEY) oku(); });

  window.HkSes = {
    cal: cal,
    acik: function () { return acik; },
    ayarla: function (v) {
      acik = !!v;
      lsSet(KEY, acik ? 'acik' : 'kapali');
      if (acik) { ac(); }
    },
    degisince: function (f) { dinleyen.push(f); }
  };
})();
