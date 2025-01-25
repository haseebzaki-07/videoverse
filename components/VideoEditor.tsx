import { useState, useRef, useEffect } from "react";
import styles from "./VideoEditor.module.css";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

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

export default function VideoEditor({ videoUrl }: { videoUrl: string }) {
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [visualEffects, setVisualEffects] = useState<VisualEffect[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      updatePreview();
    }, 1000 / 30); // Update at 30 FPS
    return () => clearInterval(interval);
  }, [currentTime, textOverlays, visualEffects]);

  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: Date.now().toString(),
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
      id: Date.now().toString(),
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

    try {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: "/ffmpeg/ffmpeg-core.js",
        wasmURL: "/ffmpeg/ffmpeg-core.wasm",
        workerURL: "/ffmpeg/ffmpeg-core.worker.js",
      });

      // Input video file
      try {
        const videoData = await fetchFile(videoUrl);
        await ffmpeg.writeFile("input.mp4", videoData);
      } catch (error) {
        console.error("Error fetching video file:", error);
        setIsExporting(false);
        return;
      }

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

      try {
        await ffmpeg.run(
          "-i",
          "input.mp4",
          "-vf",
          filters,
          "-c:v",
          "libx264",
          "output.mp4"
        );
      } catch (error) {
        console.error("Error running FFmpeg command:", error);
        setIsExporting(false);
        return;
      }

      // Save the output video
      try {
        const data = ffmpeg.FS("readFile", "output.mp4");
        const url = URL.createObjectURL(
          new Blob([data.buffer], { type: "video/mp4" })
        );

        const a = document.createElement("a");
        a.href = url;
        a.download = "edited_video.mp4";
        a.click();
      } catch (error) {
        console.error("Error reading output video file:", error);
      }
    } catch (error) {
      console.error("Error initializing FFmpeg:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.editor}>
      <div className={styles.preview}>
        <video
          ref={videoRef}
          src={videoUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedData={() => setIsVideoLoaded(true)}
          controls
          style={{ width: "100%", maxWidth: "480px" }}
        />
        <canvas
          ref={canvasRef}
          className={styles.previewCanvas}
          width={480}
          height={270}
        />
      </div>

      <div className={styles.controls}>
        <button onClick={addTextOverlay}>Add Text</button>
        <button onClick={() => addVisualEffect("fade")}>Add Fade</button>
        <button onClick={() => addVisualEffect("blur")}>Add Blur</button>
        <button onClick={() => addVisualEffect("brightness")}>Add</button>
        <button onClick={exportVideo} disabled={isExporting}>
          {isExporting ? "Exporting..." : "Export Video"}
        </button>
      </div>

      <div className={styles.timeline}>{/* Timeline implementation */}</div>
    </div>
  );
}
