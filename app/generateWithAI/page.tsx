"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

interface VideoFile {
  name: string;
  path: string;
  thumbnail?: string;
}

interface VideoEditorResponse {
  status: string;
  editRequest?: any;
  result?: {
    url: string;
  };
  error?: string;
}

export default function GenerateWithAI() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editedVideoUrl, setEditedVideoUrl] = useState("");
  const [formData, setFormData] = useState({
    audio: {
      volume: 1,
      fadeIn: 2,
      fadeOut: 2,
      bass: 2,
      treble: 1,
      normalize: true,
    },
    output: {
      format: "mp4",
      resolution: "1080x1920",
      fps: 24,
      quality: "high",
    },
    effects: {
      transition: {
        type: "fade",
        duration: 1,
      },
      text: {
        content: "Promotional Video",
        position: "center",
        fontSize: 24,
        color: "#FF0000",
        startTime: 0,
        duration: 5,
        bold: true,
        boxOpacity: 0.5,
      },
      colorAdjustment: {
        brightness: 0.05,
        contrast: 1.1,
        saturation: 1.05,
        gamma: 1,
        vibrance: 1.1,
      },
      vignette: {
        angle: 45,
        strength: 0.3,
      },
      speed: 1.2,
    },
  });
  const [editMode, setEditMode] = useState<"prompt" | "custom">("prompt");
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  // Fetch available videos on component mount
  useEffect(() => {
    const fetchVideos = async () => {
      // In production, this would be an API call to get videos from public/videos
      const mockVideos = [
        { name: "video_1.mp4", path: "/videos/video_1.mp4" },
        { name: "video_2.mp4", path: "/videos/video_2.mp4" },
        { name: "video_3.mp4", path: "/videos/video_3.mp4" },
        { name: "video_4.mp4", path: "/videos/video_4.mp4" },
        { name: "video_5.mp4", path: "/videos/video_5.mp4" },
      ];
      setVideos(mockVideos);
    };
    fetchVideos();
  }, []);

  const handleVideoSelect = (videoName: string) => {
    setSelectedVideos((prev) =>
      prev.includes(videoName)
        ? prev.filter((v) => v !== videoName)
        : [...prev, videoName]
    );
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleEditWithAI = async () => {
    setIsLoading(true);
    setError(null);
    setProcessingStatus("Initializing...");

    try {
      // Validate selected videos
      if (selectedVideos.length === 0) {
        throw new Error("Please select at least one video");
      }

      let requestBody;

      if (editMode === "prompt") {
        // Validate prompt
        if (!prompt.trim()) {
          throw new Error("Please enter a prompt");
        }

        setProcessingStatus("Analyzing prompt...");
        // Call analyzeEdit API with prompt
        requestBody = {
          prompt,
          clips: selectedVideos.map((name) => ({
            fileName: name,
            duration: 5,
          })),
        };
      } else {
        // Use custom settings
        requestBody = {
          clips: selectedVideos.map((name) => ({
            fileName: name,
            duration: 5,
          })),
          audio: formData.audio,
          output: formData.output,
          effects: formData.effects,
        };
      }

      setProcessingStatus("Sending request to AI...");
      const response = await fetch("/api/analyzeEdit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process video");
      }

      const data: VideoEditorResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.result?.url) {
        throw new Error("No video URL in response");
      }

      // Update video URL with timestamp to prevent caching
      const timestamp = new Date().getTime();
      setEditedVideoUrl(`${data.result.url}?t=${timestamp}`);
      setProcessingStatus("Video ready!");
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white ml-[250px]">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold text-white leading-tight mt-2">
            Edit with
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {" "}
              AI
            </span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Video Selection */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Available Videos</h2>
            <div className="grid grid-cols-2 gap-4">
              {videos.map((video) => (
                <div
                  key={video.name}
                  className={`p-4 cursor-pointer transition-all rounded-lg border ${
                    selectedVideos.includes(video.name)
                      ? "border-2 border-purple-500"
                      : "border-gray-700"
                  }`}
                  onClick={() => handleVideoSelect(video.name)}
                >
                  <div className="aspect-[9/16] bg-gray-800 mb-2 rounded-lg overflow-hidden">
                    <video
                      src={video.path}
                      className="w-full h-full object-cover"
                      controls
                    />
                  </div>
                  <p className="text-sm text-center">{video.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Settings */}
          <div className="space-y-6 overflow-y-auto max-h-[90vh] p-4">
            <div className="space-y-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => setEditMode("prompt")}
                  className={`flex-1 py-2 px-4 rounded-lg ${
                    editMode === "prompt"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-800 text-gray-300"
                  }`}
                >
                  Generate with Prompt
                </button>
                <button
                  onClick={() => setEditMode("custom")}
                  className={`flex-1 py-2 px-4 rounded-lg ${
                    editMode === "custom"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-800 text-gray-300"
                  }`}
                >
                  Custom Settings
                </button>
              </div>

              {editMode === "prompt" ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Enter Prompt</h3>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe how you want your video to look..."
                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Audio Settings */}
                  <div className="bg-gray-800/50 p-4 rounded-lg space-y-4">
                    <h3 className="text-xl font-semibold">Audio Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">Volume</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={formData.audio.volume}
                          onChange={(e) =>
                            handleInputChange(
                              "audio",
                              "volume",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full"
                        />
                        <span className="text-xs">{formData.audio.volume}</span>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Fade In (s)
                        </label>
                        <input
                          type="number"
                          value={formData.audio.fadeIn}
                          onChange={(e) =>
                            handleInputChange(
                              "audio",
                              "fadeIn",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full bg-gray-700 rounded p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">
                          Fade Out (s)
                        </label>
                        <input
                          type="number"
                          value={formData.audio.fadeOut}
                          onChange={(e) =>
                            handleInputChange(
                              "audio",
                              "fadeOut",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full bg-gray-700 rounded p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Bass</label>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={formData.audio.bass}
                          onChange={(e) =>
                            handleInputChange(
                              "audio",
                              "bass",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Treble</label>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={formData.audio.treble}
                          onChange={(e) =>
                            handleInputChange(
                              "audio",
                              "treble",
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Normalize</label>
                        <input
                          type="checkbox"
                          checked={formData.audio.normalize}
                          onChange={(e) =>
                            handleInputChange(
                              "audio",
                              "normalize",
                              e.target.checked
                            )
                          }
                          className="w-4 h-4"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Output Settings */}
                  <div className="bg-gray-800/50 p-4 rounded-lg space-y-4">
                    <h3 className="text-xl font-semibold">Output Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1">Format</label>
                        <select
                          value={formData.output.format}
                          onChange={(e) =>
                            handleInputChange(
                              "output",
                              "format",
                              e.target.value
                            )
                          }
                          className="w-full bg-gray-700 rounded p-2"
                        >
                          <option value="mp4">MP4</option>
                          <option value="mov">MOV</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Resolution</label>
                        <select
                          value={formData.output.resolution}
                          onChange={(e) =>
                            handleInputChange(
                              "output",
                              "resolution",
                              e.target.value
                            )
                          }
                          className="w-full bg-gray-700 rounded p-2"
                        >
                          <option value="1080x1920">1080x1920</option>
                          <option value="720x1280">720x1280</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">FPS</label>
                        <input
                          type="number"
                          value={formData.output.fps}
                          onChange={(e) =>
                            handleInputChange(
                              "output",
                              "fps",
                              parseInt(e.target.value)
                            )
                          }
                          className="w-full bg-gray-700 rounded p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Quality</label>
                        <select
                          value={formData.output.quality}
                          onChange={(e) =>
                            handleInputChange(
                              "output",
                              "quality",
                              e.target.value
                            )
                          }
                          className="w-full bg-gray-700 rounded p-2"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Effects Settings */}
                  <div className="bg-gray-800/50 p-4 rounded-lg space-y-4">
                    <h3 className="text-xl font-semibold">Effects</h3>

                    {/* Transition */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Transition</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1">Type</label>
                          <select
                            value={formData.effects.transition.type}
                            onChange={(e) =>
                              handleInputChange("effects", "transition", {
                                ...formData.effects.transition,
                                type: e.target.value,
                              })
                            }
                            className="w-full bg-gray-700 rounded p-2"
                          >
                            <option value="fade">Fade</option>
                            <option value="crossfade">Crossfade</option>
                            <option value="wipe">Wipe</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Duration</label>
                          <input
                            type="number"
                            value={formData.effects.transition.duration}
                            onChange={(e) =>
                              handleInputChange("effects", "transition", {
                                ...formData.effects.transition,
                                duration: parseFloat(e.target.value),
                              })
                            }
                            className="w-full bg-gray-700 rounded p-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Text Overlay */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Text Overlay</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm mb-1">Content</label>
                          <input
                            type="text"
                            value={formData.effects.text.content}
                            onChange={(e) =>
                              handleInputChange("effects", "text", {
                                ...formData.effects.text,
                                content: e.target.value,
                              })
                            }
                            className="w-full bg-gray-700 rounded p-2"
                          />
                        </div>
                        {/* Add other text overlay inputs */}
                      </div>
                    </div>

                    {/* Color Adjustment */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Color Adjustment</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(formData.effects.colorAdjustment).map(
                          ([key, value]) => (
                            <div key={key}>
                              <label className="block text-sm mb-1 capitalize">
                                {key}
                              </label>
                              <input
                                type="range"
                                min={key === "brightness" ? -1 : 0}
                                max={key === "brightness" ? 1 : 2}
                                step="0.05"
                                value={value}
                                onChange={(e) =>
                                  handleInputChange(
                                    "effects",
                                    "colorAdjustment",
                                    {
                                      ...formData.effects.colorAdjustment,
                                      [key]: parseFloat(e.target.value),
                                    }
                                  )
                                }
                                className="w-full"
                              />
                              <span className="text-xs">{value}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Vignette */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Vignette</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1">Angle</label>
                          <input
                            type="number"
                            value={formData.effects.vignette.angle}
                            onChange={(e) =>
                              handleInputChange("effects", "vignette", {
                                ...formData.effects.vignette,
                                angle: parseInt(e.target.value),
                              })
                            }
                            className="w-full bg-gray-700 rounded p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Strength</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={formData.effects.vignette.strength}
                            onChange={(e) =>
                              handleInputChange("effects", "vignette", {
                                ...formData.effects.vignette,
                                strength: parseFloat(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Speed */}
                    <div>
                      <label className="block text-sm mb-1">Speed</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={formData.effects.speed}
                        onChange={(e) =>
                          handleInputChange(
                            "effects",
                            "speed",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full"
                      />
                      <span className="text-xs">{formData.effects.speed}x</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleEditWithAI}
                disabled={
                  isLoading ||
                  (!prompt && editMode === "prompt") ||
                  selectedVideos.length === 0
                }
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" />
                    Processing...
                  </span>
                ) : (
                  "Generate Video"
                )}
              </button>
            </div>

            {/* Status and Error Display */}
            {(isLoading || error) && (
              <div
                className={`mb-4 p-4 rounded-lg ${
                  error
                    ? "bg-red-500/10 border border-red-500"
                    : "bg-blue-500/10 border border-blue-500"
                }`}
              >
                {error ? (
                  <p className="text-red-500">{error}</p>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="animate-spin" />
                    <p className="text-blue-400">{processingStatus}</p>
                  </div>
                )}
              </div>
            )}

            {/* Preview Section */}
            {editedVideoUrl && !isLoading && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Edited Video</h3>
                <div className="aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    src={editedVideoUrl}
                    controls
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      setError("Error loading video. Please try again.");
                      console.error("Video error:", e);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
