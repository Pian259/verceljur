// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = "https://rahxucmatacwjnpdvqsv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhaHh1Y21hdGFjd2pucGR2cXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNjA4MzUsImV4cCI6MjA3NzYzNjgzNX0.Wl2iZ2GZxQm3t-DxZkSVagJbCxWrY1DUAYG8WpB-aDc";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SITE_URL =
  location.hostname === "localhost"
    ? "http://localhost:5500"
    : "https://tokojuraganub.com";
    
// ---------- KONFIG ----------
const adminNumberInput = '087729805594';
const adminNumber = adminNumberInput.replace(/^0/, '62'); // format internasional WA
const demoQris = 'assets/qris.jpg';
const topupImage = 'assets/pricelist.jpg';
const accountsFile = 'accounts.json';
const ADMIN_PASSWORD = 'juragan2025'; // demo: ganti di production

// ---------- STATE ----------
let accounts = [];
let selected = null;
let adminLoggedIn = false;


// ---------- UTIL ----------
const fmt = (n) => {
  const num = typeof n === 'number' ? n : Number(String(n).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return '0';
  return Math.trunc(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const generateTransactionId = () =>
  'TX-' + Math.random().toString(36).substring(2, 8).toUpperCase();

function showToast(html) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 4000);
}

// cegah double-klik
function lockButton(btn, ms = 1200) {
  if (!btn) return () => {};
  btn.disabled = true;
  let locked = true;
  const unlock = () => { if (locked) { locked = false; btn.disabled = false; } };
  setTimeout(unlock, ms);
  return unlock;
}

// fallback gambar
function attachImgFallback(img, fallback = demoQris) {
  img.addEventListener('error', () => { img.src = fallback; }, { once: true });
}

// ---------- PRELOAD SEDERHANA ----------
const preloadedMap = new Map();
async function preloadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(demoQris);
    img.src = src;
  });
}
const getCachedSrc = src => preloadedMap.get(src) || src || demoQris;

// ---------- DATA ----------
async function loadAccountsFile() {
  try {
    const res = await fetch(accountsFile, { cache: 'no-store' });
    accounts = await res.json();
    if (!Array.isArray(accounts)) accounts = [];
  } catch {
    accounts = [];
  }
}

// ---------- STORAGE (local first + server jika ada) ----------
const LS_KEY = 'tj_trxs_v1';

function lsGet() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}
function lsSet(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list || [])); }
  catch {}
}

// fetch dengan timeout agar tidak “ngegantung”
async function fetchWithTimeout(url, opts = {}, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

// GET riwayat: coba server, kalau gagal pakai local
async function apiGetTransactions() {
  try {
    const r = await fetchWithTimeout('/api/transactions', { cache: 'no-store' }, 5000);
    if (!r.ok) throw 0;
    return await r.json();
  } catch {
    return lsGet();
  }
}

// POST transaksi: simpan ke local dulu, lalu coba kirim ke server
async function apiPostTransaction(entry) {
  // local first
  const cur = lsGet();
  cur.push(entry);
  lsSet(cur);

  try {
    const res = await fetchWithTimeout('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }, 5000);
    if (!res.ok) throw new Error('POST not ok');
  } catch (e) {
    console.warn('Save transaction to server failed', e);
    showToast('💾 Disimpan lokal. Server tidak aktif.');
  }
}

// BULK update status: update local + coba server
async function apiBulkUpdateStatus(items) {
  // update local
  const cur = lsGet();
  items.forEach(u => {
    const i = cur.findIndex(x => x.trxId === u.trxId);
    if (i > -1) cur[i].status = u.status;
  });
  lsSet(cur);

  // coba server
  try {
    const res = await fetchWithTimeout('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }, 8000);
    if (!res.ok) throw new Error('PUT not ok');
    return await res.json();
  } catch (e) {
    console.log('Bulk update server failed', e);
    showToast('⚠️ Gagal sync ke server. Perubahan tersimpan lokal.');
    return { ok: false };
  }
}

// ---------- MODAL ----------
const modalRoot = document.getElementById('modalRoot');
modalRoot?.classList.add('modal-root');
let _modalKeyHandler = null;

function openModal(html) {
  modalRoot.style.display = 'flex';
  modalRoot.innerHTML = `<div class="modal-card slide-up" role="dialog" aria-modal="true">${html}</div>`;
  modalRoot.addEventListener('click', modalOverlayClose);

  if (_modalKeyHandler) document.removeEventListener('keydown', _modalKeyHandler);
  _modalKeyHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', _modalKeyHandler);
}
function closeModal() {
  modalRoot.style.display = 'none';
  modalRoot.innerHTML = '';
  modalRoot.removeEventListener('click', modalOverlayClose);
  if (_modalKeyHandler) {
    document.removeEventListener('keydown', _modalKeyHandler);
    _modalKeyHandler = null;
  }
}
function modalOverlayClose(e) { if (e.target === modalRoot) closeModal(); }

// ---------- LOADER ----------
function showLoader(msg = 'Memuat...') {
  document.documentElement.classList.add('is-loading'); // blur halaman
  let el = document.getElementById('preloadOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'preloadOverlay';
    el.style = `
      position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.45);z-index:99999;color:#fff;font-size:16px;pointer-events:auto
    `;
    el.innerHTML = `<div style="text-align:center">
      <div class="spinner" style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;
        border:6px solid rgba(255,255,255,0.15);border-top-color:#fff;animation:spin 1s linear infinite"></div>
      <div id="preloadText">${msg}</div>
    </div>`;
    document.body.appendChild(el);
  } else {
    el.querySelector('#preloadText').textContent = msg;
    el.style.display = 'flex';
    el.style.pointerEvents = 'auto';
  }
}
function hideLoader() {
  document.documentElement.classList.remove('is-loading'); // hilangkan blur
  const el = document.getElementById('preloadOverlay');
  if (el) { el.style.display = 'none'; el.style.pointerEvents = 'none'; }
}

// ---------- SCROLL REVEAL & LAZY BLUR ----------
let _revealObserver;
function initScrollReveal() {
  if (_revealObserver) {
    document.querySelectorAll('.reveal:not([data-reveal-bound])').forEach(el=>{
      el.setAttribute('data-reveal-bound','1');
      _revealObserver.observe(el);
    });
    return;
  }
  _revealObserver = new IntersectionObserver((entries, obs)=>{
    entries.forEach(e=>{
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal:not([data-reveal-bound])').forEach(el=>{
    el.setAttribute('data-reveal-bound','1');
    _revealObserver.observe(el);
  });
}

function hookLazyBlurImages(scope=document) {
  scope.querySelectorAll('img:not(.lazy-blur)').forEach(img=>{
    img.classList.add('lazy-blur');
    attachImgFallback(img, demoQris);
    if (img.complete) {
      requestAnimationFrame(()=>img.classList.add('loaded'));
    } else {
      img.addEventListener('load', ()=> img.classList.add('loaded'), { once:true });
      img.addEventListener('error', ()=> img.classList.add('loaded'), { once:true });
    }
  });
}

// ---------- RIWAYAT ----------
async function openHistory() {
  const list = await apiGetTransactions();
  let html = '<h3>Riwayat Transaksi</h3>';
  if (!list.length) {
    html += '<p style="text-align:center;color:#999">Belum ada transaksi.</p>';
  } else {
    html += '<div class="history-list">';
    list.slice().reverse().forEach(it => {
      const amount = it.price || it.amount || 0;
      const time = new Date(it.time).toLocaleString();
      html += `
        <div class="hist-item reveal">
          <div style="flex:1">
            <div style="font-weight:700">${it.title || (it.type === 'topup' ? 'Topup' : 'Transaksi')}</div>
            <div style="font-size:12px;color:var(--muted)">ID: ${it.trxId}</div>
            <div style="font-size:13px;margin-top:6px">Rp ${fmt(amount)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:${it.status === 'paid' ? '#34d399' : it.status === 'cancelled' ? '#ef4444' : '#f59e0b'}">${(it.status || 'pending').toUpperCase()}</div>
            <div style="font-size:12px;color:var(--muted)">${time}</div>
          </div>
        </div>`;
    });
    html += '</div>';
  }
  html += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
    <button id="closeHist" class="btn primary" type="button">Tutup</button>
  </div>`;
  openModal(html);

  const modal = document.querySelector('#modalRoot');
  modal.querySelectorAll('.hist-item').forEach(el=>el.classList.add('reveal'));
  initScrollReveal();

  document.getElementById('closeHist')?.addEventListener('click', closeModal);
}

// ---------- PEMBAYARAN (WA text: minta bukti transfer) ----------
async function openTopupPaymentModal(amount, ref) {
  hideLoader(); // modal cepat tampil
  const trxId = generateTransactionId();

  openModal(`
    <h3 class="reveal">Scan & Lakukan Pembayaran</h3>

    <div class="modal-note reveal" style="margin-top:10px">
      <strong>Jumlah yang harus dibayar: Rp ${fmt(amount)}</strong>
    </div>
    <div class="modal-note reveal" style="margin-top:6px">
      Jika pembayaran melebihi nominal, <strong>kelebihan bukan tanggung jawab admin</strong> (bukan salah admin).
    </div>

    <img src="${getCachedSrc(demoQris)}" class="modal-qr lazy-blur" alt="QRIS">

    <p class="modal-note reveal">Setelah transfer, buka WhatsApp dan <strong>kirim bukti transfer (screenshot)</strong> ke admin beserta ID transaksi.</p>
    <div class="reveal" style="display:flex;justify-content:center;margin-top:10px">
      <button id="confirmPayBtn" class="btn primary" type="button">Kirim Bukti Transfer via WA</button>
    </div>
  `);

  const modal = document.querySelector('#modalRoot');
  hookLazyBlurImages(modal);
  modal.querySelectorAll('.modal-card, .modal-qr, .modal-note, #confirmPayBtn').forEach(el=>el.classList.add('reveal'));
  initScrollReveal();

  // simpan transaksi (TANPA menyimpan referral di server/lokal)
  apiPostTransaction({
    trxId,
    title: 'Topup Saldo',
    type: 'topup',
    amount,
    status: 'pending',
    time: new Date().toISOString()
  });

  const waText = [
    'TOPUP SALDO',
    `ID: ${trxId}`,
    `Nominal: Rp ${fmt(amount)}`,
    ref ? `Referral: ${ref}` : null, // hanya tampil di WA jika diisi, tidak disimpan
    '',
    'Silakan kirim *bukti transfer (screenshot)* ke admin dengan menyertakan ID di atas.',
    'Terima kasih.'
  ].filter(Boolean).join('\n');

  const btn = document.getElementById('confirmPayBtn');
  btn?.addEventListener('click', () => {
    const unlock = lockButton(btn);
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(waText)}`, '_blank', 'noopener,noreferrer');
    showToast(`✅ Topup (ID: ${trxId}) — buka WhatsApp & kirim bukti transfer.`);
    unlock();
    closeModal();
  });
}

async function openBuyQrModal(acc) {
  hideLoader(); // modal cepat tampil
  const trxId = generateTransactionId();

  openModal(`
    <h3 class="reveal">Scan & Bayar Sekarang</h3>

    <div class="modal-note reveal" style="margin-top:10px">
      <strong>Jumlah yang harus dibayar: Rp ${fmt(acc.price)}</strong>
    </div>
    <div class="modal-note reveal" style="margin-top:6px">
      Jika pembayaran melebihi nominal, <strong>kelebihan bukan tanggung jawab admin</strong> (bukan salah admin).
    </div>

    <img src="${getCachedSrc(demoQris)}" class="modal-qr lazy-blur" alt="QRIS">

    <p class="modal-note reveal">Setelah transfer, buka WhatsApp dan <strong>kirim bukti transfer (screenshot)</strong> ke admin beserta ID transaksi.</p>
    <div class="reveal" style="display:flex;justify-content:center;margin-top:10px">
      <button id="confirmPayBtn" class="btn primary" type="button">Kirim Bukti Transfer via WA</button>
    </div>
  `);

  const modal = document.querySelector('#modalRoot');
  hookLazyBlurImages(modal);
  modal.querySelectorAll('.modal-card, .modal-qr, .modal-note, #confirmPayBtn').forEach(el=>el.classList.add('reveal'));
  initScrollReveal();

  apiPostTransaction({
    trxId,
    title: acc.title,
    type: 'beli',
    price: acc.price,
    status: 'pending',
    time: new Date().toISOString()
  });

  const waText = [
    'PEMBELIAN AKUN',
    `ID: ${trxId}`,
    `Produk: ${acc.title}`,
    `Harga: Rp ${fmt(acc.price)}`,
    '',
    'Silakan kirim *bukti transfer (screenshot)* ke admin dengan menyertakan ID di atas.',
    'Terima kasih.'
  ].join('\n');

  const btn = document.getElementById('confirmPayBtn');
  btn?.addEventListener('click', () => {
    const unlock = lockButton(btn);
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(waText)}`, '_blank', 'noopener,noreferrer');
    showToast(`📩 Pembelian (ID: ${trxId}) — buka WhatsApp & kirim bukti transfer.`);
    unlock();
    closeModal();
  });
}

// ---------- RENDER ----------
function selectAccount(acc) {
  selected = acc;
  const detailImg = document.getElementById('detailImg');
  const detailTitle = document.getElementById('detailTitle');
  const detailDesc = document.getElementById('detailDesc');
  const buyNow = document.getElementById('buyNow');

  let stockClass = 'available';
  if (acc.stock <= 0) stockClass = 'sold';
  else if (acc.stock <= 2) stockClass = 'low';

  detailImg.src = getCachedSrc(acc.img || demoQris);
  attachImgFallback(detailImg, demoQris);

  detailTitle.textContent = acc.title;
  detailDesc.innerHTML = `
    <strong>Rp ${fmt(acc.price)}</strong><br>
    ${acc.desc || ''}<br>
    <div style="margin-top:8px">
      <div class="stock-badge ${stockClass}">
        ${acc.stock<=0 ? 'Habis' : 'Stock: '+acc.stock}
      </div>
    </div>`;
  buyNow.textContent = acc.stock <= 0 ? 'Stock Habis' : 'Beli Sekarang';
  buyNow.disabled = acc.stock <= 0;

  document.getElementById('detailCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderBuy() {
  const contentArea = document.getElementById('contentArea');

  // pastikan panel detail muncul lagi jika sebelumnya disembunyikan oleh Topup
  const detailCard = document.getElementById('detailCard');
  if (detailCard && detailCard.style.display === 'none') detailCard.style.display = '';

  let html = '<h3 style="margin-top:0;color:var(--accent)" class="reveal">Daftar Akun</h3>';
  html += '<div class="accounts-grid fade-in">';
  accounts.forEach(acc => {
    let stockClass = 'available';
    if (acc.stock <= 0) stockClass = 'sold';
    else if (acc.stock <= 2) stockClass = 'low';

    html += `
      <div class="acc-card ${acc.stock<=0 ? 'out-of-stock' : ''} reveal" data-id="${acc.id}" title="${acc.stock<=0 ? 'Stok habis' : 'Klik untuk lihat detail'}">
        <img src="${getCachedSrc(acc.img)}" alt="${acc.title}" class="acc-thumb" loading="lazy" decoding="async">
        <h4>${acc.title}</h4>
        <p>${acc.desc || ''}</p>
        <div class="acc-meta">
          <div>Rp ${fmt(acc.price)}</div>
          <div class="stock-badge ${stockClass}">
            ${acc.stock <= 0 ? 'Habis' : 'Stock: ' + acc.stock}
          </div>
        </div>
      </div>`;
  });
  html += '</div>';

  contentArea.innerHTML = html;

  hookLazyBlurImages(contentArea);
  // pasang fallback error di semua thumbnail
  contentArea.querySelectorAll('img.acc-thumb').forEach(img=>attachImgFallback(img, demoQris));
  initScrollReveal();

  document.querySelectorAll('.acc-card').forEach(card => {
    card.addEventListener('click', () => {
      const acc = accounts.find(a => String(a.id) === String(card.dataset.id));
      if (acc) selectAccount(acc);
    });
  });
}

function renderTopup() {
  const contentArea = document.getElementById('contentArea');

  // Sembunyikan panel detail saat topup
  const detailCard = document.getElementById('detailCard');
  if (detailCard) detailCard.style.display = 'none';

  contentArea.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent)" class="reveal">Topup</h3>
    <div style="text-align:center">
      <img id="topupImg" src="${getCachedSrc(topupImage)}" alt="Price list"
        class="reveal" style="max-width:90%;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.08)">

      <p style="margin-top:12px;color:var(--muted)" class="reveal">
        Pilih cepat atau masukkan nominal sesuai kebutuhan.
      </p>

      <div id="topupPreset" class="reveal" style="
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        justify-items:stretch;
        align-items:stretch;
        max-width:720px;
        margin: 0 auto 10px;
      "></div>

      <input id="nominalInput" type="number" min="1000" max="1000000"
        placeholder="Masukkan nominal top-up (1.000 – 1.000.000)"
        class="reveal"
        style="padding:10px;width:60%;border-radius:8px;border:1px solid #30363d;background:transparent;color:var(--accent);margin-top:8px">

      <input id="refInput" placeholder="Kode referral (opsional)"
        class="reveal"
        style="padding:10px;width:60%;border-radius:8px;border:1px solid #30363d;background:transparent;color:var(--accent);margin-top:8px">

      <div style="margin-top:12px" class="reveal">
        <button id="confirmTopupBtn" class="btn primary" type="button">Lanjutkan Pembayaran</button>
      </div>
    </div>
  `;

  // preset 4 x 2
  const presets = [5000, 10000, 20000, 30000, 35000, 40000, 45000, 50000];
  const presetContainer = document.getElementById('topupPreset');
  presets.forEach(p => {
    const b = document.createElement('button');
    b.className = 'btn secondary';
    b.type = 'button';
    b.textContent = `Rp ${fmt(p)}`;
    b.style.width = '100%';
    b.addEventListener('click', () => {
      const input = document.getElementById('nominalInput');
      input.value = p;
      input.focus();
    });
    presetContainer.appendChild(b);
  });

  // shimmer opsional sementara
  document.querySelectorAll('#topupPreset .btn').forEach((b,i)=>{
    b.classList.add('skel');
    setTimeout(()=> b.classList.remove('skel'), 350 + (i%4)*80);
  });

  // efek + fallback
  hookLazyBlurImages(contentArea);
  const topupImg = document.getElementById('topupImg');
  attachImgFallback(topupImg, demoQris);
  initScrollReveal();

  const btn = document.getElementById('confirmTopupBtn');
  btn?.addEventListener('click', async () => {
    const unlock = lockButton(btn);
    const nominalEl = document.getElementById('nominalInput');
    const refEl = document.getElementById('refInput');
    const nominal = parseInt(nominalEl.value || '0', 10);
    const ref = (refEl.value || '').trim();
    const min = 1000, max = 1000000;

    if (!Number.isFinite(nominal) || nominal < min) {
      showToast(`Nominal minimal Rp ${fmt(min)}.`);
      unlock(); return;
    }
    if (nominal > max) {
      showToast(`Nominal maksimal Rp ${fmt(max)}.`);
      unlock(); return;
    }

    showLoader('Menyiapkan pembayaran...');
    try {
      await openTopupPaymentModal(nominal, ref || null);
    } catch (e) {
      console.error(e);
      showToast('⚠️ Gagal membuat transaksi topup.');
      hideLoader();
    } finally {
      unlock();
    }
  });
}

// ---------- ADMIN ----------
function openAdminLogin() {
  openModal(`
    <h3 class="reveal">Login Admin</h3>
    <p class="reveal">Masukkan password untuk mengelola riwayat.</p>
    <input id="adminPass" type="password" placeholder="Password Admin"
      class="reveal"
      style="width:100%;padding:10px;border:1px solid #30363d;border-radius:8px;background:transparent;color:var(--accent);margin-top:8px">
    <div class="reveal" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button id="cancelAdmin" class="btn secondary" type="button">Batal</button>
      <button id="loginAdmin" class="btn primary" type="button">Masuk</button>
    </div>
  `);

  initScrollReveal();

  document.getElementById('cancelAdmin')?.addEventListener('click', closeModal);
  document.getElementById('loginAdmin')?.addEventListener('click', () => {
    const pass = (document.getElementById('adminPass')?.value || '').trim();
    if (pass === ADMIN_PASSWORD) { adminLoggedIn = true; openAdminPanel(); }
    else showToast('🔒 Password salah.');
  });
}

async function openAdminPanel() {
  if (!adminLoggedIn) return openAdminLogin();

  const list = await apiGetTransactions();
  const rows = list.map((it, idx) => {
    const amount = it.price || it.amount || 0;
    return `
      <tr class="reveal" data-id="${it.trxId}">
        <td>${idx + 1}</td>
        <td style="font-family:monospace">${it.trxId}</td>
        <td>${it.title || (it.type === 'topup' ? 'Topup' : 'Transaksi')}</td>
        <td>Rp ${fmt(amount)}</td>
        <td>
          <select class="statusSel" style="padding:6px;border-radius:6px;border:1px solid #30363d;background:transparent;color:var(--accent)">
            <option value="pending" ${it.status==='pending'?'selected':''}>pending</option>
            <option value="paid" ${it.status==='paid'?'selected':''}>paid</option>
            <option value="cancelled" ${it.status==='cancelled'?'selected':''}>cancelled</option>
          </select>
        </td>
        <td style="font-size:12px;color:var(--muted)">${new Date(it.time).toLocaleString()}</td>
      </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:#999">Belum ada transaksi</td></tr>`;

  openModal(`
    <h3 class="reveal">Panel Admin — Kelola Riwayat</h3>
    <input id="searchTrxInput" placeholder="Cari ID Transaksi..." 
      class="reveal"
      style="width:60%;padding:8px;border:1px solid #30363d;border-radius:8px;background:transparent;color:var(--accent);margin-bottom:10px">

    <div class="reveal" style="overflow:auto;max-height:60vh;border:1px solid #30363d;border-radius:10px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #30363d">#</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #30363d">Trx ID</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #30363d">Produk</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #30363d">Nominal</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #30363d">Status</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #30363d">Waktu</th>
          </tr>
        </thead>
        <tbody id="adminRows">${rows}</tbody>
      </table>
    </div>

    <div class="reveal" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button id="markAllPaid" class="btn secondary" type="button">Tandai Semua Paid</button>
      <button id="adminLogout" class="btn secondary" type="button">Logout</button>
      <button id="adminSave" class="btn primary" type="button">Simpan Perubahan</button>
    </div>
  `);

  initScrollReveal();

  const searchInput = document.getElementById('searchTrxInput');
  const tbody = document.getElementById('adminRows');

  // Cari ID realtime
  searchInput?.addEventListener('input', () => {
    const keyword = searchInput.value.trim().toLowerCase();
    tbody.querySelectorAll('tr').forEach(tr => {
      const id = tr.querySelector('td:nth-child(2)')?.textContent?.toLowerCase() || '';
      tr.style.display = id.includes(keyword) ? '' : 'none';
    });
  });

  // Tandai semua paid (belum commit)
  document.getElementById('markAllPaid')?.addEventListener('click', () => {
    tbody.querySelectorAll('.statusSel').forEach(sel => sel.value = 'paid');
    showToast('💰 Semua transaksi ditandai sebagai PAID (belum disimpan).');
  });

  // Logout
  document.getElementById('adminLogout')?.addEventListener('click', () => {
    adminLoggedIn = false;
    closeModal();
    showToast('✅ Logout admin.');
  });

  // Simpan perubahan
  document.getElementById('adminSave')?.addEventListener('click', async () => {
    const items = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const id = tr.getAttribute('data-id');
      const sel = tr.querySelector('.statusSel');
      items.push({ trxId: id, status: sel?.value || 'pending' });
    });
    const res = await apiBulkUpdateStatus(items);
    if (res?.ok === false) return; // sudah ada toast error
    showToast('💾 Perubahan status disimpan.');
  });
}

// ---------- HELPERS ----------
function setActive(btn) {
  document.querySelectorAll('.menu-big').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
}
/* === BANNER CONFIG (boleh ubah path & caption) === */
const BANNERS = [
  { src: 'assets/banners/1.jpg', caption: 'Promo Akun VIP — Diskon Akhir Pekan!' },
  { src: 'assets/banners/2.jpg', caption: 'Topup Cepat via QRIS — Langsung Masuk!' },
  { src: 'assets/banners/3.jpg', caption: 'Event Bonus Akun Baru — Stok Terbatas!' }
];

/* === INJECT BANNER (rotator) === */
function injectBanner(){
  // 1) cari mount point (kalau gak ada, buat setelah .app-top)
  let mount = document.getElementById('bannerMount');
  if (!mount) {
    const header = document.querySelector('.app-top');
    if (!header) return; // header belum kebaca
    mount = document.createElement('div');
    mount.id = 'bannerMount';
    header.insertAdjacentElement('afterend', mount);
  }

  // 2) jangan render dobel
  if (mount.querySelector('.banner-rotator')) return;

  // 3) buat struktur
  const box = document.createElement('div');
  box.className = 'banner-rotator';
  box.innerHTML = `
    <div class="banner-frame" id="bannerFrame">
      <div class="banner-grad"></div>
      <div class="banner-caption" id="bannerCaption"></div>
      <div class="banner-dots" id="bannerDots"></div>
    </div>`;
  mount.appendChild(box);

  // 4) render slide dari BANNERS (fallback jika kosong/404)
  const frame   = box.querySelector('#bannerFrame');
  const caption = box.querySelector('#bannerCaption');
  const dots    = box.querySelector('#bannerDots');

  const list = (Array.isArray(BANNERS) && BANNERS.length) ? BANNERS : [
    { src: 'assets/qris.jpg', caption: 'Selamat datang di Toko Juragan UB' }
  ];

  const slides = [];
  list.forEach((b,i)=>{
    const slide = document.createElement('div');
    slide.className = 'banner-slide';
    slide.style.backgroundImage = `url('${b.src}')`;
    slide.dataset.idx = i;

    // fallback jika gambar gagal
    const test = new Image();
    test.onerror = () => { slide.style.backgroundImage = `url('assets/qris.jpg')`; };
    test.src = b.src;

    frame.appendChild(slide);
    slides.push(slide);

    const dot = document.createElement('div');
    dot.className = 'banner-dot';
    dot.dataset.idx = i;
    dots.appendChild(dot);
  });

  if (!slides.length) return;

  let idx = 0, timer = null;
  function setActive(i){
    slides.forEach((s,k)=>s.classList.toggle('active', k===i));
    dots.querySelectorAll('.banner-dot').forEach((d,k)=>d.classList.toggle('active', k===i));
    caption.textContent = list[i].caption || '';
    idx = i;
  }
  const next = () => setActive((idx+1) % slides.length);
  const play = () => { timer = setInterval(next, 8000); };
  const pause = () => clearInterval(timer);

  // interaksi
  frame.addEventListener('mouseenter', pause);
  frame.addEventListener('mouseleave', play);
  frame.addEventListener('click', () => document.getElementById('menuBuy')?.click());
  dots.addEventListener('click', (e)=>{
    const d = e.target.closest('.banner-dot'); if(!d) return;
    pause(); setActive(+d.dataset.idx); play();
  });

  setActive(0);
  play();
}

// === LOGIN MAGIC LINK ===
function promptLogin() {
  openModal(`
    <h3>Login</h3>
    <p>Masukkan email untuk menerima magic link:</p>
    <input id="emailInput" type="email" class="input full" placeholder="nama@contoh.com"/>
    <div class="actions" style="margin-top:10px;justify-content:flex-end;gap:8px">
      <button class="btn secondary" id="cancelLogin">Batal</button>
      <button class="btn primary" id="sendLink">Kirim Link</button>
    </div>
  `);

  document.getElementById("cancelLogin").onclick = closeModal;
  document.getElementById("sendLink").onclick = async () => {
    const email = document.getElementById("emailInput").value.trim();
    if (!email) return alert("Isi email dulu ya");

    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: SITE_URL + "/index.html", // pastikan ada di Redirect URLs
      },
    });
    if (error) return alert(error.message);
    alert("Cek email kamu, klik magic link untuk login!");
    closeModal();
  };
}

// Auto-hide welcome jika sudah login (load awal & perubahan status)
sb.auth.getUser().then(({ data }) => {
  if (data?.user) document.getElementById("welcome")?.remove();
});
sb.auth.onAuthStateChange((_e, session) => {
  if (session?.user) document.getElementById("welcome")?.remove();
});

// ---------- EVENTS ----------
document.addEventListener('DOMContentLoaded', async () => {
  // load data
  await loadAccountsFile();
  // preload ringan gambar
  try {
    const imgs = [...new Set(accounts.map(a => a.img).concat([topupImage, demoQris]).filter(Boolean))];
    const results = await Promise.all(imgs.map(preloadImage));
    imgs.forEach((src, i) => preloadedMap.set(src, results[i]));
  } catch {}

  // Pasang banner rotator dari Script 2
  try { injectBanner(); } catch(e) { console.warn('injectBanner error:', e); }
  
  const welcome = document.getElementById('welcome');
  const enterBtn = document.getElementById('enterBtn');
  const menuBuy = document.getElementById('menuBuy');
  const menuTopup = document.getElementById('menuTopup');
  const previewBtn = document.getElementById('previewBtn');
  const buyNow = document.getElementById('buyNow');
  const historyBtn = document.getElementById('historyBtn');
  const adminBtn = document.getElementById('adminBtn');

  // Masuk: tambahkan efek (kalau CSS ada)
  enterBtn?.addEventListener("click", async () => {
  const { data } = await sb.auth.getUser();
  // Jika belum login → buka modal login
  if (!data?.user) return promptLogin();

  // Kalau sudah login → lanjut tutup welcome & render
  const card = document.querySelector(".welcome-card");
  const overlay = document.getElementById("welcome");
  if (card) card.classList.add("exit");
  if (overlay) overlay.classList.add("fade-out");
  setTimeout(() => {
    if (overlay) overlay.style.display = "none";
    setActive(menuBuy);
    renderBuy();
  }, 560);
});
  // Navigasi menu
  menuBuy?.addEventListener('click', () => { setActive(menuBuy); renderBuy(); });
  menuTopup?.addEventListener('click', () => { setActive(menuTopup); renderTopup(); });

  // Riwayat
  historyBtn?.addEventListener('click', openHistory);

  // Admin
  adminBtn?.addEventListener('click', () => adminLoggedIn ? openAdminPanel() : openAdminLogin());

  // Preview & Beli
  previewBtn?.addEventListener('click', () => {
    if (!selected) return alert('Pilih akun terlebih dahulu.');
    window.open(selected.img || demoQris, '_blank', 'noopener,noreferrer');
  });
  buyNow?.addEventListener('click', () => {
    if (!selected) return alert('Pilih akun terlebih dahulu.');
    if (selected.stock <= 0) return alert('Maaf, stok habis.');
    const unlock = lockButton(buyNow, 1500);
    showLoader('Menyiapkan pembayaran...');
    openBuyQrModal(selected);
    unlock();
  });

  // render awal
  renderBuy();
});