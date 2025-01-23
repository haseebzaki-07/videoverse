import axios from "axios";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Pexels API Key (from .env.local)
const pexelsApiKey = process.env.PEXELS_API_KEY!;

// Define interfaces for Pexels API response
interface VideoFile {
  link: string;
  quality: string;
}

interface Video {
  video_files: VideoFile[];
}

interface PexelsResponse {
  videos: Video[];
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

    // Ensure the videos directory exists
    const videosDir = path.join(process.cwd(), "public", "videos");
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Clean up existing videos
    const existingFiles = fs.readdirSync(videosDir);
    for (const file of existingFiles) {
      fs.unlinkSync(path.join(videosDir, file));
    }

    // Make a request to the Pexels API to search for videos
    const response = await axios.get<PexelsResponse>(
      "https://api.pexels.com/videos/search",
      {
        params: {
          query: `${topic} ${style}`.trim(),
          per_page: 5,
          lang: language || "en",
        },
        headers: {
          Authorization: pexelsApiKey, // Remove 'Bearer' prefix if it's already included in the key
        },
      }
    );

    console.log("Pexels API Response:", response.data);

    if (!response.data.videos || response.data.videos.length === 0) {
      return new Response(
        JSON.stringify({ message: "No videos found for the given query" }),
        { status: 404 }
      );
    }

    const videoPaths: string[] = [];
    let videoIndex = 1;

    for (const video of response.data.videos) {
      if (!video.video_files || video.video_files.length === 0) continue;

      // Get the first video file (usually the best quality)
      const videoFile = video.video_files[0];
      const tempFileName = `temp_${videoIndex}.mp4`;
      const videoFileName = `video_${videoIndex}.mp4`;
      const tempPath = path.join(videosDir, tempFileName);
      const finalPath = path.join(videosDir, videoFileName);

      try {
        console.log(`Downloading video ${videoIndex} from ${videoFile.link}`);

        const videoResponse = await axios({
          method: "get",
          url: videoFile.link,
          responseType: "stream",
        });

        // Create write stream and pipe the video data
        const writer = fs.createWriteStream(tempPath);
        videoResponse.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on("finish", () => {
            console.log(`Successfully downloaded video ${videoIndex}`);
            resolve();
          });
          writer.on("error", (error) => {
            console.error(`Error writing video ${videoIndex}:`, error);
            reject(error);
          });
        });

        // Remove audio from the video using FFmpeg
        console.log(`Removing audio from video ${videoIndex}`);
        const ffmpegCommand = `ffmpeg -i "${tempPath}" -c:v copy -an "${finalPath}"`;

        try {
          await execAsync(ffmpegCommand);
          console.log(`Successfully removed audio from video ${videoIndex}`);

          // Delete the temporary file
          fs.unlinkSync(tempPath);

          videoPaths.push(`/videos/${videoFileName}`);
          videoIndex++;
        } catch (ffmpegError) {
          console.error(
            `Error removing audio from video ${videoIndex}:`,
            ffmpegError instanceof Error ? ffmpegError.message : ffmpegError
          );
          // If FFmpeg fails, delete both temp and final files
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
          continue;
        }
      } catch (downloadError) {
        console.error(
          `Error downloading video ${videoIndex}:`,
          downloadError instanceof Error ? downloadError.message : downloadError
        );
        // Clean up any partial files
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        continue;
      }
    }

    if (videoPaths.length === 0) {
      return new Response(
        JSON.stringify({ message: "Failed to download any videos" }),
        { status: 500 }
      );
    }

    // Return the paths of the successfully downloaded video clips
    return new Response(
      JSON.stringify({
        message: "Videos downloaded successfully",
        videoPaths,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in generateClips:", error);
    return new Response(
      JSON.stringify({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
