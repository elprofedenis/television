import { db } from "./firebase-config.js";
import { ESTUDIANTES } from "./estudiantes.js";
import { initBoard, destroyBoard } from "./board.js";
import {
  ref,
  get,
  set,
  onValue,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const STORAGE_KEY = "tv2roles_dni";

// --- Referencias a elementos del DOM ---
const screens = {
  login: document.getElementById("screen-login"),
  pendiente: document.getElementById("screen-pendiente"),
  aprobado: document.getElementById("screen-aprobado"),
  boardPlaceholder: document.getElementById("screen-board-placeholder"),
};
const tally = document.getElementById("tally");
const tallyLabel = document.getElementById("tally-label");

const selectNombre = document.getElementById("selectNombre");
const campoDni = document.getElementById("campoDni");
const inputDni = document.getElementById("inputDni");
const btnIngresar = document.getElementById("btnIngresar");
const errorLogin = document.getElementById("errorLogin");

const nombrePendiente = document.getElementById("nombrePendiente");
const nombreAprobado = document.getElementById("nombreAprobado");
const nombreBoard = document.getElementById("nombreBoard");

let estudianteSeleccionado = null;
let unsubscribeAccesos = null;
let unsubscribeConfig = null;

// --- Utilidades de pantalla ---
function mostrarPantalla(nombre) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[nombre].classList.remove("hidden");
}

function setTally(estado) {
  // estado: "login" | "pendiente" | "aprobado" | "en-vivo"
  tally.dataset.state = estado;
  const labels = {
    login: "INGRESO",
    pendiente: "PENDIENTE",
    aprobado: "APROBADO",
    "en-vivo": "EN VIVO",
  };
  tallyLabel.textContent = labels[estado] || "";
}

// --- Poblar el dropdown ---
const estudiantesOrdenados = [...ESTUDIANTES].sort((a, b) =>
  a.nombre.localeCompare(b.nombre, "es")
);

const optDefault = document.createElement("option");
optDefault.value = "";
optDefault.textContent = "— Elegí tu nombre —";
optDefault.disabled = true;
optDefault.selected = true;
selectNombre.appendChild(optDefault);

for (const est of estudiantesOrdenados) {
  const opt = document.createElement("option");
  opt.value = est.dni;
  opt.textContent = est.nombre;
  selectNombre.appendChild(opt);
}

selectNombre.addEventListener("change", () => {
  const dni = selectNombre.value;
  estudianteSeleccionado = ESTUDIANTES.find((e) => e.dni === dni) || null;
  errorLogin.textContent = "";
  inputDni.value = "";
  campoDni.classList.toggle("hidden", !estudianteSeleccionado);
  if (estudianteSeleccionado) inputDni.focus();
});

// --- Envío del login ---
btnIngresar.addEventListener("click", async () => {
  errorLogin.textContent = "";

  if (!estudianteSeleccionado) {
    errorLogin.textContent = "Elegí tu nombre de la lista.";
    return;
  }

  const dniIngresado = inputDni.value.trim();
  if (!dniIngresado) {
    errorLogin.textContent = "Ingresá tu DNI.";
    return;
  }

  if (dniIngresado !== estudianteSeleccionado.dni) {
    errorLogin.textContent = "El DNI no coincide con el nombre seleccionado.";
    return;
  }

  btnIngresar.disabled = true;
  btnIngresar.textContent = "Ingresando…";

  try {
    await registrarAcceso(estudianteSeleccionado);
    localStorage.setItem(STORAGE_KEY, estudianteSeleccionado.dni);
    iniciarEscuchaDeEstado(estudianteSeleccionado);
  } catch (err) {
    console.error(err);
    errorLogin.textContent =
      "No se pudo conectar. Revisá tu internet e intentá de nuevo.";
    btnIngresar.disabled = false;
    btnIngresar.textContent = "Ingresar";
  }
});

// --- Crea el pedido de acceso en Firebase (si no existía) ---
async function registrarAcceso(estudiante) {
  const accesoRef = ref(db, `accesos/${estudiante.dni}`);
  const snap = await get(accesoRef);

  if (!snap.exists()) {
    await set(accesoRef, {
      nombre: estudiante.nombre,
      estado: "pendiente",
      solicitadoEn: serverTimestamp(),
      aprobadoEn: null,
    });
  }
  // Si ya existía (por ejemplo, volvió a entrar), no se pisa el estado:
  // si ya estaba "aprobado", sigue aprobado.
}

// --- Escucha en tiempo real el estado de aprobación y del board ---
function iniciarEscuchaDeEstado(estudiante) {
  nombrePendiente.textContent = estudiante.nombre;
  nombreAprobado.textContent = estudiante.nombre;
  nombreBoard.textContent = estudiante.nombre;

  const accesoRef = ref(db, `accesos/${estudiante.dni}`);
  unsubscribeAccesos = onValue(accesoRef, (snap) => {
    const data = snap.val();

    if (!data || data.estado === "pendiente") {
      setTally("pendiente");
      mostrarPantalla("pendiente");
      return;
    }

    if (data.estado === "aprobado") {
      // Una vez aprobado, además hay que mirar si el docente ya habilitó el board
      escucharBoardHabilitado(estudiante);
    }
  });
}

function escucharBoardHabilitado(estudiante) {
  if (unsubscribeConfig) return; // ya está escuchando, evitar duplicar

  const configRef = ref(db, "config/boardHabilitado");
  unsubscribeConfig = onValue(configRef, (snap) => {
    const habilitado = snap.val() === true;

    if (habilitado) {
      setTally("en-vivo");
      document.querySelector(".card").classList.add("card--board");
      mostrarPantalla("boardPlaceholder");
      initBoard(estudiante);
    } else {
      document.querySelector(".card").classList.remove("card--board");
      setTally("aprobado");
      mostrarPantalla("aprobado");
    }
  });
}

// --- Cerrar sesión (volver a elegir nombre desde este dispositivo) ---
function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEY);
  if (unsubscribeAccesos) unsubscribeAccesos();
  if (unsubscribeConfig) unsubscribeConfig();
  unsubscribeAccesos = null;
  unsubscribeConfig = null;
  destroyBoard();
  document.querySelector(".card").classList.remove("card--board");
  estudianteSeleccionado = null;
  selectNombre.value = "";
  campoDni.classList.add("hidden");
  btnIngresar.disabled = false;
  btnIngresar.textContent = "Ingresar";
  setTally("login");
  mostrarPantalla("login");
}

document
  .querySelectorAll('[id^="btnCerrarSesion"]')
  .forEach((btn) => btn.addEventListener("click", cerrarSesion));

// --- Auto-resumir sesión si ya se había logueado en este dispositivo ---
(function intentarResumirSesion() {
  const dniGuardado = localStorage.getItem(STORAGE_KEY);
  if (!dniGuardado) {
    setTally("login");
    mostrarPantalla("login");
    return;
  }
  const estudiante = ESTUDIANTES.find((e) => e.dni === dniGuardado);
  if (!estudiante) {
    localStorage.removeItem(STORAGE_KEY);
    setTally("login");
    mostrarPantalla("login");
    return;
  }
  iniciarEscuchaDeEstado(estudiante);
})();
