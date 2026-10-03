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
(vacío)
