---
name: frontend-design
description: Guía de diseño visual distintivo y profesional para interfaces frontend. Evita la estética genérica de IA (gradientes neón, tarjetas con redondeos excesivos, efectos de resplandor arbitrarios, iconos cliché como chispas/sparkles) e impone decisiones intencionales de tipografía, paleta, densidad y jerarquía visual adaptadas al dominio técnico del producto.
license: MIT
---

# Frontend Design & Anti-AI Slop Guidelines

Esta skill orienta el diseño hacia interfaces de calidad de producción y nivel de autor, eliminando los patrones predecibles generados por IA.

## 1. Principio Fundamental: Anclar el Diseño en el Dominio Real
- Un software de **Procesamiento Digital de Señales (DSP) y Laboratorio de Cálculo** no debe lucir como una landing page de marketing de Web3 ni como una plantilla genérica SaaS.
- Debe adoptar la estética y ergonomía de **instrumentación de laboratorio y hardware de audio profesional** (referencias: *Teenage Engineering, FabFilter Pro-Q, Ableton Live, iZotope RX, Linear stealth, Braun/Dieter Rams*).

## 2. Erradicar los Vicios de Diseño de IA ("AI Clichés to Avoid")
- ❌ **Prohibido el uso de resplandores o sombras de neón** (`shadow-cyan-500/25`, `shadow-amber-500/20`, etc.). La instrumentación real es mate, técnica y sobria.
- ❌ **Prohibido el uso de iconos cliché**: No usar `Sparkles` para ciencia o matemáticas; usar simbología técnica real (`Binary`, `Variable`, `FunctionSquare`, `Compass`, `Sigma`).
- ❌ **Evitar esquinas hiper-redondeadas** (`rounded-2xl`, `rounded-3xl`) en paneles de control técnicos; preferir radios sobrios y compactos (`rounded-md`, `rounded-lg`).
- ❌ **Evitar tarjetas flotantes con backdrop-blur suave** que diluyen la estructura. El software técnico utiliza divisiones de panel claras, biseles sutiles de 1px, y contraste funcional entre capas.
- ❌ **Eliminar degradados de color chillones**: Cero botones de gradiente púrpura/cian o logos multicolor. Si hay color de acento, debe ser funcional (un LED de estado, una banda de frecuencia de filtro, un clip de audio).

## 3. Sistema Visual All-Black & Stealth Engineering
- **Superficies**: Negro obsidiana profundo (`#08090b`), negro carbón para racks/módulos (`#0e1014`), paneles secundarios (`#14171d`).
- **Líneas y Micro-bordes**: Bordes nítidos de 1px con opacidades sutiles (`#1e222a` a `#262b36`). Sin marcos flotantes desmesurados.
- **Tipografía**:
  - Números, métricas, valores en Hertz/dB y fórmulas: siempre monoespaciados (`JetBrains Mono`, `font-mono`, `tabular-nums`).
  - Textos descriptivos: Sans-serif neutral y legible (`Inter`), con pesos calibrados (medium 500, regular 400).
- **Acentos Funcionales**:
  - Luces de estado discretas tipo LED de 2px a 4px (verde fósforo o ámbar técnico para indicar bypass/filtro activo).
  - Escala de decibelios y rejilla de espectro con líneas milimétricas tenues (`rgba(255,255,255,0.06)`).

## 4. Densidad de Información y Tactilidad
- Maximizar la superficie útil: Los osciloscopios y analizadores de espectro son los protagonistas visuales; los controles deben estar agrupados lógicamente como una consola modular de audio.
- Controles táctiles compactos: Botones con estados activos definidos por relieve o micro-borde, no por explosión de color neón.
