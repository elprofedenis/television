// ====== CONFIGURACIÓN ======
const CONFIG = {
  URL: "https://script.google.com/macros/s/AKfycbxnpdEelP_JCZBSZJjRXOi-gcHp9LJtH4CF3xT-Z6dC69fcu-yzTQqf1EPw6-5sAeZVRA/exec",      // URL de la Web App de Apps Script (termina en /exec). Vacío = modo prueba local
  KEY: "",      // Clave opcional (debe ser igual a la de Code.gs)
  POLL_MS: 1200 // cada cuánto consulta graph.html si hay algo nuevo
};

const EMPTY = { id: 0, visible: false, small: "", big: "" };

const Sync = {
  async get() {
    if (!CONFIG.URL) return JSON.parse(localStorage.getItem("zocalo") || "null") || EMPTY;
    const r = await fetch(CONFIG.URL + "?t=" + Date.now());
    return r.json();
  },
  async set(s) {
    s.id = Date.now();
    if (!CONFIG.URL) { localStorage.setItem("zocalo", JSON.stringify(s)); return s; }
    await fetch(CONFIG.URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ key: CONFIG.KEY, ...s })
    });
    return s;
  }
};