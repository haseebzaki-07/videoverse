import { Suspense } from "react";
import VideoEditorClient from "@/components/VideoEditorClient";

export default function VideoEditorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VideoEditorClient />
    </Suspense>
  );
}
