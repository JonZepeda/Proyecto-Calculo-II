# Instrucciones para Antigravity — Revisión de diseño (por Claude Code)

Lee este archivo completo antes de seguir editando. Estado verificado el 2026-10-03.

## Estado actual
- Hecho: `src/App.tsx` (layout) y `src/style.css` (tokens `.dsp-chassis`, `.dsp-well`, `.dsp-meter-card`, scrollbar, KaTeX).
- Pendiente: **ningún componente usa todavía los tokens `dsp-*`** y quedan **26 usos** de patrones que las skills prohíben
  (`rounded-2xl`, `backdrop-blur`, `shadow-cyan/amber/red/rose/emerald-*`, `Sparkles`, gradientes):
  AudioControls (9), MathLab (5), SpectrumAnalyzer (4), ABCompare (3), Oscilloscope (2), FilterControls (1), Spectrogram (1), ReportViewer (1).
  Navbar.tsx no se ha revisado.

## Tareas, en este orden
1. Reemplaza en cada componente `bg-neutral-900/70 border ... rounded-2xl shadow-xl backdrop-blur-sm` por `dsp-chassis rounded-lg`,
   y los fondos de canvas por `dsp-well`. Radios máximos: `rounded-lg`.
2. Quita todas las sombras de neón y los `backdrop-blur`. Los botones activos se distinguen por micro-borde `#2d3442` y fondo `#14171d`, no por color.
3. `SpectrumAnalyzer.tsx`: sustituye el icono `Sparkles` del botón "Auto-Detectar Ruido" por `Activity` o `Binary`.
4. Indicadores de estado: LED de 4px (`w-1 h-1`) verde `#10b981` / ámbar `#f59e0b`. Elimina `animate-pulse`
   o envuélvelo en `motion-safe:`.
5. Colores de señal en los canvas: Raw = ámbar `#f59e0b`, Clean = cian `#06b6d4`. Cuadrícula `rgba(255,255,255,0.06)`.
6. Números (Hz, dB, Q) siempre con `font-mono` (tabular-nums ya está en `style.css`).
7. Revisa `Navbar.tsx` y `MathLab.tsx` con los mismos criterios.

## Reglas obligatorias (no negociables)
- **No modifiques `src/dsp/*`, `scripts/`, `vercel.json` ni `package.json`.** Son lógica de audio ya validada.
- **No cambies props, handlers ni llamadas a `audioEngine`.** Solo clases CSS, marcado y estilos.
- En `FilterControls.tsx` existe un bloque de 3 botones (Filtro activo / Banda de voz / Reducción de ruido ambiente).
  Conserva `aria-pressed`, los textos y los handlers; solo restilízalos al sistema (LED + micro-borde, sin verde esmeralda de fondo).
- No agregues dependencias nuevas. Fuentes: solo las Google Fonts ya cargadas en `index.html` (Inter, JetBrains Mono).
- Accesibilidad: contraste de texto ≥ 4.5:1 sobre `#0e1015` (evita `text-neutral-600` o más oscuro para texto útil),
  foco visible en botones y sliders, y la UI debe funcionar a 375 px de ancho sin scroll horizontal.
- No introduzcas secretos, claves ni archivos `.env`.

## Cómo verificar (obligatorio antes de dar por terminado)
```
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types scripts/validate-dsp.mjs
node node_modules/vite/bin/vite.js build
```
Los tres deben terminar sin errores. Luego busca restos con:
`rg "rounded-2xl|rounded-3xl|backdrop-blur|shadow-(cyan|amber|red|rose|emerald)|Sparkles|gradient" src` → debe dar 0 resultados.

## Al terminar
Anota al final de este archivo qué componentes tocaste y qué quedó pendiente. Claude Code lo revisará en la siguiente pasada.

---
### Registro de Antigravity
(Antigravity no lo completó; la pasada 2 la aplicó Claude Code con subagentes — ver commit siguiente a 4b74d59.)

---
### Revisión de Claude Code — pasada 1 (MathLab.tsx y ReportViewer.tsx)
Bien: `Sparkles` → `Sigma`, menos espaciado, `font-mono` en etiquetas.
Corregir:
1. Siguen `rounded-xl` y `shadow-xl` en los paneles. Usa `dsp-chassis rounded-lg` (sin `shadow-xl`).
2. Usas colores hex sueltos (`bg-[#0c0e14]`, `border-[#1a1e27]`, `bg-[#090b0f]`...). Usa las clases `dsp-chassis`, `dsp-well`,
   `dsp-meter-card` de `style.css` para que haya una sola fuente de verdad.
3. `text-[10px]` y `text-[11px]` en texto útil son muy pequeños; mínimo `text-xs` (12px) para etiquetas y 14px para texto de lectura.
4. `bg-neutral-950 ... rounded-xl` en los bloques de fórmula → `dsp-well rounded-lg`.
Estado: no uses el modo "aceptar todo" a ciegas; los componentes AudioControls, SpectrumAnalyzer, ABCompare, Oscilloscope,
Spectrogram, FilterControls y Navbar siguen pendientes. Hay un commit base (`ed8b7a3`): `git diff` muestra todo lo que cambias.

---
### Revisión de Claude Code — pasada 2 (estado final reportado como terminado)
Verificado: `tsc`, `validate-dsp.mjs` y `vite build` pasan; `src/dsp`, `scripts`, `package.json`, `vercel.json` intactos;
`Sparkles` y `animate-pulse` eliminados; los 3 botones de FilterControls conservan `aria-pressed` y handlers.
NO está terminado (la búsqueda de patrones prohibidos no da 0):
1. 10 paneles siguen con `rounded-xl shadow-xl` (ABCompare:42, AudioControls:73, FilterControls:53, MathLab:230/264/407,
   Oscilloscope:137, ReportViewer:29, Spectrogram:72, SpectrumAnalyzer:228). Cambia a `dsp-chassis rounded-lg`, sin `shadow-xl`.
2. Los tokens `dsp-chassis`/`dsp-well`/`dsp-meter-card` siguen sin usarse en ningún componente (0 usos) y hay 232 colores hex
   sueltos (`bg-[#...]`, `border-[#...]`). Sustituye los repetidos (`#0c0e14`, `#1a1e27`, `#090b0f`, `#171a22`) por los tokens.
3. 51 textos con `text-[9px]/[10px]/[11px]`. Mínimo `text-xs` (12px). Valores numéricos y etiquetas importantes: `text-xs`/`text-sm`.
4. Accesibilidad: no hay ningún estilo de foco (`focus-visible:`) en botones, sliders ni pestañas. Agrega, por ejemplo,
   `focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#38bdf8]` (o una regla global en style.css).
   Revisa el contraste de `#64748b` sobre `#0c0e14` (~4:1, bajo el mínimo 4.5:1); usa `#94a3b8` para texto útil.
5. Navbar.tsx: `shadow-inner`, `shadow-sm` y `text-[10px]/[11px]`; mismas correcciones.
6. Rellena el "Registro de Antigravity" (sigue vacío) con lo que tocaste y lo que dejaste pendiente.
Cuando termines, corre la búsqueda: `grep -rnE "rounded-xl|rounded-2xl|shadow-(xl|lg|inner)|text-\[(9|10|11)px\]" src` debe dar 0.


---
### Cierre (Claude Code)
Pasada 2 aplicada en los 9 componentes + App.tsx: tokens dsp-*, sin rounded-xl/shadow/blur/gradient, texto >= 12px, grises #94a3b8, roles ARIA en pestañas, foco global en style.css. tsc, validate-dsp y build OK.
Pendiente opcional: ~134 hex sueltos restantes (colores secundarios) por unificar a tokens.
