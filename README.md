# Proyecto de Cálculo II: Transformada de Fourier & Cancelación Quirúrgica de Ruido (DSP)

> **Aplicación de la Integral Continua en la Recuperación de Señales de Voz en Tiempo Real**  
> *Asignatura*: Cálculo II (Cálculo Integral)  
> *Área*: Ingeniería de Sistemas / Software / Telecomunicaciones  

---

## 🌟 Resumen del Proyecto

Este proyecto aborda y resuelve el problema de la **"ceguera en el dominio del tiempo"** en señales acústicas. Cuando una señal de voz se mezcla con un ruido estacionario continuo (hum de 60 Hz o silbidos agudos de turbinas), resulta imposible separar el ruido del mensaje útil observando únicamente la forma de onda continua $f(t)$.

Utilizando la **Transformada de Fourier**, modelada como una integral impropia en el plano complejo:
$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(t) e^{-i 2\pi \xi t} \, dt = \int_{-\infty}^{\infty} f(t) \cos(2\pi \xi t) \, dt - i \int_{-\infty}^{\infty} f(t) \sin(2\pi \xi t) \, dt$$

La señal se proyecta sobre una base ortogonal de funciones armónicas, convirtiendo la convolución en el tiempo en un producto algebraico simple en frecuencia. El sistema aísla la interferencia con un filtro de muesca (*Notch Filter*), un filtro de banda de voz y una resta espectral para el ruido de fondo.

**Resultados medidos** (`npm run test:dsp`, voz sintética): con ruido rosa mejora de 5 a 6 dB la relación señal/ruido y la voz casi no se afecta (−0,2 a −1,7 dB). El filtro es adaptativo (Wiener sobre la STFT con estimación continua del ruido): además quita tonos fijos, como un silbido de 2,5 kHz, con unos +10 dB de mejora. No sigue ruido que cambia de banda más rápido que ~1,5 s ni tonos que barren frecuencias, y un tono de 50/60 Hz se atiende mejor con el filtro de muesca. Una vocal con altura exactamente constante durante más de ~1 s se confunde con un tono. Con un tono puro de 60 Hz el filtro de muesca atenúa mucho más, pero esa cifra es de un caso ideal y no de ruido ambiente real. **No se ha probado con grabaciones reales de micrófono**, y un filtro fijo no separa la voz de ruido que ocupa las mismas frecuencias (otra voz, música).

---

## 🚀 Inicio Rápido (Local)

### Requisitos Previos
- **Node.js 20.19 o superior** (o 22.12+). Vite 8 no funciona con Node 18. Comprueba con `node --version`.
- Python 3.10+ solo si quieres el motor opcional (ver más abajo).

### Instalación y Ejecución
```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/JonZepeda/Proyecto-Calculo-II.git
cd Proyecto-Calculo-II
npm install

# 2. Iniciar servidor de desarrollo local
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador (Google Chrome o Edge recomendados). El micrófono solo funciona en `localhost` o con HTTPS.

Con esto basta para el Laboratorio DSP y Fundamento Matemático: todo se calcula en el navegador.

### Comandos útiles
```bash
npm run test:dsp   # prueba de regresión del filtro y de la integración numérica
npm run build      # compila para producción en dist/ (Vercel, Netlify, GitHub Pages)
```

### Motor Python (opcional)
Añade la exportación de WAV con SciPy y la verificación simbólica con SymPy. Sin él, la app usa el cálculo del navegador y funciona igual.
```bash
python -m venv python_engine/.venv
# Windows:    python_engine\.venv\Scripts\activate
# Mac/Linux:  source python_engine/.venv/bin/activate
pip install -r requirements.txt
python python_engine/server.py     # escucha en http://127.0.0.1:8000
```
Déjalo corriendo en una segunda terminal junto a `npm run dev`; Vite redirige `/api` a ese puerto. El notebook `python_engine/demostracion_calculo_ii.ipynb` repite las demostraciones con SymPy.

> Al publicar en Vercel solo se despliega la parte estática: el motor Python no se incluye y la app cae sola al cálculo del navegador.

---

## 📐 Estructura de la Aplicación

1. **🎛️ Laboratorio DSP en Tiempo Real**:
   - **Osciloscopio**: Doble traza continua $f(t)$ a 60 FPS (Señal Original vs. Señal Filtrada).
   - **Analizador Espectral**: Gráfica $|\hat{f}(\xi)|$ de 20 Hz a 20 kHz con cursor interactivo para mover la frecuencia de muesca directamente en el gráfico.
   - **Espectrograma en Cascada (Waterfall)**: Mapa de calor en 2D (Tiempo vs. Frecuencia vs. Energía) donde se observa la línea de ruido desaparecer al activar el filtro.
   - **Conmutador A / B**: Alterna entre el audio original con ruido y el audio filtrado (con una transición corta de unos 20 ms).
   - **Detección Automática de Ruido**: Algoritmo que escanea el espectro y sintoniza el filtro automáticamente sobre el pico armónico parásito.

2. **📐 Fundamento Matemático (Cálculo II)**:
   - Una idea central: la integral multiplica la señal por una onda de prueba y suma el resultado; es grande si la frecuencia está en la señal y casi cero si no.
   - Gráficas interactivas del producto $f(t)\cdot\cos(\omega t)$ y del área acumulada, con el cálculo por **Riemann, trapecio y Simpson** frente al valor exacto.
   - Demostración paso a paso (plegada): producto a suma, integración por partes e integral impropia.

3. **📑 Documentación Académica** (archivos en `docs/`, no se muestran dentro de la app):
   - `docs/informe_calculo_ii.md`: informe con introducción, marco teórico, metodología y bibliografía. **Las cifras de atenuación del informe son de un caso ideal y aún no están actualizadas con las mediciones de arriba.**
   - `docs/guia_defensa.md`: banco de preguntas y respuestas para la evaluación oral.

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
│   │   ├── ABCompare.tsx           # Conmutador A/B y métricas medidas
│   │   └── MathLab.tsx             # Laboratorio interactivo de Riemann/trapecio/Simpson
│   ├── dsp/
│   │   ├── audioEngine.ts          # Pipeline Web Audio API y ruteo A/B
│   │   ├── riemannFourier.ts       # Cálculo numérico explícito de la integral
│   │   └── types.ts                # Tipos e interfaces de TypeScript
│   ├── App.tsx                     # Componente principal
│   ├── main.tsx                    # Punto de entrada
│   └── style.css                   # Tailwind CSS v4 y tema All-Black
├── python_engine/                  # Motor opcional (FastAPI + SymPy/SciPy) y notebook
├── scripts/validate-dsp.mjs        # Prueba de regresión (npm run test:dsp)
├── requirements.txt                # Dependencias del motor Python
├── index.html                      # Documento raíz con KaTeX y tipografía JetBrains Mono
├── package.json
└── vite.config.ts
```

---

## 📄 Licencia y Créditos
Desarrollado para el curso de **Cálculo II (Cálculo Integral)**. Uso libre académico y demostrativo.
