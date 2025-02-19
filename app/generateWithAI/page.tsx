"use client";

import { useState, useEffect } from "react";
import { Loader2, Maximize2 } from "lucide-react";
import VideoPreviewModal from "@/components/VideoPreviewModal";

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
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch available videos on component mount
  useEffect(() => {
    const fetchVideos = async () => {
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

  const handleEditWithAI = async () => {
    setIsLoading(true);
    setError(null);
    setProcessingStatus("Initializing...");

    try {
      // Validate selected videos
      if (selectedVideos.length === 0) {
        throw new Error("Please select at least one video");
      }

      // Validate prompt
      if (!prompt.trim()) {
        throw new Error(
          "Please enter a prompt describing how you want to edit the videos"
        );
      }

      setProcessingStatus("Analyzing prompt and processing videos...");

      const requestBody = {
        prompt,
        clips: selectedVideos.map((name, index) => ({
          fileName: name,
          duration: 5,
          order: index,
        })),
      };

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
    <div className="min-h-screen text-white ml-[250px]">
      {/* Fixed Header */}
      <div className="fixed top-0 right-0 left-[250px] z-30 border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Edit with
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {" "}
              AI
            </span>
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-[100px] container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Video Selection */}
          <div className="space-y-4">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h2 className="text-2xl font-semibold mb-4">
                Select Videos to Edit
              </h2>
              <p className="text-gray-400 mb-4">
                Choose one or more videos to combine and edit. The order of
                selection matters.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
                {videos.map((video) => (
                  <div
                    key={video.name}
                    className={`relative p-2 cursor-pointer transition-all rounded-lg border ${
                      selectedVideos.includes(video.name)
                        ? "border-2 border-purple-500"
                        : "border-gray-700 hover:border-purple-400"
                    }`}
                    onClick={() => handleVideoSelect(video.name)}
                  >
                    <div className="aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden">
                      <video
                        src={video.path}
                        className="w-full h-full object-cover"
                        controls
                      />
                    </div>
                    <p className="text-xs text-center mt-1">{video.name}</p>
                    {selectedVideos.includes(video.name) && (
                      <div className="absolute top-4 right-4 bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                        {selectedVideos.indexOf(video.name) + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Prompt and Controls */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Describe Your Edit</h3>
              <p className="text-gray-400 mb-4">
                Describe how you want your videos to be edited. Be specific
                about transitions, effects, or any particular style you want.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Combine these clips with smooth transitions, add a dreamy effect, and make it flow naturally..."
                className="w-full h-32 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleEditWithAI}
              disabled={
                isLoading || !prompt.trim() || selectedVideos.length === 0
              }
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin mr-2" />
                  {processingStatus}
                </span>
              ) : (
                "Generate Video"
              )}
            </button>

            {/* Status and Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500 p-4 rounded-lg">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {/* View Latest Edit Button */}
            {editedVideoUrl && !isLoading && (
              <button
                onClick={() => setShowPreviewModal(true)}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200"
              >
                <Maximize2 className="h-5 w-5" />
                View Generated Video
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && editedVideoUrl && (
        <VideoPreviewModal
          videoUrl={editedVideoUrl}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
