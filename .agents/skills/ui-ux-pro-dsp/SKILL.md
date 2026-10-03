---
name: ui-ux-pro-dsp
description: Sistema de diseño y directrices de UI/UX de alta fidelidad para software de procesamiento de señales (DSP), herramientas de cálculo y estaciones de audio profesional. Elimina la estética genérica de IA (gradientes púrpura/cian aleatorios, bordes de neón difusos, esquinas excesivamente redondeadas) y aplica principios de hardware táctil, ergonomía de consola de estudio y estética All-Black stealth de alto rendimiento.
---

# UI/UX Pro DSP & Hardware Workstation Design System

## 1. Filosofía de Diseño: "Hardware de Laboratorio de Precisión"
En lugar de lucir como una aplicación web convencional o una plantilla de IA, la interfaz debe sentirse como un rack de hardware de audio de grado profesional (inspirado en *Teenage Engineering, FabFilter Pro-Q, Ableton Live 12, SSL y Dieter Rams*).

### Principios Clave:
1. **Consola Modular por Racks**: Cada sección funcional (Fuente de Audio, Osciloscopio, Analizador de Espectro, Filtro Notch, Comparador A/B) actúa como un módulo de rack independiente con bisel de micro-borde (1px) y acabado mate oscuro.
2. **Ergonomía Stealth & All-Black**:
   - Fondo de escena: `#08090b` (negro profundo puro).
   - Chasis de módulos: `#0f1115` con bordes `#1a1d24` y sutil línea de luz superior `#252932` (1px).
   - Superficie de controles: `#14171d` con contraste táctil.
3. **Cero Luces Neón / Cero AI Slop**:
   - Prohibidas las sombras de resplandor `shadow-cyan-500/30` o `shadow-amber-500/20`.
   - Indicadores de estado mediante **micro-LEDs** de 3px a 4px (verde fósforo `#10b981` o ámbar técnico `#f59e0b`).
4. **Tipografía Técnica & Calibrada**:
   - `JetBrains Mono` con `font-variant-numeric: tabular-nums` para frecuencias (Hz), factores Q, atenuación (dB) y fórmulas matemáticas.
   - Textos de navegación y etiquetas con peso balanceado, tracking ligeramente abierto en etiquetas pequeñas (`tracking-wider text-[11px] uppercase`).
   - Cero iconos irrelevantes (no usar chispas `Sparkles`; usar iconos de hardware e instrumentación matemática como `Sliders`, `Activity`, `Binary`, `Disc`, `Volume2`).

## 2. Paleta Cromática Funcional

| Elemento | Color Hex | Propósito |
|---|---|---|
| **Chassis Background** | `#08090b` | Base principal (All-Black profundo) |
| **Module Rack** | `#0e1015` | Contenedores de instrumentos |
| **Module Inner Wells** | `#060709` | Fondos de los lienzos canvas (alta legibilidad) |
| **Bordes & Racks** | `#1b1f27` | Separadores de precisión de 1px |
| **Borde Activo / Focus** | `#2d3442` | Estado seleccionado sin saturar |
| **Señal de Entrada (Raw)** | `#f59e0b` (Ámbar) | Trazas de audio original / espectro con ruido |
| **Señal Filtrada (Clean)** | `#06b6d4` (Cian quirúrgico) | Traza limpia post-filtro / curva de muesca |
| **LED Activo (Clean)** | `#10b981` (Verde fósforo) | Indicador discreto de bypass / bypass desactivado |
| **LED Alerta / Ruido** | `#ef4444` (Rojo técnico) | Sobrecarga o detección de pico armónico |

## 3. Comportamiento de Controles
- **Knobs y Faders**: Carriles de deslizamiento oscuros con contraste nítido y marcas de graduación.
- **Botón A/B**: Interruptor de palanca/conmutador físico con feedback táctil y visual claro de qué canal está activo (Original vs. Filtrado), mostrando métricas en tiempo real en dB.
- **Gráficos Canvas a 60 FPS**: Rejilla de dB y frecuencias graduadas con líneas vectoriales de 1px con opacidad del 5% al 10%, sin emborronar las trazas.
