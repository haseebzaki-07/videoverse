"use client";

import { useSearchParams } from "next/navigation";
import VideoEditor from "@/components/VideoEditor";

export default function VideoEditorClient() {
  const searchParams = useSearchParams();
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return <p>No video URL provided. Please generate a video first.</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-3xl mb-4">Edit Your Video</h1>
      <VideoEditor videoUrl={videoUrl} />
    </div>
  );
}
