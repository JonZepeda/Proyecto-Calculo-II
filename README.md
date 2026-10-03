# Proyecto de Cálculo II: Transformada de Fourier & Cancelación Quirúrgica de Ruido (DSP)

> **Aplicación de la Integral Continua en la Recuperación de Señales de Voz en Tiempo Real**  
> *Asignatura*: Cálculo II (Cálculo Integral)  
> *Área*: Ingeniería de Sistemas / Software / Telecomunicaciones  

---

## 🌟 Resumen del Proyecto

Este proyecto aborda y resuelve el problema de la **"ceguera en el dominio del tiempo"** en señales acústicas. Cuando una señal de voz se mezcla con un ruido estacionario continuo (hum de 60 Hz o silbidos agudos de turbinas), resulta imposible separar el ruido del mensaje útil observando únicamente la forma de onda continua $f(t)$.

Utilizando la **Transformada de Fourier**, modelada como una integral impropia en el plano complejo:
$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(t) e^{-i 2\pi \xi t} \, dt = \int_{-\infty}^{\infty} f(t) \cos(2\pi \xi t) \, dt - i \int_{-\infty}^{\infty} f(t) \sin(2\pi \xi t) \, dt$$

La señal se proyecta sobre una base ortogonal de funciones armónicas, convirtiendo la convolución en el tiempo en un producto algebraico simple en frecuencia. El sistema aísla la interferencia con un filtro de muesca (*Notch Filter*) y reconstruye la señal limpia con más de **-34 dB de atenuación** y **> 98% de reducción de potencia del ruido**, preservando la inteligibilidad de la voz.

---

## 🚀 Inicio Rápido (Local)

### Requisitos Previos
- Node.js 18+ instalado.

### Instalación y Ejecución
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo local
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador (Google Chrome o Edge recomendados).

### Compilación para Producción (Vercel / GitHub Pages)
```bash
npm run build
```
La carpeta generada `dist/` está lista para subirse con 1 clic a **Vercel**, **Netlify** o **GitHub Pages**.

---

## 📐 Estructura de la Aplicación

1. **🎛️ Laboratorio DSP en Tiempo Real**:
   - **Osciloscopio**: Doble traza continua $f(t)$ a 60 FPS (Señal Original vs. Señal Filtrada).
   - **Analizador Espectral**: Gráfica $|\hat{f}(\xi)|$ de 20 Hz a 20 kHz con cursor interactivo para mover la frecuencia de muesca directamente en el gráfico.
   - **Espectrograma en Cascada (Waterfall)**: Mapa de calor en 2D (Tiempo vs. Frecuencia vs. Energía) donde se observa la línea de ruido desaparecer al activar el filtro.
   - **Conmutador Táctil A / B**: Alternancia instantánea con latencia cero entre el audio original con ruido y el audio limpio.
   - **Detección Automática de Ruido**: Algoritmo que escanea el espectro y sintoniza el filtro automáticamente sobre el pico armónico parásito.

2. **📐 Fundamentación Matemática (Cálculo II)**:
   - Demostración visual de cómo las **Sumas de Riemann** aproximan la integral continua de Fourier.
   - Gráfica interactiva de área positiva/negativa bajo la curva de $f(t)\cdot\cos(\omega t)$ demostrando empíricamente la **propiedad de ortogonalidad**.
   - Explicación formal del Teorema de Convolución y el Teorema de Parseval.

3. **📑 Documentación Académica Integrada**:
   - `docs/informe_calculo_ii.md`: Informe formal universitario completo con introducción, marco teórico, metodología, resultados experimentales y bibliografía.
   - `docs/guia_defensa.md`: Banco de preguntas y respuestas clave para la evaluación oral con el catedrático.

---

## 📂 Estructura del Repositorio

```
├── docs/
│   ├── informe_calculo_ii.md       # Informe completo para entrega
│   └── guia_defensa.md             # Respuestas a preguntas de examen oral
├── src/
│   ├── components/
│   │   ├── Navbar.tsx              # Encabezado, selector de vistas y volumen
│   │   ├── AudioControls.tsx       # Presets (Hum 60Hz, 2.5kHz), mic y carga de archivos
│   │   ├── Oscilloscope.tsx        # Canvas 60 FPS del dominio del tiempo f(t)
│   │   ├── SpectrumAnalyzer.tsx    # Canvas 60 FPS del espectro |f̂(ξ)|
│   │   ├── Spectrogram.tsx         # Espectrograma en cascada 2D
│   │   ├── FilterControls.tsx      # Controles de f₀, factor Q y tipo de filtro
│   │   ├── ABCompare.tsx           # Botón táctil A/B y métricas de atenuación
│   │   ├── MathLab.tsx             # Laboratorio interactivo de Sumas de Riemann
│   │   └── ReportViewer.tsx        # Lector del informe con exportación a PDF
│   ├── dsp/
│   │   ├── audioEngine.ts          # Pipeline Web Audio API y ruteo A/B
│   │   ├── riemannFourier.ts       # Cálculo numérico explícito de la integral
│   │   └── types.ts                # Tipos e interfaces de TypeScript
│   ├── App.tsx                     # Componente principal
│   ├── main.tsx                    # Punto de entrada
│   └── style.css                   # Tailwind CSS v4 y tema All-Black
├── index.html                      # Documento raíz con KaTeX y tipografía JetBrains Mono
├── package.json
└── vite.config.ts
```

---

## 📄 Licencia y Créditos
Desarrollado para el curso de **Cálculo II (Cálculo Integral)**. Uso libre académico y demostrativo.
