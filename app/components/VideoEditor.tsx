import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

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
  const [textOverlays] = useState<TextOverlay[]>([]);
  const [visualEffects] = useState<VisualEffect[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const exportVideo = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsExporting(true);
    setExportStatus("Initializing...");

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

      setExportStatus("Loading video...");
      await ffmpeg.writeFile("input.mp4", await fetchFile(videoUrl));

      // Get input video information
      try {
        await ffmpeg.exec(["-i", "input.mp4", "-f", "null", "-"]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log("Input video info:", errorMessage);
      }

      // Prepare filters
      const filters: string[] = [];

      // Add effects
      if (visualEffects.length > 0) {
        visualEffects.forEach((effect) => {
          switch (effect.type) {
            case "fade":
              filters.push(
                `fade=t=in:st=${effect.timestamp}:d=${effect.duration}`
              );
              break;
            case "blur":
              filters.push(
                `gblur=sigma=${effect.intensity}:start_time=${effect.timestamp}:duration=${effect.duration}`
              );
              break;
            case "brightness":
              filters.push(
                `eq=brightness=${effect.intensity}:enable='between(t,${
                  effect.timestamp
                },${effect.timestamp + effect.duration})'`
              );
              break;
          }
        });
      }

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

      // Execute FFmpeg command
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        filterString,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "copy",
        "-y",
        "output.mp4",
      ]);

      setExportStatus("Creating final video...");

      // Read the output file
      const outputData = await ffmpeg.readFile("output.mp4");

      // Create blob URL
      const url = URL.createObjectURL(
        new Blob([outputData], {
          type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        })
      );

      // Create and trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited_video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
      setExportStatus("Export complete!");

      setTimeout(() => {
        setExportStatus("");
      }, 3000);
    } catch (error) {
      console.error("Error during video export:", error);
      setExportStatus("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <div className="flex flex-wrap justify-center gap-8 w-full">
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2">Original Video</h3>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-w-md rounded-lg"
          />
        </div>
      </div>

      <button
        onClick={exportVideo}
        disabled={isExporting}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
      >
        {isExporting ? "Exporting..." : "Export Video"}
      </button>

      {exportStatus && (
        <div className="w-full h-24 bg-gray-200 rounded-lg mt-4">
          <p>{exportStatus}</p>
        </div>
      )}
    </div>
  );
}
