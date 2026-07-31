# Mejoras visuales propuestas

Lista de trabajo pendiente sobre la interfaz, ordenada por **impacto sobre esfuerzo**.
Ninguna está implementada: es material para decidir, no un registro de lo hecho.

Cada punto dice **qué problema resuelve**, no solo qué se agrega. Una mejora que no resuelve
un problema concreto es decoración, y decoración es lo que hace que una interfaz envejezca mal.

El sistema visual vigente (superficies grafito translúcidas, cian como único color de acción,
tipografía Archivo, tokens de movimiento) está documentado en `apps/web/src/index.css` y en
CLAUDE.md. Todo lo de acá abajo debe respetarlo.

---

## Prioridad alta — mucho impacto, poco esfuerzo

### 1. Animación de salida de modales y de la hoja del circuito
**Problema**: hoy todo *entra* animado y *sale* de golpe. Ese corte seco es lo que hace que
una app se sienta hecha a mano aunque cada pantalla suelta esté bien.
**Por qué falta**: React desmonta el nodo apenas cambia el estado, así que no hay nada que
animar. Hace falta retener el elemento hasta que termine la transición.
**Cómo**: `transition-behavior: allow-discrete` + `@starting-style` (ya son Baseline y el
sistema de movimiento ya tiene las curvas y duraciones), o un hook de presencia de ~25 líneas
que retrase el desmontaje. Sin librerías.
**Alcance**: `Modal.tsx`, la hoja de `MapPage.tsx`, el visor de fotos, el menú de cuenta.

### 2. Etiquetas `og:` y `twitter:`
**Problema**: comprobado, hoy no hay ninguna. Compartir un enlace por WhatsApp o Instagram
muestra una tarjeta vacía, sin título ni imagen. Para un sitio cuyo crecimiento es "che, mirá
este circuito", es la diferencia entre que lo abran o no.
**Cómo**: metadatos estáticos en `index.html` para el sitio, y una imagen social. Lo ideal
—tarjeta por circuito— exige renderizado en el servidor y **no** entra acá: queda anotado
como etapa aparte.
**Costo**: bajo para la versión estática.

### 3. Estado vacío del mapa
**Problema**: existe el caso "no hay circuitos a menos de X km", pero no el de "todavía no hay
circuitos cargados" ni el de "se cayó la API". Hoy eso es un mapa vacío y un toast que se va
a los 4 segundos: la persona queda sin saber si buscó mal o si el sitio está roto.
**Cómo**: una tarjeta sobre el mapa con el motivo y una acción (reintentar / ver todos),
reusando `flotante` y `tarjeta`.

### 4. Arrastrar la hoja del circuito para cerrarla
**Problema**: en el teléfono la hoja solo se cierra con la ✕. El gesto natural es tirarla
hacia abajo, y no responder a un gesto esperado se siente como que la app no está terminada.
**Cómo**: `pointerdown/move/up` sobre el tirador que ya está dibujado, animando `translate`
(nunca `top`, que fuerza layout). Respetar `prefers-reduced-motion`.

---

## Prioridad media — se nota, cuesta más

### 5. Transición entre el mapa y la ficha
**Problema**: el salto entre pantallas es instantáneo y desorienta: no queda claro que la
ficha es "ese pin que toqué".
**Cómo**: View Transitions API, que React Router 7 ya soporta con `<Link viewTransition>`.
Degrada solo en navegadores sin soporte.
**Riesgo**: hay que probarla con el mapa de Leaflet montado; una transición sobre un canvas en
movimiento puede verse peor que ninguna.

### 6. Agrupar pines cercanos
**Problema**: con un circuito no se ve, pero es una bomba de tiempo. Con veinte circuitos
cercanos los discos se pisan y el mapa deja de ser legible justo cuando el proyecto tenga
contenido de verdad.
**Cómo**: agrupamiento propio por celda de grilla según el nivel de zoom. Evitar
`leaflet.markercluster`: son ~30 kB y trae su propia estética que habría que pelear.
**Cuándo**: antes de cargar la segunda decena de circuitos.

### 7. Foto de portada en la hoja del mapa
**Problema**: la hoja decide el viaje y hoy son solo números. Una foto del terreno comunica
más que "12,5 km · Intermedio".
**Costo real**: `CircuitSummary` no trae fotos, así que **cambia la API** (un campo con la
foto de portada en el listado). No es solo frontend.

### 8. Listado del panel como tabla en escritorio
**Problema**: el panel usa tarjetas apiladas también en monitor ancho; con muchos circuitos
obliga a un scroll largo para comparar estados.
**Cómo**: tabla de `lg:` para arriba, tarjetas en teléfono. Es la pantalla que más se usa para
cargar, así que la densidad importa.

### 9. Filtro por dificultad
**Problema**: se filtra por disciplina, pero "fácil o extremo" condiciona más si el circuito
sirve o no.
**Cómo**: extender la fila de chips sin agregar una barra nueva. Ojo con el amontonamiento que
ya costó resolver una vez.

---

## Prioridad baja — pulido

### 10. Compartir desde la ficha
Web Share API en el teléfono, copiar enlace en escritorio. Cierra el círculo con el punto 2.

### 11. Aviso mientras bajan los tiles
El LCP medido es un tile satelital a ~2,9 s en 4G lenta. Un fondo con textura o un mapa de
baja resolución mientras llega el real haría que la espera se sienta más corta, sin acelerar
nada. También bajaría el LCP si el sustituto es lo bastante grande.

### 12. Anunciar el cambio de página a los lectores de pantalla
Al navegar entre rutas, el foco se queda donde estaba y nada avisa que la pantalla cambió.
Se resuelve moviendo el foco al encabezado y con una región `aria-live`.

### 13. Pantallas de inicio y de instalación de la PWA
Faltan las imágenes de arranque de iOS y una captura para el instalador. Es lo que hace que
"agregar a inicio" se sienta una app y no un acceso directo.

### 14. Respetar `prefers-contrast`
Ya se respeta `prefers-reduced-motion`. Para quien pide más contraste, subir la opacidad de
las superficies y de los textos secundarios.

---

## Descartado a propósito

- **Modo claro**: la app se unificó en oscuro por una decisión medida (sobre foto satelital el
  blanco tiene menos contra qué recortarse, y a pleno sol encandila). Sostener dos temas
  duplicaría el trabajo de cada pantalla nueva.
- **Librería de animación**: el sistema de movimiento en CSS ya cubre lo que hace falta.
  Framer Motion son ~34 kB gzip en el arranque de una PWA que se abre con 4G en el cerro.
- **Unificar `MapControls` y `MapLayerToggle`**: parecen duplicados, pero resuelven cosas
  distintas y ya comparten los íconos. Unirlos sumaría una prop de configuración sin quitar
  código.
