import axios from "axios";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

// Pexels API Key (from .env.local)
const pexelsApiKey = process.env.PEXELS_API_KEY!; // Use non-null assertion

// Define a type for the video object
interface Video {
  video_files: { link: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const { topic, style, language } = await req.json();

    // Basic validation
    if (!topic) {
      return new Response(JSON.stringify({ message: "Topic is required" }), {
        status: 400,
      });
    }

    // Make a request to the Pexels API to search for videos
    const response = await axios.get<{ videos: Video[] }>(
      "https://api.pexels.com/videos/search",
      {
        params: {
          query: `${topic} ${style}`, // Combine topic and style for search query
          per_page: 5, // Limit to 5 video clips
          lang: language || "en", // Set language, default to 'en' if not provided
        },
        headers: {
          Authorization: `Bearer ${pexelsApiKey}`,
        },
      }
    );

    const videoPaths: string[] = [];
    for (const video of response.data.videos) {
      const videoUrl = video.video_files[0].link;
      const videoPath = path.join(
        process.cwd(),
        "public/videos",
        path.basename(videoUrl)
      );
      try {
        const videoResponse = await axios.get(videoUrl, {
          responseType: "stream",
        });
        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);
        await new Promise<void>((resolve, reject) => {
          writer.on("finish", () => resolve());
          writer.on("error", reject);
        });
        videoPaths.push(videoPath);
      } catch (downloadError) {
        if (downloadError instanceof Error) {
          console.error(
            `Error downloading video from ${videoUrl}:`,
            downloadError.message
          );
        } else {
          console.error(
            `Unknown error downloading video from ${videoUrl}:`,
            downloadError
          );
        }
        // Continue to the next video if one fails
      }
    }

    // Return the paths of the successfully downloaded video clips
    return new Response(JSON.stringify({ videoPaths }), { status: 200 });
  } catch (error) {
    console.error("Error fetching videos from Pexels:", error);
    return new Response(
      JSON.stringify({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
