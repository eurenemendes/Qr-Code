
import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (result: string) => void;
  isActive: boolean;
  isTorchOn: boolean;
  onTorchSupportChange: (supported: boolean) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, isActive, isTorchOn, onTorchSupportChange }) => {
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
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
    onTorchSupportChange(false);
  }, [onTorchSupportChange]);

  const startCamera = async () => {
    stopCamera();
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setIsCameraReady(true);
            
            // Verificar suporte a lanterna
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities() as any;
            if (capabilities && capabilities.torch) {
              onTorchSupportChange(true);
            }
          });
        };
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (fallbackErr) {
        setError("Câmera bloqueada ou não encontrada. Verifique as permissões de HTTPS.");
      }
    }
  };

  // Gerenciar Lanterna
  useEffect(() => {
    if (streamRef.current && isCameraReady) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities && capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: isTorchOn }]
        } as any).catch(err => console.error("Erro ao alternar lanterna:", err));
      }
    }
  }, [isTorchOn, isCameraReady]);

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
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          onScan(code.data);
          return;
        }
      }
    }
    requestRef.current = requestAnimationFrame(tick);
  }, [isActive, isCameraReady, onScan]);

  useEffect(() => {
    if (isActive) startCamera();
    else stopCamera();
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
    <div className="relative w-full max-w-md mx-auto aspect-square overflow-hidden rounded-[3rem] border-4 border-emerald-500/20 bg-slate-900 shadow-2xl">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900 z-30">
          <i className="fas fa-exclamation-triangle text-3xl text-amber-500 mb-4"></i>
          <p className="text-slate-300 text-sm mb-6">{error}</p>
          <button onClick={startCamera} className="px-6 py-2 bg-emerald-600 rounded-xl font-bold">Tentar Novamente</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
             <div className="w-64 h-64 border-2 border-emerald-500/40 rounded-[2.5rem] relative overflow-hidden">
                <div className="scan-line absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_rgba(52,211,153,0.8)]"></div>
                
                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl"></div>
                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl"></div>
                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl"></div>
                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl"></div>
             </div>
             <div className="absolute inset-0 bg-slate-950/40" style={{ maskImage: 'radial-gradient(circle 140px, transparent 100%, black 101%)', WebkitMaskImage: 'radial-gradient(circle 140px, transparent 100%, black 101%)' }}></div>
          </div>
          
          {!isCameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
              <p className="mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Iniciando Sensor</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QRScanner;
