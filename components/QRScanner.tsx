
import React, { useRef, useEffect, useState, useCallback } from 'react';
// @ts-ignore
import jsQR from 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm';

interface QRScannerProps {
  onScan: (result: string) => void;
  isActive: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const startCamera = async () => {
    stopCamera();
    setError(null);

    const attemptStream = async (constraints: MediaStreamConstraints) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true'); // Essencial para iOS
          await videoRef.current.play();
          setIsCameraReady(true);
          return true;
        }
      } catch (e) {
        return false;
      }
      return false;
    };

    // Tentativa 1: Câmera traseira (Ideal para QR Codes)
    let success = await attemptStream({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    // Tentativa 2: Fallback para qualquer câmera disponível (Desktop ou Frontal)
    if (!success) {
      success = await attemptStream({ video: true });
    }

    if (!success) {
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  };

  const tick = useCallback(() => {
    if (!isActive || !isCameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // jsQR é a biblioteca que faz a mágica acontecer
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth', // Melhora muito a leitura em fundos escuros
        });

        if (code && code.data && code.data.trim() !== "") {
          onScan(code.data);
          return; // Para o loop pois o App exibirá o modal de resultado
        }
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  }, [isActive, isCameraReady, onScan]);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isActive]);

  useEffect(() => {
    if (isCameraReady && isActive) {
      requestRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraReady, isActive, tick]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square overflow-hidden rounded-[2.5rem] border-4 border-emerald-500/20 bg-slate-950 shadow-2xl">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900 z-20">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-camera-slash text-2xl text-red-500"></i>
          </div>
          <p className="text-slate-300 font-medium mb-6 text-sm leading-relaxed">{error}</p>
          <button 
            onClick={startCamera}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all active:scale-95"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover grayscale-[0.2] contrast-[1.2]"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Overlay Visual */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <div className="w-64 h-64 border-2 border-emerald-500/30 rounded-3xl relative">
                {/* Linha de Scan com brilho */}
                <div className="scan-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_rgba(52,211,153,0.6)] z-10"></div>
                
                {/* Cantos reforçados */}
                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl shadow-[-5px_-5px_15px_rgba(16,185,129,0.2)]"></div>
                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl shadow-[5px_-5px_15px_rgba(16,185,129,0.2)]"></div>
                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl shadow-[-5px_5px_15px_rgba(16,185,129,0.2)]"></div>
                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl shadow-[5px_5px_15px_rgba(16,185,129,0.2)]"></div>
                
                {/* Indicadores de foco centrais */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-emerald-500/20 rounded-full animate-ping"></div>
             </div>

             {/* Máscara de vinheta ao redor do scanner */}
             <div className="absolute inset-0 bg-slate-950/60" style={{ maskImage: 'radial-gradient(circle 140px, transparent 100%, black 101%)', WebkitMaskImage: 'radial-gradient(circle 140px, transparent 100%, black 101%)' }}></div>
          </div>
          
          {!isCameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-camera text-xl text-emerald-500/40"></i>
                </div>
              </div>
              <p className="mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] animate-pulse">Calibrando Sensor</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QRScanner;
