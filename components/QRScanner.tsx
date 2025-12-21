
import React, { useRef, useEffect, useState, useCallback } from 'react';
// @ts-ignore
import jsQR from 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm';
import { ScanResult } from '../types';

interface QRScannerProps {
  onScan: (result: string) => void;
  isActive: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraReady(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isActive]);

  const tick = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && isActive) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas) {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code) {
            onScan(code.data);
            // Vibrar levemente para feedback tátil se suportado
            if (navigator.vibrate) navigator.vibrate(100);
          }
        }
      }
    }
    if (isActive) {
      requestAnimationFrame(tick);
    }
  }, [isActive, onScan]);

  useEffect(() => {
    if (isCameraReady && isActive) {
      requestAnimationFrame(tick);
    }
  }, [isCameraReady, isActive, tick]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square overflow-hidden rounded-2xl border-4 border-emerald-500/30 bg-black shadow-2xl">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-800">
          <i className="fas fa-exclamation-triangle text-4xl text-amber-500 mb-4"></i>
          <p className="text-slate-300 font-medium">{error}</p>
          <button 
            onClick={startCamera}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Overlay do Scanner */}
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
             <div className="relative w-full h-full border-2 border-emerald-500/50 rounded-sm">
                <div className="scan-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
                
                {/* Cantos Estilizados */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500"></div>
             </div>
          </div>
          
          {!isCameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QRScanner;
