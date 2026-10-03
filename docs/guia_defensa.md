# GUÍA DE DEFENSA Y PREGUNTAS CLAVE: PROYECTO DE CÁLCULO II
## Banco de Preguntas y Respuestas para la Evaluación Oral

Esta guía contiene las preguntas más probables que el catedrático o los evaluadores de Cálculo II formularán durante la defensa del proyecto, junto con las respuestas matemáticas y conceptuales exactas que debes dar.

---

### PREGUNTA 1: ¿Por qué este proyecto pertenece al curso de Cálculo Integral y no a una clase de Programación o Física?
**Respuesta:**  
"Porque el corazón del proyecto no es el código, sino la **resolución de una integral impropia en el dominio complejo**: la Transformada de Fourier:
$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(t) e^{-i 2\pi \xi t} \, dt$$
El código del navegador es únicamente el medio de cálculo que aproxima numéricamente esta integral mediante **Sumas de Riemann**. Sin el concepto de área acumulada bajo la curva, la descomposición de la señal sería imposible. Demostramos cómo el cálculo de una integral definida cuantifica la energía de cada frecuencia dentro de una función continua."

---

### PREGUNTA 2: ¿Qué papel juega la Identidad de Euler y las funciones trigonométricas en la integral de Fourier?
**Respuesta:**  
"La Identidad de Euler $e^{-i\theta} = \cos\theta - i\sin\theta$ nos permite desglosar la integral de Fourier en dos integrales continuas reales:
$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(t) \cos(2\pi \xi t) \, dt - i \int_{-\infty}^{\infty} f(t) \sin(2\pi \xi t) \, dt$$
- La primera integral calcula la correlación o proyección con la función par (coseno), que representa la parte real o componente en fase.
- La segunda integral calcula la proyección con la función impar (seno), que representa la componente en cuadratura o desfase de $90^\circ$.
El módulo del número complejo resultante $\sqrt{R^2 + I^2}$ nos da la amplitud exacta (magnitud del espectro) de esa frecuencia en la señal."

---

### PREGUNTA 3: ¿Por qué la integral 'anula' o ignora las frecuencias que no están en la señal? (Ortogonalidad)
**Respuesta:**  
"Se debe a la propiedad de **ortogonalidad de las funciones sinusoidales** en el espacio de Hilbert $L^2$. Cuando multiplicamos dos funciones de frecuencias distintas, por ejemplo $\cos(\omega_1 t) \cos(\omega_2 t)$ con $\omega_1 \neq \omega_2$, y las integramos a lo largo de un periodo suficiente, las áreas positivas y negativas se compensan de forma simétrica:
$$\int_{-T}^{T} \cos(\omega_1 t) \cos(\omega_2 t) \, dt = 0 \quad (\text{para } \omega_1 \neq \omega_2)$$
El área neta bajo la curva es estrictamente cero. En cambio, si $\omega_1 = \omega_2$, la función se convierte en $\cos^2(\omega t) \ge 0$, cuya integral es estrictamente positiva. Por lo tanto, la integral actúa como un resonador sintonizado que da valor cero salvo cuando sintoniza con una frecuencia presente en la señal."

---

### PREGUNTA 4: ¿Qué es una Suma de Riemann y cómo conecta la integral continua con el código de la computadora?
**Respuesta:**  
"La definición formal de la integral de Riemann es el límite de una partición cuando la norma de la partición tiende a cero:
$$\int_a^b g(t) \, dt = \lim_{N \to \infty} \sum_{n=0}^{N-1} g(t_n) \Delta t$$
En una computadora, el audio se muestrea digitalmente a intervalos discretos $\Delta t = \frac{1}{44100}\text{ segundos}$. La Transformada Discreta de Fourier (DFT) es exactamente una Suma de Riemann finita de la integral continua de Fourier donde cada muestra $x_n = f(n \Delta t)$ es la altura del rectángulo y $\Delta t$ es la base. El algoritmo FFT de Cooley-Tukey es una optimización algebraica para calcular estas sumas de Riemann en tiempo $\mathcal{O}(N \log N)$."

---

### PREGUNTA 5: ¿Por qué es válido filtrar mediante una multiplicación en frecuencia en lugar de una integral en el tiempo? (Teorema de Convolución)
**Respuesta:**  
"En el dominio del tiempo, aplicar un filtro es resolver la **Integral de Convolución**:
$$y(t) = (f * h)(t) = \int_{-\infty}^{\infty} f(\tau) h(t - \tau) \, d\tau$$
El **Teorema de Convolución** demuestra mediante integración doble y el Teorema de Fubini que la Transformada de Fourier de una convolución es igual al producto de las transformadas individuales:
$$\mathcal{F}\{f * h\} = \hat{f}(\xi) \cdot \hat{h}(\xi)$$
Por tanto, en lugar de calcular una costosa integral de convolución en cada instante temporal, simplemente calculamos la integral de Fourier $\hat{f}(\xi)$, multiplicamos algebraicamente por el perfil del filtro $H(\xi)$ y aplicamos la integral inversa de Fourier $\mathcal{F}^{-1}$."

---

### PREGUNTA 6: ¿Cómo garantiza el Teorema de Parseval que no destruimos la voz al aplicar el filtro de muesca?
**Respuesta:**  
"El Teorema de Parseval (o Identidad de Plancherel) establece la conservación de la energía integral:
$$\int_{-\infty}^{\infty} |f(t)|^2 \, dt = \int_{-\infty}^{\infty} |\hat{f}(\xi)|^2 \, d\xi$$
Esto demuestra que la energía se distribuye linealmente a través de las frecuencias. Como el ruido es una interferencia concentrada en una banda estrecha (ej. 60 Hz o 2500 Hz), al aplicar un filtro Notch con un factor de calidad alto ($Q \ge 10$), solo anulamos la energía en un intervalo $\Delta \xi$ diminuto. El resto de la integral $\int |\hat{s}(\xi)|^2 d\xi$ que contiene los formantes vocales humanos ($300\text{ Hz} - 3400\text{ Hz}$) permanece intacto, preservando la inteligibilidad."

---

### DEMOSTRACIÓN EN VIVO RECOMENDADA (PASO A PASO):
1. Abrir la aplicación y seleccionar el preset **"Voz + Zumbido Eléctrico (60 Hz)"**.
2. Mostrar el **Osciloscopio**: señalar cómo en el tiempo la onda se ve deformada y no se puede distinguir qué es voz y qué es zumbido.
3. Mostrar el **Analizador Espectral**: señalar la aguja vertical prominente a 60 Hz.
4. Mostrar el **Espectrograma en Cascada**: señalar la línea horizontal continua y brillante a 60 Hz.
5. Activar el **Filtro Notch a 60 Hz** y presionar **"Alternar A/B"** para que el catedrático escuche la diferencia inmediata (de ruido molesto a voz limpia).
6. Abrir la pestaña **"Laboratorio Matemático / Sumas de Riemann"** para mostrar la gráfica de $f(t) \cdot \cos(\omega t)$ con el área bajo la curva coloreada (verde positiva, roja negativa) y demostrar empíricamente cómo al integrar en 60 Hz el área neta es grande y en 300 Hz es prácticamente cero.
