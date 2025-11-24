// KONFIGURASI KONTAK & TEMA
const ADMIN_NUMBER = "6287729805594";    // WhatsApp admin
const DANA_NUMBER = "085785654734 - GG";      // nomor Dana
const THEME_KEY = "ju_theme";

// GLOBAL STATE
let currentCategory = "";
let currentProduct = "";
let currentPrice = 0;
let currentIsPricelist = false;
let isTopupOrder = false;
let selectedTopupNominal = "";
let topupUsesCustom = false;

let topupOptionButtons = [];
let topupCustomInput = null;

let activeMenuKey = "akun";
let lastMenuBeforeHelp = "akun";

// UTIL
function formatRupiah(angka) {
  const num = Number(angka) || 0;
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getDateTimeID() {
  try {
    const d = new Date();
    const optsDate = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Jakarta"
    };
    const optsTime = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta"
    };

    const tanggal = new Intl.DateTimeFormat("id-ID", optsDate).format(d);
    const jam = new Intl.DateTimeFormat("id-ID", optsTime).format(d) + " WIB";
    return { tanggal, jam };
  } catch (e) {
    return { tanggal: "?", jam: "?" };
  }
}

// STATUS ONLINE/OFFLINE
function updateStatusOnline() {
  const statusTextEl = document.getElementById("statusText");
  const statusDotEl = document.getElementById("statusDot");
  const statusValueEl = document.getElementById("statusValue");

  if (!statusTextEl || !statusDotEl || !statusValueEl) return;

  try {
    const now = new Date();
    const opt = { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" };
    const hourStr = new Intl.DateTimeFormat("en-GB", opt).format(now);
    const hour = parseInt(hourStr, 10);

    const isOnline = hour >= 10 && hour < 23; // 10.00 - 21.59 WIB

    if (isOnline) {
      statusTextEl.textContent = "Online";
      statusDotEl.classList.remove("offline");
      statusValueEl.classList.remove("offline");
    } else {
      statusTextEl.textContent = "Offline / Slow respon";
      statusDotEl.classList.add("offline");
      statusValueEl.classList.add("offline");
    }
  } catch (e) {
    statusTextEl.textContent = "Online";
  }
}

// THEME HANDLING
function applyTheme(theme) {
  const body = document.body;
  const icon = document.getElementById("themeIcon");
  if (!body || !icon) return;

  if (theme === "dark") {
    body.classList.add("dark");
    icon.textContent = "☀️";
  } else {
    body.classList.remove("dark");
    icon.textContent = "🌙";
  }
}

function initTheme() {
  let theme = localStorage.getItem(THEME_KEY);
  if (theme !== "dark" && theme !== "light") {
    theme = "light";
  }
  applyTheme(theme);

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const isDark = document.body.classList.contains("dark");
      const newTheme = isDark ? "light" : "dark";
      localStorage.setItem(THEME_KEY, newTheme);
      applyTheme(newTheme);
    });
  }
}

// SLIDER
function initSlider() {
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");
  if (!slides.length || !dots.length) return;

  let current = 0;
  let timer = null;

  function showSlide(index) {
    current = index;
    slides.forEach((s, i) => s.classList.toggle("active", i === index));
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }

  function nextSlide() {
    const next = (current + 1) % slides.length;
    showSlide(next);
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.getAttribute("data-slide") || "0");
      showSlide(index);
      if (timer) clearInterval(timer);
      timer = setInterval(nextSlide, 4500);
    });
  });

  showSlide(0);
  timer = setInterval(nextSlide, 4500);
}

// MENU SWITCH + TUTORIAL PER MENU + ETA
function initMenuSwitch() {
  const menuBtns = document.querySelectorAll(".menu-btn[data-menu]");
  const sections = document.querySelectorAll(".menu-section");
  const titleEl = document.getElementById("menuTitle");
  const descEl = document.getElementById("menuDesc");
  const tutEl = document.getElementById("menuTutorial");
  const etaEl = document.getElementById("menuEta");
  
  // tambahin ini:
  const helpPanel = document.getElementById("helpPanel");
  const helpToggleBtn = document.getElementById("helpToggleBtn");
  const menuHeader = document.getElementById("menuHeader");

  if (!menuBtns.length || !sections.length || !titleEl || !descEl || !tutEl) return;

  function updateHeader(menu) {
    let title = "";
    let desc = "";
    let tut = "";
    let eta = "";

    switch (menu) {
      case "akun":
        title = "Menu Akun";
        desc = "Akun BUSSID siap pakai, tinggal login.";
        tut =
          "Tutorial Beli Akun: 1) Pilih akun 2) Klik Beli 3) Isi nama 4) Isi catatan/permintaan lain 5) Konfirmasi ke admin & tunggu data dikirim.";
        eta = "Estimasi proses: kirim data 5–30 menit setelah pembayaran.";
        break;
      case "topup":
        title = "Menu Top Up";
        desc = "TopUp UB sesuai pricelist, pilih nominal & kebutuhan.";
        tut =
          "Tutorial Top Up: 1) Lihat pricelist 2) Klik TopUp 3) Pilih nominal atau custom 4) Isi nama & di catatan 5) Konfirmasi ke admin & lanjut pembayaran.";
        eta = "Estimasi proses: 5–15 menit setelah pembayaran.";
        break;
      case "script":
        title = "Menu Script";
        desc = "Script UB & livery pack, ada tutorial pasang.";
        tut =
          "Tutorial Script: 1) Pilih script 2) Klik Beli 3) Isi nama 4) Tulis versi game/device di catatan 5) Konfirmasi ke admin untuk dapat link & tutorial.";
        eta = "Estimasi proses: kirim file & tutorial 5–20 menit setelah pembayaran.";
        break;
      case "mod":
        title = "Menu MOD";
        desc = "MOD bus & map custom untuk BUSSID.";
        tut =
          "Tutorial MOD: 1) Pilih MOD 2) Klik Beli 3) Isi nama 4) Tulis versi game & jenis MOD di catatan 5) Konfirmasi ke admin untuk dapat file & tutorial.";
        eta = "Estimasi proses: kirim file 5–20 menit setelah pembayaran.";
        break;
      case "kd":
        title = "Menu KD";
        desc = "Jasa KD & cek akun.";
        tut =
          "Tutorial KD: 1) Pilih paket KD 2) Klik Order 3) Isi nama 4) Jelaskan kebutuhan KD di catatan 5) Konfirmasi ke admin, proses lanjut via chat.";
        eta = "Estimasi proses: 5–30 menit, tergantung antrian.";
        break;
      case "livery":
        title = "Menu Livery";
        desc = "Livery pack & custom livery.";
        tut =
          "Tutorial Livery: 1) Pilih pack/custom 2) Klik Beli 3) Isi nama 4) Tulis jenis bus & tema livery di catatan 5) Konfirmasi ke admin & tunggu file livery.";
        eta = "Estimasi proses: kirim file 5–20 menit setelah pembayaran.";
        break;
      default:
        title = "Menu";
        desc = "";
        tut = "";
        eta = "";
    }

    titleEl.textContent = title;
    descEl.textContent = desc;
    tutEl.textContent = tut;
    if (etaEl) etaEl.textContent = eta;
  }

  function setActive(menu) {
    activeMenuKey = menu;

    // setiap kali pindah menu → pastikan header muncul & bantuan tertutup
    if (menuHeader) menuHeader.classList.remove("hidden");
    if (helpPanel) helpPanel.classList.add("hidden");
    if (helpToggleBtn) helpToggleBtn.classList.remove("active");

    menuBtns.forEach((btn) => {
      const m = btn.getAttribute("data-menu");
      btn.classList.toggle("active", m === menu);
    });

    sections.forEach((sec) => {
      const m = sec.getAttribute("data-menu");
      sec.classList.toggle("active", m === menu);
    });

    updateHeader(menu);
  }

  menuBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const menu = btn.getAttribute("data-menu");
      if (!menu) return;
      setActive(menu);
    });
  });

  setActive("akun");
}

// RESET TOPUP CONTROLS
function resetTopupControls() {
  selectedTopupNominal = "";
  topupUsesCustom = false;

  if (topupOptionButtons && topupOptionButtons.length) {
    topupOptionButtons.forEach((btn) => btn.classList.remove("active"));
  }
  if (topupCustomInput) {
    topupCustomInput.value = "";
  }
  const wrapper = document.getElementById("topupCustomWrapper");
  if (wrapper) {
    wrapper.style.display = "none";
  }
}

// SET PAYMENT METHOD
function setPaymentMethod(method) {
  const paymentInput = document.getElementById("orderPayment");
  const btnDana = document.getElementById("payDanaBtn");
  const btnQris = document.getElementById("payQrisBtn");
  const infoDana = document.getElementById("paymentInfoDana");
  const infoQris = document.getElementById("paymentInfoQris");

  if (!paymentInput || !btnDana || !btnQris || !infoDana || !infoQris) return;

  btnDana.classList.remove("active");
  btnQris.classList.remove("active");
  infoDana.classList.remove("active");
  infoQris.classList.remove("active");

  if (method === "Dana") {
    btnDana.classList.add("active");
    infoDana.classList.add("active");
    paymentInput.value = "Dana";
  } else if (method === "QRIS") {
    btnQris.classList.add("active");
    infoQris.classList.add("active");
    paymentInput.value = "QRIS";
  } else {
    paymentInput.value = "";
  }
}

// MODAL ORDER
function openOrderModal(category, name, price, isPricelist) {
  const backdrop = document.getElementById("orderBackdrop");
  const categoryInput = document.getElementById("orderCategory");
  const productInput = document.getElementById("orderProduct");
  const priceInput = document.getElementById("orderPrice");
  const nameInput = document.getElementById("orderName");
  const noteInput = document.getElementById("orderNote");
  const refInput = document.getElementById("orderRef");
  const paymentInput = document.getElementById("orderPayment");
  const errorEl = document.getElementById("orderError");
  const topupGroup = document.getElementById("topupNominalGroup");

  if (
    !backdrop ||
    !categoryInput ||
    !productInput ||
    !priceInput ||
    !nameInput ||
    !noteInput ||
    !paymentInput ||
    !errorEl
  ) {
    return;
  }

  currentCategory = category || "Produk";
  currentProduct = name || "";
  currentPrice = Number(price) || 0;
  currentIsPricelist = !!isPricelist;
  isTopupOrder = currentCategory === "Top Up";

  categoryInput.value = currentCategory;
  productInput.value = currentProduct;
  nameInput.value = "";
  noteInput.value = "";

  if (refInput && !refInput.readOnly) {
    refInput.value = "";
  }

  paymentInput.value = "";
  errorEl.textContent = "";
  errorEl.classList.remove("show");

  if (isTopupOrder || currentIsPricelist) {
    priceInput.value = "Sesuai pricelist";
  } else {
    priceInput.value = "Rp " + formatRupiah(currentPrice);
  }

  if (topupGroup) {
    if (isTopupOrder) {
      topupGroup.style.display = "block";
      resetTopupControls();
    } else {
      topupGroup.style.display = "none";
      resetTopupControls();
    }
  }

  setPaymentMethod("");

  backdrop.classList.add("open");
}

function closeOrderModal() {
  const backdrop = document.getElementById("orderBackdrop");
  if (backdrop) backdrop.classList.remove("open");
}

// MODAL DETAIL
function openDetailModal(title, imgSrc, imgAlt, text) {
  const backdrop = document.getElementById("detailBackdrop");
  const imgEl = document.getElementById("detailImage");
  const titleEl = document.getElementById("detailTitle");
  const textEl = document.getElementById("detailText");

  if (!backdrop || !imgEl || !titleEl || !textEl) return;

  imgEl.src = imgSrc || "";
  imgEl.alt = imgAlt || title || "Detail produk";
  titleEl.textContent = title || "Detail Produk";
  textEl.textContent = text || "Detail belum diisi.";

  backdrop.classList.add("open");
}

function closeDetailModal() {
  const backdrop = document.getElementById("detailBackdrop");
  if (backdrop) backdrop.classList.remove("open");
}

// TOAST
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 5000);
}

// KIRIM KE WA
function handleSendWA() {
  const categoryInput = document.getElementById("orderCategory");
  const productInput = document.getElementById("orderProduct");
  const priceInput = document.getElementById("orderPrice");
  const nameInput = document.getElementById("orderName");
  const noteInput = document.getElementById("orderNote");
  const refInput = document.getElementById("orderRef");
  const paymentInput = document.getElementById("orderPayment");
  const errorEl = document.getElementById("orderError");

  if (
    !productInput ||
    !categoryInput ||
    !priceInput ||
    !nameInput ||
    !noteInput ||
    !paymentInput ||
    !errorEl
  ) {
    return;
  }

  const prod = (productInput.value || "").trim();
  const cat = (categoryInput.value || "").trim();
  const priceText = (priceInput.value || "").trim();
  const name = (nameInput.value || "").trim();
  const note = (noteInput.value || "").trim();
  const refCode = refInput ? (refInput.value || "").trim() : "";
  const payment = (paymentInput.value || "").trim();

  const customInput = topupCustomInput;
  let nominalText = selectedTopupNominal;

  let errorMsg = "";

  if (!name) {
    errorMsg = "Nama wajib diisi.";
  } else if (!prod) {
    errorMsg = "Jenis/barang tidak valid.";
  } else if (!priceText) {
    errorMsg = "Harga tidak valid.";
  } else if (!payment) {
    errorMsg = "Pilih metode pembayaran (Dana / QRIS).";
  }

  if (!errorMsg && isTopupOrder) {
    if (topupUsesCustom) {
      if (!customInput || !customInput.value.trim()) {
        errorMsg = "Isi nominal custom terlebih dahulu (contoh: 75).";
      } else {
        nominalText = customInput.value.trim() + "K";
      }
    } else if (!nominalText) {
      errorMsg = "Pilih salah satu nominal topup.";
    }
  }

  if (errorMsg) {
    errorEl.textContent = errorMsg;
    errorEl.classList.add("show");
    return;
  }

  errorEl.textContent = "";
  errorEl.classList.remove("show");

  const { tanggal, jam } = getDateTimeID();

  const lines = [];

  lines.push("🛒 *FORM ORDER JURAGAN UB*");
  lines.push("================================");
  lines.push("👤 Nama          : " + name);
  lines.push("📦 Jenis/Barang  : " + prod);
  lines.push("📂 Kategori      : " + cat);
  lines.push("💰 Harga         : " + priceText);

  if (isTopupOrder) {
    lines.push("💎 Nominal TopUp : " + (nominalText || "-"));
  }

  lines.push("🎟 Referral Code : " + (refCode || "-"));
  lines.push("💳 Pembayaran    : " + payment);
  lines.push("");
  lines.push("📝 Catatan:");
  lines.push(note ? note : "-");
  lines.push("");
  lines.push("⏱ Waktu order   : " + tanggal + " " + jam);
  lines.push("");
  lines.push("📌 *Catatan Penting*:");
  lines.push("- Pembayaran bisa dilakukan saat chat dengan admin di WhatsApp.");
  if (payment === "Dana") {
    lines.push("- Jika via Dana, kirim ke nomor: " + DANA_NUMBER + ".");
  } else if (payment === "QRIS") {
    lines.push("- Jika via QRIS, scan QR yang sudah tersedia di website.");
  }
  lines.push("- Mohon kirim *bukti transfer / screenshot pembayaran* setelah melakukan pembayaran.");
  lines.push("");
  lines.push("Terima kasih sudah order di *Juragan UB* 🙏");

  const url =
    "https://wa.me/" +
    ADMIN_NUMBER +
    "?text=" +
    encodeURIComponent(lines.join("\n"));

  window.open(url, "_blank");
  closeOrderModal();

  // Tampilkan toast
  showToast("Form pesanan dibuat. Silakan lanjut di WhatsApp & kirim bukti transfer ya 🙏");
}

// INIT REFERRAL (LOCK JIKA ADA ?ref= DI URL)
function initReferralCode() {
  const refInput = document.getElementById("orderRef");
  const refNote = document.getElementById("refNote");
  if (!refInput) return;

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") || params.get("reff") || params.get("referral");

  if (ref) {
    refInput.value = ref;
    refInput.readOnly = true;
    refInput.classList.add("readonly");
    if (refNote) refNote.style.display = "block";
  } else {
    if (refNote) refNote.style.display = "none";
  }
}

// INIT
document.addEventListener("DOMContentLoaded", function () {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Sembunyikan splash setelah beberapa detik
  const splash = document.getElementById("splash");
  if (splash) {
    setTimeout(() => {
      splash.classList.add("hide");
    }, 5000); // 1200ms = 1,2 detik, boleh kamu ganti
  }

  initTheme();
  updateStatusOnline();
  setInterval(updateStatusOnline, 60000);

  const danaText = document.getElementById("danaNumberText");
  if (danaText) {
    danaText.textContent = DANA_NUMBER;
  }

  initReferralCode();

  const btnToMenu = document.getElementById("btnToMenu");
  const menuSwitch = document.getElementById("menuSwitch");
  const mainArea = document.getElementById("mainArea");

  if (btnToMenu) {
    btnToMenu.addEventListener("click", () => {
      if (!mainArea) return;
      const willShow = mainArea.classList.contains("hidden");

      if (willShow) {
        mainArea.classList.remove("hidden");
        if (menuSwitch) {
          menuSwitch.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        mainArea.classList.add("hidden");
      }
    });
  }

  initSlider();
  initMenuSwitch();

// TOMBOL TUTORIAL / BANTUAN DI MENU
  const helpToggleBtn = document.getElementById("helpToggleBtn");
  const helpPanel = document.getElementById("helpPanel");
  const menuHeader = document.getElementById("menuHeader");

  if (helpToggleBtn && helpPanel) {
    helpToggleBtn.addEventListener("click", () => {
      const isHidden = helpPanel.classList.contains("hidden");
      const menuSections = document.querySelectorAll(".menu-section");
      const menuButtons = document.querySelectorAll(".menu-btn[data-menu]");

      if (isHidden) {
        // buka bantuan
        lastMenuBeforeHelp = activeMenuKey || "akun";

        menuSections.forEach((sec) => sec.classList.remove("active"));
        menuButtons.forEach((btn) => btn.classList.remove("active"));

        helpPanel.classList.remove("hidden");
        helpToggleBtn.classList.add("active");
        if (menuHeader) menuHeader.classList.add("hidden");

        helpPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // tutup bantuan, balik ke menu terakhir
        helpPanel.classList.add("hidden");
        helpToggleBtn.classList.remove("active");
        if (menuHeader) menuHeader.classList.remove("hidden");

        const lastBtn = document.querySelector(
          '.menu-btn[data-menu="' + lastMenuBeforeHelp + '"]'
        );
        if (lastBtn) {
          lastBtn.click();
        } else {
          const akunBtn = document.querySelector('.menu-btn[data-menu="akun"]');
          if (akunBtn) akunBtn.click();
        }
      }
    });
  }

  // SHORTCUT "LIHAT BANTUAN UNTUK MENU INI"
  const menuHelpShortcut = document.getElementById("menuHelpShortcut");
  if (menuHelpShortcut && helpPanel && helpToggleBtn) {
    menuHelpShortcut.addEventListener("click", () => {
      const isHidden = helpPanel.classList.contains("hidden");
      const menuSections = document.querySelectorAll(".menu-section");
      const menuButtons = document.querySelectorAll(".menu-btn[data-menu]");

      if (isHidden) {
        lastMenuBeforeHelp = activeMenuKey || "akun";
        menuSections.forEach((sec) => sec.classList.remove("active"));
        menuButtons.forEach((btn) => btn.classList.remove("active"));
        helpPanel.classList.remove("hidden");
        helpToggleBtn.classList.add("active");
        if (menuHeader) menuHeader.classList.add("hidden");
      }
      helpPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // QUICK ORDER PANEL
  const quickBtn = document.getElementById("quickOrderBtn");
  const quickPanel = document.getElementById("quickPanel");

  if (quickBtn && quickPanel) {
    quickBtn.addEventListener("click", () => {
      const isHidden = quickPanel.classList.contains("hidden");
      quickPanel.classList.toggle("hidden", !isHidden);
      if (isHidden) {
        quickPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        quickBtn.textContent = "Tutup cara order";
      } else {
        quickBtn.textContent = "Cara order cepat";
      }
    });
  }

  // floating WA
  const floatWA = document.getElementById("floatWA");
  if (floatWA) {
    floatWA.addEventListener("click", function (e) {
      e.preventDefault();
      const url =
        "https://wa.me/" +
        ADMIN_NUMBER +
        "?text=" +
        encodeURIComponent("Halo admin, saya mau order / tanya dulu.");
      window.open(url, "_blank");
    });
  }

  // modal order events
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnCancelModal = document.getElementById("btnCancelModal");
  const btnSendWA = document.getElementById("btnSendWA");
  const orderBackdrop = document.getElementById("orderBackdrop");

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeOrderModal);
  if (btnCancelModal) btnCancelModal.addEventListener("click", closeOrderModal);
  if (orderBackdrop) {
    orderBackdrop.addEventListener("click", (e) => {
      if (e.target === orderBackdrop) closeOrderModal();
    });
  }
  if (btnSendWA) btnSendWA.addEventListener("click", handleSendWA);

  // modal detail events
  const btnCloseDetail = document.getElementById("btnCloseDetail");
  const detailBackdrop = document.getElementById("detailBackdrop");

  if (btnCloseDetail) {
    btnCloseDetail.addEventListener("click", closeDetailModal);
  }
  if (detailBackdrop) {
    detailBackdrop.addEventListener("click", (e) => {
      if (e.target === detailBackdrop) closeDetailModal();
    });
  }

  // init topup controls
  topupOptionButtons = Array.from(
    document.querySelectorAll(".topup-option")
  );
  topupCustomInput = document.getElementById("topupCustom");

  if (topupOptionButtons.length) {
    topupOptionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-value") || "";
        topupOptionButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (val === "custom") {
          topupUsesCustom = true;
          selectedTopupNominal = "";
          const wrapper = document.getElementById("topupCustomWrapper");
          if (wrapper) {
            wrapper.style.display = "block";
          }
          if (topupCustomInput) {
            topupCustomInput.focus();
          }
        } else {
          topupUsesCustom = false;
          selectedTopupNominal = val;
          const wrapper = document.getElementById("topupCustomWrapper");
          if (wrapper) {
            wrapper.style.display = "none";
          }
          if (topupCustomInput) {
            topupCustomInput.value = "";
          }
        }
      });
    });
  }

  // init payment buttons
  const btnDana = document.getElementById("payDanaBtn");
  const btnQris = document.getElementById("payQrisBtn");

  if (btnDana) {
    btnDana.addEventListener("click", () => setPaymentMethod("Dana"));
  }
  if (btnQris) {
    btnQris.addEventListener("click", () => setPaymentMethod("QRIS"));
  }

  // produk (beli & detail)
  const cards = document.querySelectorAll(".card");
  cards.forEach((card) => {
    const buyBtn = card.querySelector(".btn-buy");
    const detailBtn = card.querySelector(".btn-detail");
    const name = card.getAttribute("data-name") || "";
    const price = Number(card.getAttribute("data-price") || "0");
    const category = card.getAttribute("data-category") || "Produk";
    const isPricelist = card.getAttribute("data-pricelist") === "true";

    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        openOrderModal(category, name, price, isPricelist);
      });
    }

    if (detailBtn) {
      detailBtn.addEventListener("click", () => {
        const detailText =
          detailBtn.getAttribute("data-detail") || "Detail belum diisi.";
        const img = card.querySelector(".card-img img");
        const imgSrc = img ? img.getAttribute("src") : "";
        const imgAlt = img ? img.getAttribute("alt") || name : name;

        openDetailModal(name, imgSrc, imgAlt, detailText);
      });
    }
  });
});