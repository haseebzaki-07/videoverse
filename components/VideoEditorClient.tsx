"use client";

import { useSearchParams } from "next/navigation";
import VideoEditor from "@/components/VideoEditor";

export default function VideoEditorClient() {
  const searchParams = useSearchParams();
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen ml-64">
        <p>No video URL provided. Please generate a video first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 ml-64">
      <main className="w-full max-w-6xl px-4">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Enhance Your
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {" "}
              Video
            </span>
          </h1>
       
        </div>
        <VideoEditor videoUrl={videoUrl} />
      </main>
    </div>
  );
}
