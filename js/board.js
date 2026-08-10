import { db } from "./firebase-config.js";
import { GRUPOS, ROLES } from "./roles.js";
import {
  ref,
  onValue,
  runTransaction,
  set,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

let miDni = null;
let miNombre = null;
let boardInicializado = false;

let reservasActuales = {}; // snapshot completo de /reservas
let miReservaActual = null; // { grupo, rolId } | null

let unsubReservas = null;
let unsubMiReserva = null;

let avisoTimeout = null;

// --- Elementos del DOM (se resuelven una vez que el HTML del board existe) ---
let elTabla, elMiSeleccion, elBanner;

export function initBoard(estudiante) {
  if (boardInicializado) return;
  boardInicializado = true;

  miDni = estudiante.dni;
  miNombre = estudiante.nombre;

  elTabla = document.getElementById("boardTabla");
  elMiSeleccion = document.getElementById("miSeleccion");
  elBanner = document.getElementById("boardBanner");

  construirEsqueleto();
  attachListeners();
}

export function destroyBoard() {
  if (unsubReservas) unsubReservas();
  if (unsubMiReserva) unsubMiReserva();
  unsubReservas = null;
  unsubMiReserva = null;
  boardInicializado = false;
  reservasActuales = {};
  miReservaActual = null;
}

// --- Construye la tabla una sola vez (filas = roles, columnas = grupos) ---
function construirEsqueleto() {
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  const thCorner = document.createElement("th");
  thCorner.textContent = "Rol";
  trHead.appendChild(thCorner);

  for (const grupo of GRUPOS) {
    const th = document.createElement("th");
    th.textContent = grupo.label;
    th.classList.add(`board-th--${grupo.id}`);
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);

  const tbody = document.createElement("tbody");
  for (const rol of ROLES) {
    const tr = document.createElement("tr");

    const tdRol = document.createElement("td");
    tdRol.className = "role-cell";
    tdRol.innerHTML = `<div class="role-cell__label">${rol.label}</div>${
      rol.sub ? `<div class="role-cell__sub">${rol.sub}</div>` : ""
    }`;
    tr.appendChild(tdRol);

    for (const grupo of GRUPOS) {
      const td = document.createElement("td");
      td.id = `slot-${grupo.id}-${rol.id}`;
      td.className = "slot-cell";
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
  elTabla.innerHTML = "";
  elTabla.appendChild(thead);
  elTabla.appendChild(tbody);
}

function attachListeners() {
  unsubReservas = onValue(ref(db, "reservas"), (snap) => {
    reservasActuales = snap.val() || {};
    actualizarCeldas();
  });

  unsubMiReserva = onValue(
    ref(db, `reservaPorEstudiante/${miDni}`),
    (snap) => {
      miReservaActual = snap.val() || null;
      actualizarCeldas();
      actualizarMiSeleccion();
    }
  );
}

function actualizarMiSeleccion() {
  if (!miReservaActual) {
    elMiSeleccion.innerHTML = `Todavía no elegiste rol. Tocá cualquier casillero libre.`;
    elMiSeleccion.classList.remove("mi-seleccion--activa");
    return;
  }
  const rol = ROLES.find((r) => r.id === miReservaActual.rolId);
  const grupo = GRUPOS.find((g) => g.id === miReservaActual.grupo);
  elMiSeleccion.innerHTML = `Tu rol: <strong>${rol?.label ?? "?"}</strong> — ${
    grupo?.label ?? "?"
  }`;
  elMiSeleccion.classList.add("mi-seleccion--activa");
}

function actualizarCeldas() {
  for (const grupo of GRUPOS) {
    for (const rol of ROLES) {
      const td = document.getElementById(`slot-${grupo.id}-${rol.id}`);
      if (!td) continue;

      const data = reservasActuales?.[grupo.id]?.[rol.id] || null;
      const esMia = data && data.dni === miDni;
      const yoTengoOtroRol =
        miReservaActual &&
        !(miReservaActual.grupo === grupo.id && miReservaActual.rolId === rol.id);

      td.innerHTML = "";
      td.className = "slot-cell";

      if (esMia) {
        td.classList.add("slot-cell--mine", `slot-cell--${grupo.id}`);
        const wrap = document.createElement("div");
        wrap.className = "slot";
        wrap.innerHTML = `<span class="slot__nombre">${miNombre}</span><span class="slot__vos-tag">Vos</span>`;
        const btnCancelar = document.createElement("button");
        btnCancelar.className = "slot__cancelar";
        btnCancelar.textContent = "Cancelar";
        btnCancelar.addEventListener("click", cancelarReserva);
        wrap.appendChild(btnCancelar);
        td.appendChild(wrap);
      } else if (data) {
        td.classList.add("slot-cell--other", `slot-cell--${grupo.id}`);
        td.innerHTML = `<span class="slot__nombre slot__nombre--other">${data.nombre}</span>`;
      } else if (yoTengoOtroRol) {
        td.classList.add("slot-cell--disabled");
        td.innerHTML = `<span class="slot__vacio">—</span>`;
      } else {
        td.classList.add("slot-cell--empty");
        const btn = document.createElement("button");
        btn.className = "slot__reservar";
        btn.textContent = "Reservar";
        btn.addEventListener("click", () => reservarRol(grupo.id, rol.id));
        td.appendChild(btn);
      }
    }
  }
}

// --- Reservar: transacción atómica sobre el casillero + transacción sobre "un rol por persona" ---
async function reservarRol(grupoId, rolId) {
  if (miReservaActual) {
    mostrarAviso("Ya tenés un rol asignado. Cancelalo primero si querés cambiar.", "warn");
    return;
  }

  const slotRef = ref(db, `reservas/${grupoId}/${rolId}`);

  const slotResultado = await runTransaction(slotRef, (actual) => {
    if (actual !== null) return; // ya ocupado -> abortar
    return { dni: miDni, nombre: miNombre, timestamp: Date.now() };
  });

  if (!slotResultado.committed) {
    mostrarAviso("Justo se anotó otra persona ahí. Elegí otra opción.", "warn");
    return;
  }

  // Garantizar "un rol por persona" incluso si el estudiante tenía dos pestañas abiertas
  const miRef = ref(db, `reservaPorEstudiante/${miDni}`);
  const miResultado = await runTransaction(miRef, (actual) => {
    if (actual !== null) return; // ya tenía uno -> abortar
    return { grupo: grupoId, rolId };
  });

  if (!miResultado.committed) {
    // Rollback: liberar el casillero que acabamos de tomar
    await runTransaction(slotRef, (actual) => {
      if (actual && actual.dni === miDni) return null;
      return actual;
    });
    mostrarAviso("Ya tenías un rol asignado desde otra pestaña.", "warn");
  }
}

// --- Cancelar mi reserva actual ---
async function cancelarReserva() {
  if (!miReservaActual) return;
  const confirmado = confirm("¿Cancelar tu rol actual? Vas a poder elegir otro.");
  if (!confirmado) return;

  const { grupo, rolId } = miReservaActual;

  await runTransaction(ref(db, `reservas/${grupo}/${rolId}`), (actual) => {
    if (actual && actual.dni === miDni) return null;
    return actual;
  });

  await set(ref(db, `reservaPorEstudiante/${miDni}`), null);
}

// --- Aviso temporal (banner) ---
function mostrarAviso(mensaje, tipo = "info") {
  if (!elBanner) return;
  clearTimeout(avisoTimeout);
  elBanner.textContent = mensaje;
  elBanner.className = `board-banner board-banner--${tipo} board-banner--visible`;
  avisoTimeout = setTimeout(() => {
    elBanner.classList.remove("board-banner--visible");
  }, 3200);
}
