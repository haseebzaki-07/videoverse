"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface VideoPreviewModalProps {
  videoUrl: string;
  onClose: () => void;
}

export default function VideoPreviewModal({
  videoUrl,
  onClose,
}: VideoPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && e.target === modalRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-4xl w-full bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/80 hover:text-white z-10 bg-black/20 p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:bg-black/40"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Your Edited Video
          </h2>

          <div className="relative aspect-[9/16] max-h-[70vh] bg-black/40 rounded-lg overflow-hidden ring-1 ring-white/10">
            <video
              src={videoUrl}
              controls
              className="absolute inset-0 w-full h-full object-contain"
              autoPlay
            />
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Press ESC or click outside to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
