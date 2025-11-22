'use client';

import { useEffect, useRef, useState } from 'react';

interface MagnifyingGlassProps {
  imageSrc: string;
  imageRef: React.RefObject<HTMLImageElement>;
  zoomFactor?: number; // How much to zoom (2 = 2x, 3 = 3x, etc.)
  lensWidth?: number; // Width of the magnifying glass lens in pixels
  lensHeight?: number; // Height of the magnifying glass lens in pixels
  enabled: boolean;
}

export default function MagnifyingGlass({
  imageSrc,
  imageRef,
  zoomFactor = 2.5,
  lensWidth = 250,
  lensHeight = 150,
  enabled,
}: MagnifyingGlassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Load the image for the canvas
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = 'anonymous';
    imageElementRef.current = img;
  }, [imageSrc]);

  useEffect(() => {
    if (!enabled || !imageRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const img = imageRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if mouse is over the image
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        setPosition({ x: e.clientX, y: e.clientY });
        setIsVisible(true);
        drawMagnifier(x, y, rect);
      } else {
        setIsVisible(false);
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const drawMagnifier = (mouseX: number, mouseY: number, imgRect: DOMRect) => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      const sourceImg = imageElementRef.current;

      if (!canvas || !img || !sourceImg || !sourceImg.complete) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, lensWidth, lensHeight);

      // Calculate the position on the natural (full-size) image
      const scaleX = sourceImg.naturalWidth / imgRect.width;
      const scaleY = sourceImg.naturalHeight / imgRect.height;

      const sourceX = mouseX * scaleX;
      const sourceY = mouseY * scaleY;

      // Calculate the size of the source area to capture
      const sourceWidth = lensWidth / zoomFactor;
      const sourceHeight = lensHeight / zoomFactor;

      // Ensure we don't go out of bounds
      const sx = Math.max(0, Math.min(sourceX - sourceWidth / 2, sourceImg.naturalWidth - sourceWidth));
      const sy = Math.max(0, Math.min(sourceY - sourceHeight / 2, sourceImg.naturalHeight - sourceHeight));

      // Draw the magnified portion
      try {
        ctx.drawImage(
          sourceImg,
          sx,
          sy,
          sourceWidth,
          sourceHeight,
          0,
          0,
          lensWidth,
          lensHeight
        );
      } catch (error) {
        // Image might not be loaded yet
        console.debug('Image not ready for magnification');
      }
    };

    const img = imageRef.current;
    img.addEventListener('mousemove', handleMouseMove);
    img.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      img.removeEventListener('mousemove', handleMouseMove);
      img.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled, imageRef, zoomFactor, lensWidth, lensHeight]);

  if (!enabled || !isVisible) return null;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: position.x + 20,
        top: position.y + 20,
        width: lensWidth,
        height: lensHeight,
      }}
    >
      <div
        className="rounded-lg border-2 border-zinc-500 shadow-xl bg-white overflow-hidden"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(113, 113, 122, 0.3)) drop-shadow(0 10px 30px rgba(0, 0, 0, 0.2))',
          boxShadow: '0 0 0 1px rgba(113, 113, 122, 0.2), 0 0 20px rgba(113, 113, 122, 0.15)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={lensWidth}
          height={lensHeight}
          className="block"
        />
      </div>
      {/* Zoom level indicator */}
      <div
        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-900 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap shadow-md"
      >
        {zoomFactor}x zoom
      </div>
    </div>
  );
}
