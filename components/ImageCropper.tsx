
import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 10, y: 10, width: 80, height: 80 }); // Porcentagens
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0 });

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY, cropX: crop.x, cropY: crop.y });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = ((clientX - dragStart.x) / containerRef.current.offsetWidth) * 100;
    const dy = ((clientY - dragStart.y) / containerRef.current.offsetHeight) * 100;

    setCrop(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100 - prev.width, dragStart.cropX + dx)),
      y: Math.max(0, Math.min(100 - prev.height, dragStart.cropY + dy))
    }));
  };

  const handleEnd = () => setIsDragging(false);

  const performCrop = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const realX = (crop.x / 100) * img.width;
      const realY = (crop.y / 100) * img.height;
      const realW = (crop.width / 100) * img.width;
      const realH = (crop.height / 100) * img.height;

      canvas.width = realW;
      canvas.height = realH;
      ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);
      onConfirm(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-300">
      <div className="p-6 flex justify-between items-center border-b border-slate-800">
        <button onClick={onCancel} className="text-slate-400 font-bold">Cancelar</button>
        <h3 className="text-white font-black uppercase tracking-widest text-sm">Ajustar Recorte</h3>
        <button onClick={performCrop} className="text-emerald-500 font-black">Pronto</button>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-4 touch-none"
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="relative inline-block max-w-full max-h-full">
          <img src={imageSrc} className="max-w-full max-h-[70vh] pointer-events-none select-none" alt="Para recortar" />
          
          {/* Overlay Escuro */}
          <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{
            clipPath: `polygon(
              0% 0%, 0% 100%, 
              ${crop.x}% 100%, ${crop.x}% ${crop.y}%, 
              ${crop.x + crop.width}% ${crop.y}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, 
              ${crop.x}% ${crop.y + crop.height}%, ${crop.x}% 100%, 
              100% 100%, 100% 0%
            )`
          }}></div>

          {/* Área de Seleção */}
          <div 
            onMouseDown={handleStart}
            onTouchStart={handleStart}
            className="absolute border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-move"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`
            }}
          >
            {/* Cantos Visuais */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white"></div>
            
            {/* Grid Interno */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
              <div className="border border-white/30"></div><div className="border border-white/30"></div><div className="border border-white/30"></div>
              <div className="border border-white/30"></div><div className="border border-white/30"></div><div className="border border-white/30"></div>
              <div className="border border-white/30"></div><div className="border border-white/30"></div><div className="border border-white/30"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 text-center bg-slate-900/50">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-4">Arraste para centralizar o QR Code</p>
        <div className="flex justify-center gap-4">
            <button onClick={() => setCrop(prev => ({...prev, width: Math.max(20, prev.width - 10), height: Math.max(20, prev.height - 10)}))} className="w-12 h-12 rounded-full bg-slate-800 text-white"><i className="fas fa-minus"></i></button>
            <button onClick={() => setCrop(prev => ({...prev, width: Math.min(90, prev.width + 10), height: Math.min(90, prev.height + 10)}))} className="w-12 h-12 rounded-full bg-slate-800 text-white"><i className="fas fa-plus"></i></button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
