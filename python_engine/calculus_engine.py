"""
Motor Matemático y de Procesamiento Digital de Señales (DSP) para Cálculo II
============================================================================
Implementa en Python puro (SymPy + SciPy + NumPy):
1. Resolución Simbólica Exacta (SymPy):
   - Antiderivadas F(t) de la integral de Fourier ∫ f(t)cos(2πξt) dt y ∫ f(t)sin(2πξt) dt
   - Evaluación analítica exacta mediante el Segundo Teorema Fundamental del Cálculo: F(T) - F(0)
   - Integración por Partes Cíclica: ∫ e^(-αt) cos(ωt) dt
   - Integrales Impropias de Primera Especie: ∫_0^∞ e^(-αt) cos(ωt) dt = lim_{T->∞} [F(T) - F(0)]
2. Cuadratura Numérica de Cálculo II (SciPy & NumPy):
   - Suma de Riemann (Izquierda, Derecha y Punto Medio)
   - Regla del Trapecio Compuesta (scipy.integrate.trapezoid)
   - Regla de Simpson 1/3 Compuesta (scipy.integrate.simpson)
   - Cuadratura Adaptativa de Gauss-Kronrod (scipy.integrate.quad)
   - Análisis de convergencia y cotas de error O(1/N), O(1/N²), O(1/N⁴)
3. Aplicaciones Físicas de la Integral Definida (Audio Real):
   - Energía Acústica Temporal E_t = ∫_0^T [f(t)]² dt (vía Simpson 1/3)
   - Valor Eficaz (RMS) por el Teorema del Valor Medio para Integrales: V_rms = sqrt((1/T) ∫_0^T [f(t)]² dt)
   - Demostración Empírica del Teorema de Parseval: ∫_0^T |f(t)|² dt == ∫ |f̂(ξ)|² dξ
   - Filtrado Quirúrgico en SciPy (scipy.signal.iirnotch + filtfilt de fase cero)
"""

from __future__ import annotations

import io
import math
import wave
from typing import Any, Dict, List, Optional

import numpy as np
from scipy import integrate, signal
import sympy as sp


# ============================================================================
# 1. MOTOR DE CÁLCULO SIMBÓLICO (SymPy)
# ============================================================================

def solve_symbolic_calculus(
    probe_freq: float = 60.0,
    noise_freq: float = 60.0,
    window_duration: float = 0.04,
    damping_alpha: float = 35.0,
) -> Dict[str, Any]:
    """
    Ejecuta SymPy en tiempo real para obtener antiderivadas simbólicas exactas,
    evaluaciones en límites de integración [0, T] y límites al infinito (T -> oo).
    """
    t = sp.Symbol("t", real=True, positive=True)
    T_sym = sp.Symbol("T", real=True, positive=True)
    alpha_sym = sp.Symbol("alpha", real=True, positive=True)
    omega_sym = sp.Symbol("omega", real=True, positive=True)
    omega_0_sym = sp.Symbol("omega_0", real=True, positive=True)

    # 1.1 Integral Trigonométrica de Ortogonalidad:
    # Demostración sobre la componente de interferencia η(t) = A * sin(2π f0 t)
    # multiplicada por el núcleo de Fourier cos(2π ξ t)
    f0_val = float(noise_freq)
    xi_val = float(probe_freq)
    T_val = float(window_duration)

    # Expresión simbólica general con parámetros simbólicos para mostrar la antiderivada limpia
    trig_integrand_sym = sp.sin(omega_0_sym * t) * sp.cos(omega_sym * t)
    trig_expanded_sym = sp.trigsimp(sp.expand_trig(trig_integrand_sym))
    # Identidad de producto a suma: 1/2 * [sin((ω0 - ω)t) + sin((ω0 + ω)t)]
    prod_to_sum_sym = sp.Rational(1, 2) * (
        sp.sin((omega_0_sym - omega_sym) * t) + sp.sin((omega_0_sym + omega_sym) * t)
    )

    # Evaluación exacta sobre la señal compuesta f(t) = voz + ruido
    # f(t) = 0.35 sin(2π·140 t) + 0.25 sin(2π·700 t) + 0.20 sin(2π·1260 t) + 0.50 sin(2π·f0 t)
    components = [
        (0.35, 140.0),
        (0.25, 700.0),
        (0.20, 1260.0),
        (0.50, f0_val),
    ]

    exact_cos_integral = 0.0
    exact_sin_integral = 0.0
    for amp, freq_c in components:
        w_c = 2.0 * math.pi * freq_c
        w_p = 2.0 * math.pi * xi_val

        # Integral exacta de A * sin(w_c t) * cos(w_p t) en [0, T]
        if abs(w_c - w_p) < 1e-9:
            # Caso resonancia ω_c == ω_p: ∫_0^T sin(wt)cos(wt)dt = [sin²(wt)/(2w)]_0^T
            term_cos = amp * (math.sin(w_c * T_val) ** 2) / (2.0 * w_c)
            # Integral en cuadratura ∫_0^T sin²(wt)dt = T/2 - sin(2wT)/(4w)
            term_sin = amp * (0.5 * T_val - math.sin(2.0 * w_c * T_val) / (4.0 * w_c))
        else:
            diff_w = w_c - w_p
            sum_w = w_c + w_p
            term_cos = 0.5 * amp * (
                (1.0 - math.cos(diff_w * T_val)) / diff_w
                + (1.0 - math.cos(sum_w * T_val)) / sum_w
            )
            term_sin = 0.5 * amp * (
                math.sin(diff_w * T_val) / diff_w
                - math.sin(sum_w * T_val) / sum_w
            )

        exact_cos_integral += term_cos
        exact_sin_integral += term_sin

    exact_magnitude = math.sqrt(exact_cos_integral ** 2 + exact_sin_integral ** 2)

    # 1.2 Integración por Partes Cíclica con SymPy:
    # ∫ e^(-α t) cos(ω t) dt
    damped_integrand = sp.exp(-alpha_sym * t) * sp.cos(omega_sym * t)
    damped_antideriv = sp.simplify(sp.integrate(damped_integrand, t))
    damped_definite_sym = sp.simplify(sp.integrate(damped_integrand, (t, 0, T_sym)))

    # 1.3 Integral Impropia de Tipo I con SymPy (Límite T -> ∞):
    improper_sym = sp.simplify(sp.integrate(damped_integrand, (t, 0, sp.oo)))

    # Evaluación numérica de la integral amortiguada e impropia para los parámetros actuales
    w_num = 2.0 * math.pi * xi_val
    a_num = float(damping_alpha)
    denom = a_num ** 2 + w_num ** 2
    damped_F_T = (
        math.exp(-a_num * T_val)
        * (w_num * math.sin(w_num * T_val) - a_num * math.cos(w_num * T_val))
        / denom
    )
    damped_F_0 = -a_num / denom
    damped_definite_val = damped_F_T - damped_F_0
    improper_limit_val = a_num / denom

    # 1.4 Valor Eficaz (RMS) y Energía Exacta en el Tiempo sobre [0, T]
    # Para f(t) = Σ A_i sin(w_i t), integramos f(t)² con cuadratura de alta precisión SciPy
    def f_analytic(t_num: float) -> float:
        return (
            0.35 * math.sin(2.0 * math.pi * 140.0 * t_num)
            + 0.25 * math.sin(2.0 * math.pi * 700.0 * t_num)
            + 0.20 * math.sin(2.0 * math.pi * 1260.0 * t_num)
            + 0.50 * math.sin(2.0 * math.pi * f0_val * t_num)
        )

    exact_energy_total, _ = integrate.quad(lambda tau: f_analytic(tau) ** 2, 0.0, T_val, limit=200)
    exact_rms_total = math.sqrt(exact_energy_total / T_val)

    return {
        "engine": "Python SymPy + SciPy",
        "sympy_version": sp.__version__,
        "probe_freq": xi_val,
        "noise_freq": f0_val,
        "window_duration": T_val,
        "damping_alpha": a_num,
        "exact_fourier": {
            "real_cos": exact_cos_integral,
            "imag_sin": -exact_sin_integral,
            "magnitude": exact_magnitude,
            "energy_total": exact_energy_total,
            "rms_total": exact_rms_total,
        },
        "symbolic_latex": {
            "trig_integrand": sp.latex(trig_integrand_sym),
            "prod_to_sum": sp.latex(prod_to_sum_sym),
            "damped_integrand": sp.latex(damped_integrand),
            "damped_antiderivative": sp.latex(damped_antideriv),
            "damped_definite": sp.latex(damped_definite_sym),
            "improper_result": sp.latex(improper_sym),
        },
        "damped_evaluation": {
            "F_T": damped_F_T,
            "F_0": damped_F_0,
            "definite_0_to_T": damped_definite_val,
            "improper_0_to_inf": improper_limit_val,
            "convergence_ratio_pct": (damped_definite_val / improper_limit_val * 100.0)
            if abs(improper_limit_val) > 1e-15
            else 100.0,
        },
    }


# ============================================================================
# 2. COMPARADOR DE MÉTODOS DE INTEGRACIÓN NUMÉRICA (Riemann vs Trapecio vs Simpson 1/3)
# ============================================================================

def compare_quadrature_methods(
    probe_freq: float = 60.0,
    noise_freq: float = 60.0,
    window_duration: float = 0.04,
    partitions_n: int = 200,
    custom_samples: Optional[List[float]] = None,
    sample_rate: float = 44100.0,
) -> Dict[str, Any]:
    """
    Compara formalmente los métodos de integración numérica del programa de Cálculo II:
    1. Suma de Riemann por la Izquierda
    2. Suma de Riemann por Punto Medio
    3. Regla del Trapecio Compuesta (scipy.integrate.trapezoid)
    4. Regla de Simpson 1/3 Compuesta (scipy.integrate.simpson)
    5. Cuadratura Adaptativa Gauss-Kronrod (scipy.integrate.quad) / Valor Analítico Exacto
    """
    # Asegurar que N sea par para Simpson 1/3 y esté en rango [10, 2000]
    N = max(10, min(2000, int(partitions_n)))
    if N % 2 != 0:
        N += 1

    xi = float(probe_freq)
    f0 = float(noise_freq)
    omega = 2.0 * math.pi * xi

    if custom_samples and len(custom_samples) >= 16:
        # Señal real capturada desde el micrófono o archivo en el navegador
        arr = np.asarray(custom_samples, dtype=np.float64)
        T = (len(arr) - 1) / float(sample_rate)
        t_orig = np.linspace(0.0, T, len(arr))
        t_grid = np.linspace(0.0, T, N + 1)
        f_grid = np.interp(t_grid, t_orig, arr)
        t_mid = 0.5 * (t_grid[:-1] + t_grid[1:])
        f_mid = np.interp(t_mid, t_orig, arr)
        dt = T / N

        g_cos = f_grid * np.cos(omega * t_grid)
        g_sin = f_grid * np.sin(omega * t_grid)
        g_cos_mid = f_mid * np.cos(omega * t_mid)
        g_sin_mid = f_mid * np.sin(omega * t_mid)

        # Referencia de máxima resolución sobre todos los samples originales con Simpson
        dt_fine = 1.0 / float(sample_rate)
        exact_cos = float(integrate.simpson(arr * np.cos(omega * t_orig), dx=dt_fine))
        exact_sin = float(integrate.simpson(arr * np.sin(omega * t_orig), dx=dt_fine))
        exact_mag = math.hypot(exact_cos, exact_sin)
        is_live_signal = True
    else:
        # Señal analítica continua f(t) evaluable en cualquier punto real t
        T = float(window_duration)
        dt = T / N
        t_grid = np.linspace(0.0, T, N + 1)
        t_mid = 0.5 * (t_grid[:-1] + t_grid[1:])

        def eval_signal(t_vec: np.ndarray) -> np.ndarray:
            return (
                0.35 * np.sin(2.0 * np.pi * 140.0 * t_vec)
                + 0.25 * np.sin(2.0 * np.pi * 700.0 * t_vec)
                + 0.20 * np.sin(2.0 * np.pi * 1260.0 * t_vec)
                + 0.50 * np.sin(2.0 * np.pi * f0 * t_vec)
            )

        f_grid = eval_signal(t_grid)
        f_mid = eval_signal(t_mid)

        g_cos = f_grid * np.cos(omega * t_grid)
        g_sin = f_grid * np.sin(omega * t_grid)
        g_cos_mid = f_mid * np.cos(omega * t_mid)
        g_sin_mid = f_mid * np.sin(omega * t_mid)

        # Integral exacta usando el Segundo Teorema Fundamental del Cálculo / scipy.integrate.quad
        sym_res = solve_symbolic_calculus(xi, f0, T)
        exact_cos = float(sym_res["exact_fourier"]["real_cos"])
        exact_sin = float(-sym_res["exact_fourier"]["imag_sin"])
        exact_mag = float(sym_res["exact_fourier"]["magnitude"])
        is_live_signal = False

    # 1. Suma de Riemann Izquierda: Σ_{n=0}^{N-1} g(t_n) Δt
    riemann_left_cos = float(np.sum(g_cos[:-1]) * dt)
    riemann_left_sin = float(np.sum(g_sin[:-1]) * dt)
    riemann_left_mag = math.hypot(riemann_left_cos, riemann_left_sin)

    # 2. Suma de Riemann Punto Medio: Σ_{n=0}^{N-1} g((t_n + t_{n+1})/2) Δt
    riemann_mid_cos = float(np.sum(g_cos_mid) * dt)
    riemann_mid_sin = float(np.sum(g_sin_mid) * dt)
    riemann_mid_mag = math.hypot(riemann_mid_cos, riemann_mid_sin)

    # 3. Regla del Trapecio Compuesta (SciPy): (Δt/2)[g(t_0) + 2Σg(t_n) + g(t_N)]
    trapz_cos = float(integrate.trapezoid(g_cos, dx=dt))
    trapz_sin = float(integrate.trapezoid(g_sin, dx=dt))
    trapz_mag = math.hypot(trapz_cos, trapz_sin)

    # 4. Regla de Simpson 1/3 Compuesta (SciPy): (Δt/3)[g(t_0) + 4Σ_{impar} g(t_n) + 2Σ_{par} g(t_n) + g(t_N)]
    simpson_cos = float(integrate.simpson(g_cos, dx=dt))
    simpson_sin = float(integrate.simpson(g_sin, dx=dt))
    simpson_mag = math.hypot(simpson_cos, simpson_sin)

    def calc_err(approx_c: float, approx_s: float) -> Dict[str, float]:
        abs_err = math.hypot(approx_c - exact_cos, approx_s - exact_sin)
        rel_err = (abs_err / exact_mag * 100.0) if exact_mag > 1e-9 else 0.0
        return {
            "abs_error": abs_err,
            "rel_error_pct": rel_err,
        }

    # Curva de convergencia para distintos valores de N (demostración de orden de convergencia)
    n_candidates = [16, 32, 64, 128, 256, 512, 1024]
    convergence_curve = []
    if not is_live_signal:
        for n_test in n_candidates:
            dt_t = T / n_test
            tg = np.linspace(0.0, T, n_test + 1)
            fg = (
                0.35 * np.sin(2.0 * np.pi * 140.0 * tg)
                + 0.25 * np.sin(2.0 * np.pi * 700.0 * tg)
                + 0.20 * np.sin(2.0 * np.pi * 1260.0 * tg)
                + 0.50 * np.sin(2.0 * np.pi * f0 * tg)
            )
            gc = fg * np.cos(omega * tg)
            gs = fg * np.sin(omega * tg)

            r_c = float(np.sum(gc[:-1]) * dt_t)
            r_s = float(np.sum(gs[:-1]) * dt_t)
            t_c = float(integrate.trapezoid(gc, dx=dt_t))
            t_s = float(integrate.trapezoid(gs, dx=dt_t))
            s_c = float(integrate.simpson(gc, dx=dt_t))
            s_s = float(integrate.simpson(gs, dx=dt_t))

            convergence_curve.append({
                "N": n_test,
                "riemann_err": math.hypot(r_c - exact_cos, r_s - exact_sin),
                "trapezoid_err": math.hypot(t_c - exact_cos, t_s - exact_sin),
                "simpson_err": math.hypot(s_c - exact_cos, s_s - exact_sin),
            })

    return {
        "engine": "Python SciPy + NumPy",
        "is_live_signal": is_live_signal,
        "N": N,
        "dt": dt,
        "window_duration": T,
        "probe_freq": xi,
        "exact": {
            "real_cos": exact_cos,
            "imag_sin": -exact_sin,
            "magnitude": exact_mag,
        },
        "methods": {
            "riemann_left": {
                "name": "Suma de Riemann (Izquierda)",
                "order": "O(Δt) = O(1/N)",
                "real_cos": riemann_left_cos,
                "imag_sin": -riemann_left_sin,
                "magnitude": riemann_left_mag,
                **calc_err(riemann_left_cos, riemann_left_sin),
            },
            "riemann_midpoint": {
                "name": "Suma de Riemann (Punto Medio)",
                "order": "O(Δt²) = O(1/N²)",
                "real_cos": riemann_mid_cos,
                "imag_sin": -riemann_mid_sin,
                "magnitude": riemann_mid_mag,
                **calc_err(riemann_mid_cos, riemann_mid_sin),
            },
            "trapezoid": {
                "name": "Regla del Trapecio (scipy.integrate.trapezoid)",
                "order": "O(Δt²) = O(1/N²)",
                "real_cos": trapz_cos,
                "imag_sin": -trapz_sin,
                "magnitude": trapz_mag,
                **calc_err(trapz_cos, trapz_sin),
            },
            "simpson": {
                "name": "Regla de Simpson 1/3 (scipy.integrate.simpson)",
                "order": "O(Δt⁴) = O(1/N⁴)",
                "real_cos": simpson_cos,
                "imag_sin": -simpson_sin,
                "magnitude": simpson_mag,
                **calc_err(simpson_cos, simpson_sin),
            },
        },
        "convergence_curve": convergence_curve,
    }


# ============================================================================
# 3. PROCESAMIENTO DE AUDIO REAL Y VERIFICACIÓN DE PARSEVAL EN PYTHON (SciPy)
# ============================================================================

def process_audio_and_verify_parseval(
    samples: List[float],
    sample_rate: int = 44100,
    notch_freq: float = 60.0,
    q_factor: float = 12.0,
) -> Dict[str, Any]:
    """
    Filtra una señal de audio en Python con scipy.signal.iirnotch (incluyendo armónicos
    si es hum de red <= 100 Hz) y calcula mediante integración numérica de Simpson:
    - Energía en el dominio del tiempo: E_t = ∫_0^T |f(t)|² dt
    - Energía en el dominio de la frecuencia: E_ξ = ∫_{-∞}^{∞} |f̂(ξ)|² dξ
    - Valor Eficaz (RMS) por el Teorema del Valor Medio para Integrales
    """
    x = np.asarray(samples, dtype=np.float64)
    if len(x) < 32:
        raise ValueError("Se requieren al menos 32 muestras para integrar la señal.")

    fs = float(sample_rate)
    dt = 1.0 / fs
    N = len(x)
    T = (N - 1) * dt

    # Aplicar filtro Notch en SciPy
    y = x.copy()
    f0 = max(20.0, min(fs / 2.0 - 50.0, float(notch_freq)))
    Q = max(1.0, min(50.0, float(q_factor)))

    b, a = signal.iirnotch(f0, Q, fs)
    y = signal.lfilter(b, a, y)

    # Si es zumbido eléctrico (<= 100 Hz), filtrar 2º y 3er armónico
    if f0 <= 100.0:
        for mult in (2, 3):
            fh = f0 * mult
            if fh < fs / 2.0 - 50.0:
                bh, ah = signal.iirnotch(fh, Q, fs)
                y = signal.lfilter(bh, ah, y)

    # 1. Integrales definidas de Energía en el Tiempo (Regla de Simpson 1/3)
    energy_time_raw = float(integrate.simpson(x ** 2, dx=dt))
    energy_time_clean = float(integrate.simpson(y ** 2, dx=dt))
    energy_removed = max(0.0, energy_time_raw - energy_time_clean)

    # 2. Valor Eficaz (RMS) por el Teorema del Valor Medio para Integrales:
    # V_rms = sqrt( (1/T) ∫_0^T [f(t)]² dt )
    rms_raw = math.sqrt(energy_time_raw / T) if T > 0 else 0.0
    rms_clean = math.sqrt(energy_time_clean / T) if T > 0 else 0.0

    # 3. Verificación Empírica del Teorema de Parseval:
    # f̂(ξ_k) ≈ Δt · FFT(x)[k]  =>  Δξ = fs / N = 1 / (N Δt)
    # ∫ |f̂(ξ)|² dξ ≈ Σ |X[k] · Δt|² · Δξ = (Δt / N) Σ |X[k]|²
    X_fft = np.fft.fft(x) * dt
    Y_fft = np.fft.fft(y) * dt
    d_xi = fs / N
    energy_freq_raw = float(np.sum(np.abs(X_fft) ** 2) * d_xi)
    energy_freq_clean = float(np.sum(np.abs(Y_fft) ** 2) * d_xi)

    parseval_discrepancy_pct = (
        abs(energy_time_raw - energy_freq_raw) / energy_time_raw * 100.0
        if energy_time_raw > 1e-12
        else 0.0
    )

    return {
        "sample_rate": sample_rate,
        "samples_count": N,
        "duration_s": T,
        "time_domain_integrals": {
            "energy_raw_joules": energy_time_raw,
            "energy_clean_joules": energy_time_clean,
            "energy_removed_joules": energy_removed,
            "energy_reduction_pct": (energy_removed / energy_time_raw * 100.0)
            if energy_time_raw > 1e-12
            else 0.0,
            "rms_raw": rms_raw,
            "rms_clean": rms_clean,
        },
        "frequency_domain_integrals": {
            "energy_raw_parseval": energy_freq_raw,
            "energy_clean_parseval": energy_freq_clean,
            "parseval_match_error_pct": parseval_discrepancy_pct,
        },
    }


def synthesize_and_clean_wav_bytes(
    preset: str = "hum60",
    duration_s: float = 4.0,
    sample_rate: int = 44100,
    notch_freq: float = 60.0,
    q_factor: float = 12.0,
    mode: str = "clean",
) -> bytes:
    """
    Genera o procesa un archivo WAV (16-bit PCM) usando NumPy + SciPy
    para demostrar la restauración quirúrgica real desde Python.
    """
    N = int(duration_s * sample_rate)
    t = np.arange(N, dtype=np.float64) / float(sample_rate)

    # Voz sintética con formantes modulados por vibrato natural de sílabas
    vibrato = 3.5 * np.sin(2.0 * np.pi * 4.5 * t)
    f0_voice = 140.0
    voice = (
        0.35 * np.sin(2.0 * np.pi * (f0_voice * 1 + vibrato) * t)
        + 0.28 * np.sin(2.0 * np.pi * (f0_voice * 2 + vibrato) * t)
        + 0.22 * np.sin(2.0 * np.pi * (f0_voice * 3 + vibrato) * t)
        + 0.30 * np.sin(2.0 * np.pi * (f0_voice * 5 + vibrato) * t)
        + 0.25 * np.sin(2.0 * np.pi * (f0_voice * 9 + vibrato) * t)
    ) * 0.35

    if preset == "whistle2500":
        noise = 0.45 * np.sin(2.0 * np.pi * 2500.0 * t)
    elif preset == "test1000":
        noise = 0.45 * np.sin(2.0 * np.pi * 1000.0 * t)
    else:
        # Hum eléctrico de 60 Hz + armónicos 120 Hz y 180 Hz
        noise = (
            0.50 * np.sin(2.0 * np.pi * 60.0 * t)
            + 0.22 * np.sin(2.0 * np.pi * 120.0 * t)
            + 0.14 * np.sin(2.0 * np.pi * 180.0 * t)
        )

    raw_signal = voice + noise

    if mode == "raw":
        out = raw_signal
    else:
        out = raw_signal.copy()
        f_target = max(20.0, min(sample_rate / 2.0 - 50.0, float(notch_freq)))
        b, a = signal.iirnotch(f_target, q_factor, sample_rate)
        out = signal.filtfilt(b, a, out)
        if f_target <= 100.0:
            for mult in (2, 3):
                bh, ah = signal.iirnotch(f_target * mult, q_factor, sample_rate)
                out = signal.filtfilt(bh, ah, out)

    # Normalizar a 16-bit PCM sin clipping
    peak = float(np.max(np.abs(out)))
    if peak > 0.98:
        out = out * (0.95 / peak)
    pcm16 = np.clip(out * 32767.0, -32768, 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()
