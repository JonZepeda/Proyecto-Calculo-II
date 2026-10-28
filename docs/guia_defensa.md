# GUÍA DE DEFENSA Y PREGUNTAS CLAVE: PROYECTO DE CÁLCULO II (NIVEL EXONERACIÓN)
## Banco de Preguntas y Respuestas para la Evaluación Oral ante el Catedrático

Esta guía contiene las preguntas más rigurosas que el catedrático de Cálculo II puede formular durante la defensa, junto con las respuestas exactas respaldadas por el motor híbrido en **Python (`SymPy` + `SciPy` + `NumPy`)** y la consola en tiempo real.

---

### PREGUNTA 1: ¿Por qué este proyecto pertenece al curso de Cálculo II (Cálculo Integral) y dónde se aplican exactamente los temas del programa?
**Respuesta:**  
"El proyecto aplica de manera directa y medible **cinco bloques centrales del temario de Cálculo II**:
1. **Segundo Teorema Fundamental del Cálculo e Integrales Trigonométricas:** Calculamos analíticamente $\int_0^T f(t)\cos(2\pi\xi t)\,dt = F(T) - F(0)$ usando identidades de producto a suma para aislar cada frecuencia de la señal.
2. **Integración por Partes Cíclica ($\int u\,dv = uv - \int v\,du$):** Modelamos el decaimiento exponencial de ondas acústicas amortiguadas resolviendo simbólicamente con `SymPy` la integral $\int_0^T e^{-\alpha t}\cos(\omega t)\,dt$.
3. **Integrales Impropias de Primera Especie:** Evaluamos el límite al infinito $\lim_{T \to \infty} \int_0^T e^{-\alpha t}\cos(\omega t)\,dt = \frac{\alpha}{\alpha^2 + \omega^2}$ comprobando la convergencia en $L^2(\mathbb{R})$.
4. **Integración Numérica (Cuadratura):** Comparamos en vivo la **Suma de Riemann (Izquierda y Punto Medio)**, la **Regla del Trapecio Compuesta** (`scipy.integrate.trapezoid`, error $\mathcal{O}(1/N^2)$) y la **Regla de Simpson 1/3 Compuesta** (`scipy.integrate.simpson`, error $\mathcal{O}(1/N^4)$) contra el valor exacto analítico.
5. **Aplicaciones Físicas de la Integral Definida (Valor Medio y Energía):** Calculamos en cada ventana el Valor Eficaz por el **Teorema del Valor Medio para Integrales** $V_{\text{RMS}} = \sqrt{\frac{1}{T}\int_0^T [f(t)]^2\,dt}$ y demostramos empíricamente el **Teorema de Parseval** $\int_0^T |f(t)|^2\,dt = \int |\hat{f}(\xi)|^2\,d\xi$."

---

### PREGUNTA 2: ¿Por qué la Regla de Simpson 1/3 es mucho más precisa que las Sumas de Riemann al integrar ondas acústicas?
**Respuesta:**  
"Porque una onda sonora es una combinación suave de senoides con curvatura continua (segunda y cuarta derivada acotadas). Mientras que la Suma de Riemann por la izquierda aproxima cada subintervalo con un rectángulo plano de orden $\mathcal{O}(\Delta t) = \mathcal{O}(1/N)$ y la Regla del Trapecio usa secantes lineales con cota de error:
$$|E_T| \le \frac{(b-a)^3}{12 N^2} \max_{t \in [a,b]} |g''(t)|$$
la **Regla de Simpson 1/3** interpola cada par de subintervalos mediante un **polinomio cuadrático (parábola de segundo grado)**:
$$\int_{t_0}^{t_N} g(t)\,dt \approx \frac{\Delta t}{3}\big[g(t_0) + 4g(t_1) + 2g(t_2) + \dots + 4g(t_{N-1}) + g(t_N)\big]$$
cuya cota de error cae con la cuarta potencia del número de particiones:
$$|E_S| \le \frac{(b-a)^5}{180 N^4} \max_{t \in [a,b]} |g^{(4)}(t)|$$
En nuestra tabla comparativa del laboratorio se observa que con $N = 160$ particiones, el error relativo de Simpson 1/3 es varios órdenes de magnitud menor que el de Riemann."

---

### PREGUNTA 3: ¿Cómo se resuelve paso a paso por Integración por Partes la integral de una onda acústica amortiguada?
**Respuesta:**  
"Para la integral $I = \int e^{-\alpha t}\cos(\omega t)\,dt$, aplicamos **Integración por Partes dos veces sucesivas**:
1. En la primera aplicación tomamos $u = e^{-\alpha t} \implies du = -\alpha e^{-\alpha t}\,dt$ y $dv = \cos(\omega t)\,dt \implies v = \frac{1}{\omega}\sin(\omega t)$, obteniendo:
   $$I = \frac{e^{-\alpha t}\sin(\omega t)}{\omega} + \frac{\alpha}{\omega}\int e^{-\alpha t}\sin(\omega t)\,dt$$
2. Aplicamos partes por segunda vez a $\int e^{-\alpha t}\sin(\omega t)\,dt$ con $u = e^{-\alpha t}$ y $dv = \sin(\omega t)\,dt \implies v = -\frac{1}{\omega}\cos(\omega t)$, con lo cual reaparece la integral original $I$:
   $$I = \frac{e^{-\alpha t}\sin(\omega t)}{\omega} - \frac{\alpha}{\omega^2}e^{-\alpha t}\cos(\omega t) - \frac{\alpha^2}{\omega^2}I$$
3. Agrupando $I \left(1 + \frac{\alpha^2}{\omega^2}\right)$ en el miembro izquierdo y despejando algebraicamente obtenemos la antiderivada exacta que también verifica nuestro motor `SymPy`:
   $$F(t) = \frac{e^{-\alpha t}\big(\omega\sin(\omega t) - \alpha\cos(\omega t)\big)}{\alpha^2 + \omega^2} + C$$"

---

### PREGUNTA 4: ¿Por qué la integral 'anula' o ignora las frecuencias que no están en la señal? (Propiedad de Ortogonalidad)
**Respuesta:**  
"Se debe a la **ortogonalidad de las funciones trigonométricas** bajo el producto interno integral en $L^2$. Al multiplicar $\sin(\omega_0 t)\cos(\omega t)$ con $\omega \neq \omega_0$, la identidad de producto a suma transforma el integrando en $\frac{1}{2}[\sin((\omega_0-\omega)t) + \sin((\omega_0+\omega)t)]$. Al integrar sobre el intervalo $[0, T]$, los lóbulos de área positiva (verdes en la gráfica) y los lóbulos de área negativa (rojos) tienen igual magnitud y signos opuestos, cancelándose mutuamente. Solo cuando sintonizamos $\omega = \omega_0$ el integrando permanece en fase y acumula un área neta distinta de cero."

---

### PREGUNTA 5: ¿Cómo se aplica el Teorema del Valor Medio para Integrales para medir el voltaje eficaz ($V_{\text{RMS}}$) y la energía eliminada?
**Respuesta:**  
"Si intentáramos calcular el valor promedio simple de una onda acústica alterna $\frac{1}{T}\int_0^T f(t)\,dt$, obtendríamos casi cero porque la onda oscila simétricamente entre valores positivos y negativos. Por ello aplicamos el **Teorema del Valor Medio para Integrales** sobre la potencia instantánea cuadrática $[f(t)]^2 \ge 0$:
$$V_{\text{RMS}} = \sqrt{\frac{1}{T}\int_0^T [f(t)]^2\,dt}$$
En nuestro panel de comparación A/B integramos en vivo mediante la Regla de Simpson 1/3 tanto el canal contaminado como el canal limpio, demostrando cuantitativamente cuántos Joules de energía parásita fueron removidos y comprobando que coincide al $99.9\%$ con la integral en el dominio de la frecuencia según el **Teorema de Parseval**."

---

### DEMOSTRACIÓN EN VIVO RECOMENDADA (PASO A PASO ANTE EL JURADO):
1. **Impacto Auditivo en Vivo (Consola DSP):** Activar **"Hum 60Hz"** o hablar por el **Micrófono** activando el **"+ Hum 60Hz (Red)"** en el Inyector de Interferencia en Vivo. Alternar entre **CANAL A (CRUDO)** y **CANAL B (DSP ON)** para escuchar cómo desaparece el zumbido de inmediato y señalar los medidores de $V_{\text{RMS}}$ y Parseval.
2. **Utilidad Práctica Real:** Hacer clic en **"Exportar WAV Limpio"** para descargar al instante el archivo `.wav` restaurado con `scipy.signal.iirnotch` / PCM 16-bit.
3. **Captura de Audio Real hacia el Laboratorio Matemático:** Ir a la pestaña **"Fundamento Matemático"**, presionar **"Capturar Canal A (Vivo)"** y mover el slider de particiones $N$ y de frecuencia $\xi$.
4. **Comparativa de Cuadratura y `SymPy`:** Señalar la **Tabla Comparativa (Riemann vs. Trapecio vs. Simpson 1/3)** mostrando cómo Simpson 1/3 reduce drásticamente el error frente al valor analítico $F(T)-F(0)$, y mostrar las 3 pestañas de resolución simbólica paso a paso (Trigonométrica, Integración por Partes Cíclica e Integral Impropia) junto con el cuaderno `python_engine/demostracion_calculo_ii.ipynb`.
