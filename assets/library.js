(function () {
  'use strict';
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }

  var meta = document.querySelector('meta[name="base-url"]');
  var base = (meta && meta.getAttribute('content')) || '';
  if (!base) base = location.href.split(/[?#]/)[0].replace(/index\.html$/, '');
  base = base.replace(/\/+$/, '') + '/';

  function wa(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }

  var top = document.getElementById('kut-paylas');
  if (top) top.href = wa('📚 ' + top.getAttribute('data-baslik') + '\n' + top.getAttribute('data-tanitim') + '\n' + base);

  var items = document.querySelectorAll('.kitap[data-no]');
  for (var i = 0; i < items.length; i++) {
    var it = items[i], no = it.getAttribute('data-no');
    var share = it.querySelector('.paylas');
    if (share) share.href = wa('📖 ' + it.getAttribute('data-baslik') + '\n' + it.getAttribute('data-tanitim') + '\n' + base + 'kitap/' + no + '/');
    var note = it.querySelector('.devam');
    if (!note) continue;
    var raw = lsGet('hk:konum:' + no), s = null;
    try { s = JSON.parse(raw); } catch (e) { s = null; }
    if (s && s.s > 1) {
      note.textContent = 'Kaldığın yerden devam (s. ' + s.s + ')';
      note.hidden = false;
    }
  }
})();
