'use client';

import { useState, useRef, useEffect } from 'react';

interface LogoEditorProps {
  imageFile: File;
  onSave: (croppedImage: string) => void;
  onCancel: () => void;
}

export default function LogoEditor({ imageFile, onSave, onCancel }: LogoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [shape, setShape] = useState<'square' | 'circle'>('square');
  const [canvasSize] = useState(400); // Fixed canvas size

  // Load image
  useEffect(() => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      setImage(img);
      // Center the image initially
      const canvas = canvasRef.current;
      if (canvas) {
        setPosition({
          x: (canvasSize - img.width) / 2,
          y: (canvasSize - img.height) / 2
        });
      }
    };

    reader.readAsDataURL(imageFile);
  }, [imageFile, canvasSize]);

  // Draw canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Save context state
    ctx.save();

    // Create clipping path based on shape
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(0, 0, canvasSize, canvasSize);
    }
    ctx.clip();

    // Draw image with zoom and position
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    ctx.drawImage(
      image,
      position.x,
      position.y,
      scaledWidth,
      scaledHeight
    );

    // Restore context
    ctx.restore();

    // Draw border
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 1, 0, Math.PI * 2);
    } else {
      ctx.rect(1, 1, canvasSize - 2, canvasSize - 2);
    }
    ctx.stroke();

  }, [image, zoom, position, shape, canvasSize]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;

    const croppedImage = canvasRef.current.toDataURL('image/png');
    onSave(croppedImage);
  };

  const handleZoomChange = (newZoom: number) => {
    if (!image) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate the center of the canvas
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // Calculate the current center of the image
    const currentImageCenterX = position.x + (image.width * zoom) / 2;
    const currentImageCenterY = position.y + (image.height * zoom) / 2;

    // Calculate offset from canvas center
    const offsetX = currentImageCenterX - centerX;
    const offsetY = currentImageCenterY - centerY;

    // Calculate new position to maintain the same center
    const newPosition = {
      x: centerX - (image.width * newZoom) / 2 + offsetX * (newZoom / zoom),
      y: centerY - (image.height * newZoom) / 2 + offsetY * (newZoom / zoom)
    };

    setZoom(newZoom);
    setPosition(newPosition);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
      <div className="bg-[#2B3544] rounded-lg p-6 w-full max-w-2xl border border-gray-600">
        <h3 className="text-white text-xl font-bold mb-6 text-center">تعديل شعار الشركة</h3>

        <div className="space-y-6">
          {/* Canvas */}
          <div className="flex justify-center">
            <div className="relative inline-block">
              {/* Checkerboard background for transparency preview */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #9CA3AF 25%, transparent 25%),
                    linear-gradient(-45deg, #9CA3AF 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #9CA3AF 75%),
                    linear-gradient(-45deg, transparent 75%, #9CA3AF 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: '#E5E7EB'
                }}
              />
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative border-2 border-gray-600 rounded-lg cursor-move"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Shape Selection */}
            <div>
              <label className="block text-white text-sm font-medium mb-3">شكل الشعار</label>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShape('square')}
                  className={`px-6 py-3 rounded-lg border-2 transition-all ${
                    shape === 'square'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border-2 border-current rounded"></div>
                    <span className="text-sm font-medium">مربع</span>
                  </div>
                </button>

                <button
                  onClick={() => setShape('circle')}
                  className={`px-6 py-3 rounded-lg border-2 transition-all ${
                    shape === 'circle'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border-2 border-current rounded-full"></div>
                    <span className="text-sm font-medium">دائري</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Zoom Slider */}
            <div>
              <label className="block text-white text-sm font-medium mb-3">
                التكبير: {Math.round(zoom * 100)}%
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleZoomChange(Math.max(0.1, zoom - 0.01))}
                  className="px-3 py-2 bg-[#374151] hover:bg-gray-600 rounded text-white font-bold text-lg"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <button
                  onClick={() => handleZoomChange(Math.min(3, zoom + 0.01))}
                  className="px-3 py-2 bg-[#374151] hover:bg-gray-600 rounded text-white font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-[#374151] rounded-lg p-4 border border-gray-600">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-blue-300 text-sm font-medium mb-1">كيفية الاستخدام:</p>
                  <ul className="text-gray-300 text-xs space-y-1">
                    <li>• استخدم الفأرة لسحب الصورة وتحريكها</li>
                    <li>• استخدم شريط التكبير لضبط حجم الصورة</li>
                    <li>• اختر الشكل المناسب (مربع أو دائري)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-600">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              حفظ الشعار
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
