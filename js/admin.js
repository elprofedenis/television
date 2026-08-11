import { db } from "./firebase-config.js";
import { GRUPOS, ROLES } from "./roles.js";
import { ESTUDIANTES } from "./estudiantes.js";
import {
  ref,
  onValue,
  update,
  set,
  remove,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// ⚠️ Cambiá esta clave antes de subir el proyecto. Es solo un freno liviano
// para que un estudiante no entre por error al panel — no es seguridad real,
// porque las reglas de la base todavía están abiertas (ver Parte 3, más abajo).
const ADMIN_PASSCODE = "34792370";
const SESSION_FLAG = "tv2roles_admin_ok";

// --- DOM: gate ---
const screenGate = document.getElementById("screen-gate");
const inputPass = document.getElementById("inputPass");
const btnEntrar = document.getElementById("btnEntrar");
const errorGate = document.getElementById("errorGate");

// --- DOM: dashboard ---
const screenDashboard = document.getElementById("screen-dashboard");
const switchBoard = document.getElementById("switchBoard");
const countTotal = document.getElementById("countTotal");
const countPendientes = document.getElementById("countPendientes");
const countAprobados = document.getElementById("countAprobados");
const accessList = document.getElementById("accessList");
const btnAprobarTodos = document.getElementById("btnAprobarTodos");
const btnReiniciar = document.getElementById("btnReiniciar");
const boardTablaAdmin = document.getElementById("boardTablaAdmin");

let ultimoAccesos = {};
let boardHabilitadoActual = false;
let ultimasReservas = {};

// --- Board en vivo (solo lectura, para el docente) ---
construirEsqueletoBoardAdmin();

function construirEsqueletoBoardAdmin() {
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
      td.id = `admin-slot-${grupo.id}-${rol.id}`;
      td.className = "slot-cell";
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  boardTablaAdmin.innerHTML = "";
  boardTablaAdmin.appendChild(thead);
  boardTablaAdmin.appendChild(tbody);
}

function actualizarCeldasBoardAdmin() {
  // DNIs que ya tienen un rol en algún lado, para no ofrecerlos en los
  // desplegables de casilleros vacíos (evita asignar a alguien dos veces).
  const dnisAsignados = new Set();
  for (const grupo of GRUPOS) {
    for (const rol of ROLES) {
      const data = ultimasReservas?.[grupo.id]?.[rol.id];
      if (data) dnisAsignados.add(data.dni);
    }
  }

  for (const grupo of GRUPOS) {
    for (const rol of ROLES) {
      const td = document.getElementById(`admin-slot-${grupo.id}-${rol.id}`);
      if (!td) continue;

      const data = ultimasReservas?.[grupo.id]?.[rol.id] || null;

      td.innerHTML = "";
      td.className = "slot-cell";

      if (data) {
        td.classList.add(`slot-cell--${grupo.id}`);
        td.title = `DNI ${data.dni}`;

        const wrap = document.createElement("div");
        wrap.className = "slot";
        wrap.innerHTML = `<span class="slot__nombre slot__nombre--other">${data.nombre}</span>`;

        const btnQuitar = document.createElement("button");
        btnQuitar.className = "slot__quitar";
        btnQuitar.textContent = "Quitar";
        btnQuitar.addEventListener("click", () =>
          quitarDeCasillero(grupo.id, rol.id, data.dni)
        );
        wrap.appendChild(btnQuitar);

        td.appendChild(wrap);
      } else {
        td.classList.add("slot-cell--empty");
        td.removeAttribute("title");

        const select = document.createElement("select");
        select.className = "slot__asignar";

        const optDefault = document.createElement("option");
        optDefault.value = "";
        optDefault.textContent = "Asignar…";
        optDefault.disabled = true;
        optDefault.selected = true;
        select.appendChild(optDefault);

        const disponibles = ESTUDIANTES.filter(
          (e) => !dnisAsignados.has(e.dni)
        ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

        for (const est of disponibles) {
          const opt = document.createElement("option");
          opt.value = est.dni;
          opt.textContent = est.nombre;
          select.appendChild(opt);
        }

        select.addEventListener("change", () => {
          const est = ESTUDIANTES.find((e) => e.dni === select.value);
          if (!est) return;
          asignarACasillero(grupo.id, rol.id, est);
        });

        td.appendChild(select);
      }
    }
  }
}

// --- Asignar manualmente a un estudiante en un casillero vacío ---
function asignarACasillero(grupoId, rolId, estudiante) {
  update(ref(db), {
    [`reservas/${grupoId}/${rolId}`]: {
      dni: estudiante.dni,
      nombre: estudiante.nombre,
      timestamp: Date.now(),
    },
    [`reservaPorEstudiante/${estudiante.dni}`]: {
      grupo: grupoId,
      rolId,
    },
  });
}

// --- Quitar a quien esté en un casillero (libera el rol y su índice) ---
function quitarDeCasillero(grupoId, rolId, dni) {
  update(ref(db), {
    [`reservas/${grupoId}/${rolId}`]: null,
    [`reservaPorEstudiante/${dni}`]: null,
  });
}

// --- Gate de acceso ---
function entrarAlPanel() {
  screenGate.classList.add("hidden");
  screenDashboard.classList.remove("hidden");
  iniciarListeners();
}

btnEntrar.addEventListener("click", () => {
  if (inputPass.value === ADMIN_PASSCODE) {
    sessionStorage.setItem(SESSION_FLAG, "1");
    entrarAlPanel();
  } else {
    errorGate.textContent = "Clave incorrecta.";
  }
});

inputPass.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnEntrar.click();
});

if (sessionStorage.getItem(SESSION_FLAG) === "1") {
  entrarAlPanel();
}

// El board se escucha siempre, incluso antes de entrar con la clave,
// para que ya esté actualizado en cuanto el docente entra al panel.
onValue(ref(db, "reservas"), (snap) => {
  ultimasReservas = snap.val() || {};
  actualizarCeldasBoardAdmin();
});

// --- Listeners en tiempo real ---
function iniciarListeners() {
  onValue(ref(db, "accesos"), (snap) => {
    ultimoAccesos = snap.val() || {};
    renderLista();
  });

  onValue(ref(db, "config/boardHabilitado"), (snap) => {
    boardHabilitadoActual = snap.val() === true;
    switchBoard.checked = boardHabilitadoActual;
  });
}

// --- Render de la lista de accesos ---
function renderLista() {
  const entradas = Object.entries(ultimoAccesos).map(([dni, data]) => ({
    dni,
    ...data,
  }));

  entradas.sort((a, b) => (a.solicitadoEn || 0) - (b.solicitadoEn || 0));

  const pendientes = entradas.filter((e) => e.estado === "pendiente");
  const aprobados = entradas.filter((e) => e.estado === "aprobado");

  countTotal.textContent = entradas.length;
  countPendientes.textContent = pendientes.length;
  countAprobados.textContent = aprobados.length;

  btnAprobarTodos.disabled = pendientes.length === 0;

  if (entradas.length === 0) {
    accessList.innerHTML = `<p class="empty-state">Todavía no se conectó nadie.</p>`;
    return;
  }

  accessList.innerHTML = "";
  for (const e of entradas) {
    accessList.appendChild(renderFila(e));
  }
}

function renderFila(e) {
  const row = document.createElement("div");
  row.className = "access-row";

  const hora = e.solicitadoEn
    ? new Date(e.solicitadoEn).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  const esAprobado = e.estado === "aprobado";

  row.innerHTML = `
    <div class="access-row__info">
      <div class="access-row__nombre">${e.nombre ?? "(sin nombre)"}</div>
      <div class="access-row__meta">DNI ${e.dni} · ${hora}</div>
    </div>
    <div class="access-row__actions">
      <span class="chip ${esAprobado ? "chip--aprobado" : "chip--pendiente"}">
        ${esAprobado ? "Aprobado" : "Pendiente"}
      </span>
      <button class="btn-small ${esAprobado ? "btn-outline" : "btn-primary"}" data-accion="${esAprobado ? "revocar" : "aprobar"}">
        ${esAprobado ? "Revocar" : "Aprobar"}
      </button>
    </div>
  `;

  row.querySelector("button").addEventListener("click", () => {
    if (esAprobado) revocarAcceso(e.dni);
    else aprobarAcceso(e.dni);
  });

  return row;
}

// --- Acciones sobre un estudiante ---
function aprobarAcceso(dni) {
  update(ref(db), {
    [`accesos/${dni}/estado`]: "aprobado",
    [`accesos/${dni}/aprobadoEn`]: serverTimestamp(),
  });
}

function revocarAcceso(dni) {
  update(ref(db), {
    [`accesos/${dni}/estado`]: "pendiente",
    [`accesos/${dni}/aprobadoEn`]: null,
  });
}

// --- Aprobar a todos los pendientes de un solo click ---
btnAprobarTodos.addEventListener("click", () => {
  const updates = {};
  for (const [dni, data] of Object.entries(ultimoAccesos)) {
    if (data.estado === "pendiente") {
      updates[`accesos/${dni}/estado`] = "aprobado";
      updates[`accesos/${dni}/aprobadoEn`] = serverTimestamp();
    }
  }
  if (Object.keys(updates).length > 0) {
    update(ref(db), updates);
  }
});

// --- Switch: habilitar el board para todos ---
switchBoard.addEventListener("change", () => {
  set(ref(db, "config/boardHabilitado"), switchBoard.checked);
});

// --- Reiniciar todo (accesos, reservas y el switch del board) ---
btnReiniciar.addEventListener("click", async () => {
  const confirmacion1 = confirm(
    "Esto borra TODOS los accesos y reservas de roles, y apaga el board. ¿Continuar?"
  );
  if (!confirmacion1) return;

  const confirmacion2 = confirm(
    "Última confirmación: esta acción no se puede deshacer. ¿Reiniciar todo?"
  );
  if (!confirmacion2) return;

  await Promise.all([
    remove(ref(db, "accesos")),
    remove(ref(db, "reservas")),
    remove(ref(db, "reservaPorEstudiante")),
    set(ref(db, "config/boardHabilitado"), false),
  ]);
});
