import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./VideoEditor.module.css";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";



const verifyVideo = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(true);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(false);
    };

    video.src = URL.createObjectURL(file);
  });
};

export default function VideoEditor({ videoUrl }) {
  const [textOverlays, setTextOverlays] = useState([]);
  const [effects, setEffects] = useState({
    fade: 1,
    brightness: 1,
    blur: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const updateCanvas = useCallback(() => {
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
    const currentTime = videoRef.current.currentTime;
    textOverlays.forEach((overlay) => {
      if (
        currentTime >= overlay.timestamp &&
        currentTime <= overlay.timestamp + overlay.duration
      ) {
        ctx.font = `${overlay.fontSize}px Arial`;
        ctx.fillStyle = overlay.color;
        ctx.fillText(overlay.text, overlay.x, overlay.y);
      }
    });
  }, [textOverlays, effects]);

  useEffect(() => {
    const interval = setInterval(updateCanvas, 1000 / 30);
    return () => clearInterval(interval);
  }, [updateCanvas]);

  const addTextOverlay = () => {
    const newOverlay = {
      id: Date.now().toString(),
      text: "New Text",
      x: 50,
      y: 50,
      isDragging: false,
      isEditing: false,
      color: "#ffffff",
      fontSize: 24,
      timestamp: videoRef.current?.currentTime || 0, // Set timestamp to current video time
      duration: 3, // Default 3 second duration
    };
    setTextOverlays([...textOverlays, newOverlay]);
  };

  const handleMouseDown = (e, overlayId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === overlayId
          ? { ...overlay, isDragging: true, x: mouseX, y: mouseY }
          : overlay
      )
    );
  };

  const handleMouseMove = (e) => {
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

  const handleTextEdit = (overlayId, newText) => {
    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === overlayId ? { ...overlay, text: newText } : overlay
      )
    );
  };

  const handleColorChange = (overlayId, newColor) => {
    setTextOverlays((overlays) =>
      overlays.map((overlay) =>
        overlay.id === overlayId ? { ...overlay, color: newColor } : overlay
      )
    );
  };

  const exportVideo = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsExporting(true);
    setExportStatus("Initializing...");
    setExportProgress(0);

    try {
      const ffmpeg = new FFmpeg();

      // Load FFmpeg
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
        workerURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.worker.js`,
          "text/javascript"
        ),
      });

      // Write the input file
      setExportStatus("Loading video...");
      const videoData = await fetchFile(videoUrl);
      const videoBlob = new Blob([videoData], { type: "video/mp4" });
      const isValid = await verifyVideo(videoBlob);

      if (!isValid) {
        throw new Error("Invalid input video format");
      }

      await ffmpeg.writeFile("input.mp4", videoData);

      // Get input video information
      try {
        await ffmpeg.exec(["-i", "input.mp4", "-f", "null", "-"]);
      } catch (error) {
        console.log("Input video info:", error.message);
      }

      // Prepare filters
      const filters = [];

      // Add effects
      if (effects.fade !== 1) filters.push(`fade=t=in:st=0:d=1`);
      if (effects.brightness !== 1)
        filters.push(`eq=brightness=${effects.brightness}`);
      if (effects.blur > 0) filters.push(`gblur=sigma=${effects.blur}`);

      // Add text overlays
      textOverlays.forEach((overlay) => {
        filters.push(
          `drawtext=text='${overlay.text}':x=${overlay.x}:y=${overlay.y}:` +
            `fontcolor=${overlay.color.replace("#", "0x")}:fontsize=${
              overlay.fontSize
            }:` +
            `enable='between(t,${overlay.timestamp},${
              overlay.timestamp + overlay.duration
            })'`
        );
      });

      const filterString = filters.join(",") || "null";

      setExportStatus("Applying effects...");
      // Updated FFmpeg command with more conservative settings
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        filterString,
        "-c:v",
        "libx264",
        "-preset",
        "slow", // Changed from medium to slow for better compatibility
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "copy", // Changed from aac to copy to preserve original audio
        "-y", // Overwrite output files without asking
        "output.mp4",
      ]);

      // Verify the output file was created
      try {
        await ffmpeg.exec(["-i", "output.mp4", "-f", "null", "-"]);
      } catch (error) {
        console.log("Output video info:", error.message);
      }

      setExportStatus("Creating final video...");
      const data = await ffmpeg.readFile("output.mp4");

      // Create blob with specific codecs in the type
      const url = URL.createObjectURL(
        new Blob([data.buffer], {
          type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        })
      );

      // Create and trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited_video.mp4";
      document.body.appendChild(a); // Append to body
      a.click();
      document.body.removeChild(a); // Clean up

      URL.revokeObjectURL(url);
      setExportStatus("Export complete!");

      setTimeout(() => {
        setExportStatus("");
        setExportProgress(0);
      }, 3000);
    } catch (error) {
      console.error("Error during video export:", error);
      setExportStatus("Export failed");
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
                className={styles.textInput}
                value={overlay.text}
                onChange={(e) => handleTextEdit(overlay.id, e.target.value)}
                onMouseDown={(e) => handleMouseDown(e, overlay.id)}
                placeholder="Enter text..."
              />

              <input
                type="color"
                className={styles.colorInput}
                value={overlay.color}
                onChange={(e) => handleColorChange(overlay.id, e.target.value)}
                title="Text color"
              />

              <div className={styles.timeControl}>
                <label className={styles.label}>Start:</label>
                <input
                  type="number"
                  className={styles.timeInput}
                  min="0"
                  step="0.1"
                  value={overlay.timestamp}
                  onChange={(e) =>
                    setTextOverlays((overlays) =>
                      overlays.map((o) =>
                        o.id === overlay.id
                          ? { ...o, timestamp: parseFloat(e.target.value) }
                          : o
                      )
                    )
                  }
                />
              </div>

              <div className={styles.timeControl}>
                <label className={styles.label}>Duration:</label>
                <input
                  type="number"
                  className={styles.timeInput}
                  min="0.1"
                  step="0.1"
                  value={overlay.duration}
                  onChange={(e) =>
                    setTextOverlays((overlays) =>
                      overlays.map((o) =>
                        o.id === overlay.id
                          ? { ...o, duration: parseFloat(e.target.value) }
                          : o
                      )
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={exportVideo}
          disabled={isExporting}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2
            ${
              isExporting
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}
        >
          {isExporting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {exportStatus || "Exporting..."}{" "}
              {exportProgress > 0 && `(${exportProgress}%)`}
            </>
          ) : (
            "Export Video"
          )}
        </button>
      </div>
    </div>
  );
}
