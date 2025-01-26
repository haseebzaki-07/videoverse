"use client";

import { useSearchParams } from "next/navigation";
import VideoEditor from "./VideoEditor";

export default function VideoEditorClient() {
  const searchParams = useSearchParams();
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return <div>No video URL provided</div>;
  }

  return <VideoEditor videoUrl={videoUrl} />;
}
