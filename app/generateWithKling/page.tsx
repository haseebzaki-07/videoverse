"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Music2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Progress } from "@/components/ui/progress";

const defaultSongs = [
  {
    id: "upbeat",
    name: "Upbeat Pop",
    path: "/defaultSongs/upbeat-pop.mp3",
  },
  {
    id: "cinematic",
    name: "Cinematic Epic",
    path: "/defaultSongs/cinematic-epic.mp3",
  },
  {
    id: "ambient",
    name: "Ambient Chill",
    path: "/defaultSongs/ambient-chill.mp3",
  },
];

export default function GenerateWithKling() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedSong, setSelectedSong] = useState("");
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  const updateProgress = (percent: number, text: string) => {
    setProgress(percent);
    setProgressText(text);
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setGeneratedVideo(null);
      updateProgress(0, "Starting video generation...");

      // First generate the video
      updateProgress(10, "Generating AI video...");
      const videoResponse = await fetch("/api/generateKlingVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          duration: 5,
          aspect_ratio: "9:16",
        }),
      });

      if (!videoResponse.ok) {
        const error = await videoResponse.json();
        throw new Error(error.error || "Failed to generate video");
      }

      const videoData = await videoResponse.json();
      updateProgress(50, "Video generated! Processing audio...");

      // Upload the selected song
      const selectedSongPath = defaultSongs.find(
        (song) => song.id === selectedSong
      )?.path;

      if (!selectedSongPath) {
        throw new Error("No song selected");
      }

      updateProgress(60, "Uploading music...");
      const songResponse = await fetch(selectedSongPath);
      const songBlob = await songResponse.blob();

      const formData = new FormData();
      formData.append("audio", songBlob, "selected_song.mp3");

      const uploadResponse = await fetch("/api/uploadKlingMusic", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Failed to upload music");
      }

      updateProgress(80, "Merging video and audio...");
      // Finally, merge video and audio
      const mergeResponse = await fetch("/api/generateKlingMusicVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Use latest files
      });

      if (!mergeResponse.ok) {
        const error = await mergeResponse.json();
        throw new Error(error.error || "Failed to generate music video");
      }

      const mergeData = await mergeResponse.json();
      updateProgress(100, "Video ready!");
      setGeneratedVideo(mergeData.videoPath);
      toast.success("Video generated successfully!");
    } catch (error) {
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

          <div className="space-y-2">
            <Label>Select background music</Label>
            <Select
              value={selectedSong}
              onValueChange={setSelectedSong}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a song" />
              </SelectTrigger>
              <SelectContent>
                {defaultSongs.map((song) => (
                  <SelectItem key={song.id} value={song.id}>
                    <div className="flex items-center gap-2">
                      <Music2 className="h-4 w-4" />
                      <span>{song.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {progressText}
              </p>
            </div>
          )}

          <Button
            disabled={loading || !prompt || !selectedSong}
            onClick={handleGenerate}
            className="w-full"
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
        </Card>

        {generatedVideo && (
          <Card className="p-6 mt-8">
            <div className="aspect-[9/16] relative">
              <video
                src={generatedVideo}
                controls
                className="rounded-lg w-full h-full"
                autoPlay
                playsInline
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
