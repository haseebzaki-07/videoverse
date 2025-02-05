"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2, History } from "lucide-react";
import { toast } from "sonner";

export default function GenerateWithKling() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  const updateProgress = (percent: number, text: string) => {
    setProgress(percent);
    setProgressText(text);
  };

  const handleShowLatestVideo = useCallback(async () => {
    try {
      const response = await fetch("/api/getLatestKlingVideo");
      if (!response.ok) {
        throw new Error("Failed to fetch latest video");
      }
      const data = await response.json();
      if (data.videoPath) {
        setGeneratedVideo(data.videoPath);
        toast.success("Showing latest generated video");
      } else {
        toast.error("No previous videos found");
      }
    } catch (error) {
      toast.error("Failed to load previous video");
      console.error("Error loading latest video:", error);
    }
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    try {
      setLoading(true);
      setGeneratedVideo(null);
      updateProgress(0, "Starting generation process...");

      // Step 1: Analyze prompt and fetch music
      updateProgress(20, "Analyzing prompt and fetching music...");
      console.log("Step 1: Sending prompt to analyzeKlingPrompt:", { prompt });

      const musicResponse = await fetch("/api/analyzeKlingPrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!musicResponse.ok) {
        const error = await musicResponse.json();
        throw new Error(
          error.details || error.error || "Failed to fetch music"
        );
      }

      const musicData = await musicResponse.json();
      console.log("Music data received:", musicData);

      if (!musicData.success || !musicData.data?.music?.sound?.localPath) {
        console.error("Invalid music data:", musicData);
        throw new Error("Invalid music data received");
      }

      const musicPath = musicData.data.music.sound.localPath;
      console.log("Music saved at:", musicPath);
      updateProgress(40, "Music fetched and saved successfully!");

      // Step 2: Generate video
      updateProgress(60, "Generating AI video...");
      console.log("Step 2: Sending prompt to generateKlingVideo");

      const videoResponse = await fetch("/api/generateKlingVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "9:16",
        }),
      });

      if (!videoResponse.ok) {
        const error = await videoResponse.json();
        throw new Error(
          error.details || error.error || "Failed to generate video"
        );
      }

      const videoData = await videoResponse.json();
      console.log("Video data received:", videoData);

      if (!videoData.videoPath) {
        console.error("Invalid video data:", videoData);
        throw new Error("No video path received from video generation");
      }

      const videoPath = videoData.videoPath;
      console.log("Video saved at:", videoPath);
      updateProgress(80, "Video generated successfully!");

      // Step 3: Merge video and music
      updateProgress(90, "Creating final music video...");
      console.log("Step 3: Sending paths to generateKlingMusicVideo", {
        videoPath,
        musicPath,
      });

      const mergeResponse = await fetch("/api/generateKlingMusicVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: videoPath,
          musicPath: musicPath,
        }),
      });

      if (!mergeResponse.ok) {
        const error = await mergeResponse.json();
        throw new Error(
          error.details || error.error || "Failed to generate music video"
        );
      }

      const mergeData = await mergeResponse.json();
      console.log("Merge response received:", mergeData);

      if (!mergeData.videoPath) {
        console.error("Invalid merge data:", mergeData);
        throw new Error("No final video path received from merge operation");
      }

      updateProgress(100, "Video ready!");
      setGeneratedVideo(mergeData.videoPath);
      console.log("Final video path:", mergeData.videoPath);
      toast.success("Music video generated successfully!");
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
      updateProgress(0, "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 lg:px-8">
      <div className="mb-8 space-y-4">
        <h2 className="text-2xl md:text-4xl font-bold text-center">
          Generate AI Video with Music
        </h2>
        <p className="text-muted-foreground font-light text-sm md:text-lg text-center">
          Turn your imagination into stunning videos with Kling AI
        </p>
      </div>

      <div className="px-4 lg:px-8 space-y-4 max-w-4xl mx-auto">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Enter your video prompt</Label>
            <Textarea
              placeholder="Describe the video you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
              disabled={loading}
            />
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {progressText}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              disabled={loading || !prompt.trim()}
              onClick={handleGenerate}
              className="flex-1"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Generate Video"
              )}
            </Button>
            <Button
              onClick={handleShowLatestVideo}
              variant="outline"
              className="flex items-center gap-2"
              disabled={loading}
            >
              <History className="h-4 w-4" />
              Previous Edit
            </Button>
          </div>
        </Card>

        {generatedVideo && (
          <Card className="p-6 mt-8">
            <div className="flex justify-center items-center">
              <div className="w-full max-w-[350px]">
                <div
                  className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden"
                  style={{
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <video
                    src={generatedVideo}
                    controls
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain"
                    autoPlay
                    onLoadedMetadata={(e) => {
                      const video = e.target as HTMLVideoElement;
                      if (video.videoHeight > video.videoWidth) {
                        video.style.setProperty("object-fit", "contain");
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
