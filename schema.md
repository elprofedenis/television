# Esquema de Firebase Realtime Database — TV2 Roles

```
tv2roles-default-rtdb
│
├── accesos/
│   └── {dni}/
│         nombre: "APELLIDO, Nombre"
│         estado: "pendiente" | "aprobado"
│         solicitadoEn: <timestamp>
│         aprobadoEn: <timestamp | null>
│
├── config/
│         boardHabilitado: true | false      // el docente lo activa cuando quiere que arranquen todos
│
├── reservas/
│   └── {grupo}/            // "grupo1" | "grupo2" | "grupo3"
│         └── {rolId}/          // ej "direccion_camara", "switcher", etc.
│               dni: "47581334"
│               nombre: "ALTAMIRANO, JULIÁN DAVID"
│               timestamp: <timestamp>
│
└── reservaPorEstudiante/
    └── {dni}/
          grupo: "grupo1"
          rolId: "direccion_camara"
```

## Por qué esta estructura

- **`accesos/{dni}`**: cuando un estudiante hace login (nombre + DNI), se crea/actualiza este nodo en estado `"pendiente"`. Vos, como docente, ves la lista en tiempo real y cambiás el estado a `"aprobado"` (individual o en bloque). El estudiante queda esperando en una pantalla de "aguardando aprobación" hasta que su nodo pase a `"aprobado"`.

- **`config/boardHabilitado`**: aunque ya estén todos aprobados, el board de roles no se muestra hasta que vos actives este flag (así generás el efecto "arrancamos todos juntos" tras la cuenta regresiva).

- **`reservas/{grupo}/{rolId}`**: acá se guarda quién ocupa cada casillero. La reserva se escribe con una **transacción atómica** (`runTransaction`): solo se completa si el nodo está vacío. Esto es lo que garantiza que "el primer clic gana" sin condiciones de carrera, sin importar la latencia de cada celular.

- **`reservaPorEstudiante/{dni}`**: índice inverso. Sirve para dos cosas:
  1. Saber al instante si un estudiante ya tiene un rol (para bloquear que se anote en dos lugares).
  2. Si cierra el celu y vuelve a entrar (login de nuevo), lo llevamos directo a ver resaltada su última elección, tal como pediste.

## Nota sobre seguridad (para la Parte 3)

Como no vamos a usar Firebase Authentication "real" (el login es nombre + DNI contra tu lista, no un usuario/contraseña de Firebase), las reglas de Realtime Database no pueden validar de forma 100% segura *quién* escribe cada dato — cualquiera con el link técnicamente podría escribir directo a la base si se pone a hackear. Para un uso áulico esto normalmente no es un problema (nadie hace eso en la práctica), pero en la Parte 3 te muestro las reglas de seguridad razonables para este caso (bloquear escritura desde afuera de la app, limitar tamaño/formato de los datos) y te aviso si conviene sumar Firebase Anonymous Auth como capa extra. No es necesario que decidas esto ahora.
