import { useState, useRef, useEffect } from "react";
import ffmpeg from "@ffmpeg/ffmpeg"; // Ensure this is installed

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  timestamp: number;
  duration: number;
}

interface VisualEffect {
  id: string;
  type: "fade" | "blur" | "brightness";
  intensity: number;
  timestamp: number;
  duration: number;
}

export default function VideoEditor() {
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [visualEffects, setVisualEffects] = useState<VisualEffect[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const videoUrl = "/output/final_video.mp4"; // Path to your video file

  useEffect(() => {
    const interval = setInterval(() => {
      updatePreview();
    }, 1000 / 30); // Update at 30 FPS
    return () => clearInterval(interval);
  }, [currentTime, textOverlays, visualEffects]);

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: generateUniqueId(),
      text: "New Text",
      x: 50,
      y: 50,
      fontSize: 24,
      color: "#ffffff",
      timestamp: currentTime,
      duration: 3,
    };
    setTextOverlays([...textOverlays, newOverlay]);
  };

  const addVisualEffect = (type: "fade" | "blur" | "brightness") => {
    const newEffect: VisualEffect = {
      id: generateUniqueId(),
      type,
      intensity: 50,
      timestamp: currentTime,
      duration: 3,
    };
    setVisualEffects([...visualEffects, newEffect]);
  };

  const updatePreview = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Clear the canvas before drawing
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw video frame
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    // Apply visual effects
    visualEffects.forEach((effect) => {
      if (
        currentTime >= effect.timestamp &&
        currentTime <= effect.timestamp + effect.duration
      ) {
        applyVisualEffect(ctx, effect);
      }
    });

    // Draw text overlays
    textOverlays.forEach((overlay) => {
      if (
        currentTime >= overlay.timestamp &&
        currentTime <= overlay.timestamp + overlay.duration
      ) {
        drawTextOverlay(ctx, overlay);
      }
    });
  };

  const applyVisualEffect = (
    ctx: CanvasRenderingContext2D,
    effect: VisualEffect
  ) => {
    switch (effect.type) {
      case "fade":
        ctx.globalAlpha = effect.intensity / 100;
        break;
      case "blur":
        ctx.filter = `blur(${effect.intensity}px)`;
        break;
      case "brightness":
        ctx.filter = `brightness(${1 + effect.intensity / 100})`;
        break;
      default:
        ctx.filter = "none";
    }
  };

  const drawTextOverlay = (
    ctx: CanvasRenderingContext2D,
    overlay: TextOverlay
  ) => {
    ctx.font = `${overlay.fontSize}px Arial`;
    ctx.fillStyle = overlay.color;
    ctx.fillText(overlay.text, overlay.x, overlay.y);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const exportVideo = async () => {
    if (!videoRef.current) return;

    setIsExporting(true);

    // Initialize FFmpeg
    const ffmpegInstance = await ffmpeg.createFFmpeg({ log: true });
    await ffmpegInstance.load();

    // Input video file
    ffmpegInstance.FS(
      "writeFile",
      "input.mp4",
      await fetch(videoUrl).then((res) => res.arrayBuffer())
    );

    // Apply effects (currently, this is an example of adding text overlays)
    const filters = textOverlays
      .map(
        (overlay) =>
          `drawtext=text='${overlay.text}':x=${overlay.x}:y=${
            overlay.y
          }:fontcolor=${overlay.color.replace("#", "0x")}:fontsize=${
            overlay.fontSize
          }:enable='between(t,${overlay.timestamp},${
            overlay.timestamp + overlay.duration
          })'`
      )
      .join(",");

    await ffmpegInstance.run(
      "-i",
      "input.mp4",
      "-vf",
      filters,
      "-c:v",
      "libx264",
      "output.mp4"
    );

    // Save the output video
    const data = ffmpegInstance.FS("readFile", "output.mp4");
    const url = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = "edited_video.mp4";
    a.click();

    setIsExporting(false);
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <div className="flex flex-wrap justify-center gap-8 w-full">
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2">Original Video</h3>
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedData={() => setIsVideoLoaded(true)}
            controls
            className="w-full max-w-md rounded-lg"
          />
        </div>
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2">Preview with Effects</h3>
          <canvas
            ref={canvasRef}
            className="w-full max-w-md rounded-lg"
            width={600}
            height={337.5}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={addTextOverlay}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Text
        </button>
        <button
          onClick={() => addVisualEffect("fade")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Fade
        </button>
        <button
          onClick={() => addVisualEffect("blur")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Blur
        </button>
        <button
          onClick={() => addVisualEffect("brightness")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Brightness
        </button>
        <button
          onClick={exportVideo}
          disabled={isExporting}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Export Video"}
        </button>
      </div>

      <div className="w-full h-24 bg-gray-200 rounded-lg mt-4">
        {/* Timeline implementation */}
      </div>
    </div>
  );
}
