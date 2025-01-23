// import PlaySound from '@/components/PlaySound';
import VideoGenerator from "@/components/VideoGenerator";
import Head from "next/head";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Head>
        <title className="text-2xl ">Text to Music Video Generator</title>
      </Head>
      <main>
        <h1 className="text-3xl ml-36 mb-4 mt-4 ">
          Text to Music Video Generator
        </h1>

        <VideoGenerator />
      </main>
    </div>
  );
}
