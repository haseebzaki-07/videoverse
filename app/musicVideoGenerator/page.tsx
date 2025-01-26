// import PlaySound from '@/components/PlaySound';
import VideoGenerator from "@/components/VideoGenerator";
import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 ml-64">
      <Head>
        <title className="text-2xl">TikTok Video Generator</title>
      </Head>
      <main className="w-full max-w-4xl px-4">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold text-white leading-tight mt-2">
            TikTok
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              {" "}
              Video Generator
            </span>
          </h1>
          
        </div>
        <VideoGenerator />
      </main>
    </div>
  );
}
