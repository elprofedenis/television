// Configuración de grupos y roles - Television II

export const GRUPOS = [
  { id: "grupo1", label: "Grupo 1" },
  { id: "grupo2", label: "Grupo 2" },
  { id: "grupo3", label: "Grupo 3" },
];

// El "id" es la clave que se usa en Firebase (sin espacios/acentos raros para evitar problemas de path).
// El "label" es lo que se muestra en pantalla.
export const ROLES = [
  { id: "direccion_camara", label: "DIRECCIÓN DE CÁMARA", sub: "Hace también Dirección Gral" },
  { id: "switcher", label: "SWITCHER", sub: "" },
  { id: "camara_1", label: "CÁMARA 1", sub: "Hace también Asist de iluminación" },
  { id: "camara_2", label: "CÁMARA 2", sub: "Hace también Dir de iluminación" },
  { id: "camara_3", label: "CÁMARA 3", sub: "Hace también Asist de iluminación" },
  { id: "produccion_piso_1", label: "PRODUCCIÓN DE PISO 1", sub: "Hace también Producción Gral" },
  { id: "produccion_piso_2", label: "PRODUCCIÓN DE PISO 2", sub: "Asist" },
  { id: "sonidista", label: "SONIDISTA", sub: "Dirección de sonido y asist de consola / microfonista" },
  { id: "musicalizacion_fx", label: "MUSICALIZACIÓN Y FX", sub: "" },
  { id: "tapes", label: "TAPES", sub: "" },
  { id: "graph", label: "GRAPH", sub: "Zócalos" },
  { id: "arte_1", label: "ARTE 1", sub: "Dirección" },
  { id: "arte_2", label: "ARTE 2", sub: "Asist" },
  { id: "asistencia_general_1", label: "ASISTENCIA GENERAL 1", sub: "" },
  { id: "asistencia_general_2", label: "ASISTENCIA GENERAL 2", sub: "" },
];
