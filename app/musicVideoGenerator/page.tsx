// import PlaySound from '@/components/PlaySound';
import VideoGenerator from "@/components/VideoGenerator";
import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Head>
        <title className="text-2xl ">TikTok Video Generator</title>
      </Head>
      <main>
        <h1 className="text-3xl ml-36 mb-4 mt-4 ">
          TikTok Video Generator
        </h1>

        <VideoGenerator />

        <div className="mt-4">
          <Link
            href={`/videoEditor?videoUrl=${encodeURIComponent(
              "/output/final_video.mp4"
            )}`}
            className="text-blue-500 underline"
          >
            Edit Generated Video
          </Link>
        </div>
      </main>
    </div>
  );
}
