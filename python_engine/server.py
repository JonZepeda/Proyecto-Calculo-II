"""
Servidor API Científico (FastAPI) para el Proyecto de Cálculo II
================================================================
Expone endpoints REST consumidos en tiempo real por la interfaz React/TypeScript:
- GET  /api/health       -> Estado del motor Python y versiones de SymPy/SciPy/NumPy
- POST /api/symbolic     -> Resolución simbólica exacta con SymPy (antiderivadas LaTeX, TFC, Impropias)
- POST /api/quadrature   -> Comparativa numérica Riemann vs. Trapecio vs. Simpson 1/3 (SciPy)
- POST /api/parseval     -> Integrales de Energía Acústica, Valor Eficaz RMS y Teorema de Parseval
- GET  /api/export-wav   -> Descarga de archivo .wav procesado con scipy.signal.iirnotch + filtfilt
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import numpy as np
from pydantic import BaseModel, Field
import scipy
import sympy as sp

from calculus_engine import (
    compare_quadrature_methods,
    process_audio_and_verify_parseval,
    solve_symbolic_calculus,
    synthesize_and_clean_wav_bytes,
)

app = FastAPI(
    title="Motor Matemático Cálculo II — Fourier & DSP",
    description="Backend científico en Python (SymPy + SciPy + NumPy) para Integración Simbólica, Cuadratura Numérica y Filtrado Espectral.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SymbolicRequest(BaseModel):
    probe_freq: float = Field(default=60.0, ge=1.0, le=20000.0)
    noise_freq: float = Field(default=60.0, ge=1.0, le=20000.0)
    window_duration: float = Field(default=0.04, ge=0.005, le=1.0)
    damping_alpha: float = Field(default=35.0, ge=0.5, le=500.0)


class QuadratureRequest(BaseModel):
    probe_freq: float = Field(default=60.0, ge=1.0, le=20000.0)
    noise_freq: float = Field(default=60.0, ge=1.0, le=20000.0)
    window_duration: float = Field(default=0.04, ge=0.005, le=1.0)
    partitions_n: int = Field(default=200, ge=10, le=2000)
    custom_samples: Optional[List[float]] = None
    sample_rate: float = Field(default=44100.0, ge=8000.0, le=96000.0)


class ParsevalRequest(BaseModel):
    samples: List[float]
    sample_rate: int = Field(default=44100, ge=8000, le=96000)
    notch_freq: float = Field(default=60.0, ge=20.0, le=20000.0)
    q_factor: float = Field(default=12.0, ge=0.5, le=50.0)


@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "engine": "Python Scientific Engine (SymPy + SciPy + NumPy)",
        "versions": {
            "sympy": sp.__version__,
            "scipy": scipy.__version__,
            "numpy": np.__version__,
        },
    }


@app.post("/api/symbolic")
def api_symbolic(req: SymbolicRequest):
    return solve_symbolic_calculus(
        probe_freq=req.probe_freq,
        noise_freq=req.noise_freq,
        window_duration=req.window_duration,
        damping_alpha=req.damping_alpha,
    )


@app.post("/api/quadrature")
def api_quadrature(req: QuadratureRequest):
    return compare_quadrature_methods(
        probe_freq=req.probe_freq,
        noise_freq=req.noise_freq,
        window_duration=req.window_duration,
        partitions_n=req.partitions_n,
        custom_samples=req.custom_samples,
        sample_rate=req.sample_rate,
    )


@app.post("/api/parseval")
def api_parseval(req: ParsevalRequest):
    return process_audio_and_verify_parseval(
        samples=req.samples,
        sample_rate=req.sample_rate,
        notch_freq=req.notch_freq,
        q_factor=req.q_factor,
    )


@app.get("/api/export-wav")
def api_export_wav(
    preset: str = Query(default="hum60"),
    duration_s: float = Query(default=4.0, ge=1.0, le=15.0),
    notch_freq: float = Query(default=60.0, ge=20.0, le=20000.0),
    q_factor: float = Query(default=12.0, ge=1.0, le=50.0),
    mode: str = Query(default="clean"),
):
    wav_bytes = synthesize_and_clean_wav_bytes(
        preset=preset,
        duration_s=duration_s,
        notch_freq=notch_freq,
        q_factor=q_factor,
        mode=mode,
    )
    filename = f"scipy_{preset}_{mode}_{int(notch_freq)}Hz.wav"
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
