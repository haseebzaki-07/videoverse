import { useState, useRef, useEffect } from "react";
import styles from "./VideoEditor.module.css";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  isDragging: boolean;
  isEditing: boolean;
}

interface Effects {
  fade: number;
  brightness: number;
  blur: number;
}

export default function VideoEditor({ videoUrl }: { videoUrl: string }) {
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [effects, setEffects] = useState<Effects>({
    fade: 1,
    brightness: 1,
    blur: 0,
  });
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const interval = setInterval(updateCanvas, 1000 / 30); // 30 FPS
    return () => clearInterval(interval);
  }, [textOverlays, effects]);

  const updateCanvas = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Apply effects
    ctx.filter = `brightness(${effects.brightness}) blur(${effects.blur}px)`;
    ctx.globalAlpha = effects.fade;

    // Draw video frame
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    // Draw text overlays
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    textOverlays.forEach((overlay) => {
      ctx.font = "24px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(overlay.text, overlay.x, overlay.y);
    });
  };

  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: Date.now().toString(),
      text: "New Text",
      x: 50,
      y: 50,
      isDragging: false,
      isEditing: false,
    };
    setTextOverlays([...textOverlays, newOverlay]);
  };

  const handleMouseDown = (e: React.MouseEvent, overlayId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === overlayId ? { ...overlay, isDragging: true } : overlay
      )
    );
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.isDragging ? { ...overlay, x, y } : overlay
      )
    );
  };

  const handleMouseUp = () => {
    setTextOverlays((overlays) =>
      overlays.map((overlay) => ({ ...overlay, isDragging: false }))
    );
  };

  const handleTextEdit = (overlayId: string, newText: string) => {
    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === overlayId ? { ...overlay, text: newText } : overlay
      )
    );
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
            }:fontcolor=${overlay.text.replace(
              "#",
              "0x"
            )}:fontsize=24:enable='between(t,${overlay.timestamp},${
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
        <div>
          <h3>Original Video</h3>
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={() => setIsVideoLoaded(true)}
            controls
            className={styles.videoElement}
          />
        </div>
        <div>
          <h3>Preview with Effects</h3>
          <canvas
            ref={canvasRef}
            className={styles.previewCanvas}
            width={600}
            height={337.5}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.effectControls}>
          <div>
            <label>Fade:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={effects.fade}
              onChange={(e) =>
                setEffects({ ...effects, fade: parseFloat(e.target.value) })
              }
            />
          </div>
          <div>
            <label>Brightness:</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={effects.brightness}
              onChange={(e) =>
                setEffects({
                  ...effects,
                  brightness: parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div>
            <label>Blur:</label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={effects.blur}
              onChange={(e) =>
                setEffects({ ...effects, blur: parseFloat(e.target.value) })
              }
            />
          </div>
        </div>

        <button onClick={addTextOverlay} className={styles.actionButton}>
          Add Text
        </button>

        <div className={styles.textOverlays}>
          {textOverlays.map((overlay) => (
            <div key={overlay.id} className={styles.textOverlay}>
              <input
                type="text"
                value={overlay.text}
                onChange={(e) => handleTextEdit(overlay.id, e.target.value)}
                onMouseDown={(e) => handleMouseDown(e, overlay.id)}
              />
            </div>
          ))}
        </div>

        <button
          onClick={exportVideo}
          disabled={isExporting}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Export Video"}
        </button>
      </div>
    </div>
  );
}
