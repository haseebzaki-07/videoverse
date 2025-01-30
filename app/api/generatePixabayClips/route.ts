import axios from "axios";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "@/utils/logger";
import { NextResponse } from "next/server";

const execAsync = promisify(exec);

// Pixabay API Key (from .env)
const pixabayApiKey = process.env.PIXABAY_API_KEY!;

// Define interfaces for Pixabay API response
interface PixabayVideo {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  duration: number;
  videos: {
    large: {
      url: string;
      width: number;
      height: number;
      size: number;
    };
    medium: {
      url: string;
      width: number;
      height: number;
      size: number;
    };
    small: {
      url: string;
      width: number;
      height: number;
      size: number;
    };
    tiny: {
      url: string;
      width: number;
      height: number;
      size: number;
    };
  };
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    logger.info("Starting Pixabay clip generation", { query });

    const videoPaths: string[] = [];
    const TOTAL_CLIPS = 5;
    const MAX_DURATION = 20; // Maximum duration in seconds

    // Basic validation
    if (!query) {
      return NextResponse.json(
        { message: "Search query is required" },
        { status: 400 }
      );
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

    // Make a request to the Pixabay API to search for videos
    const response = await axios.get<PixabayResponse>(
      `https://pixabay.com/api/videos/`,
      {
        params: {
          key: pixabayApiKey,
          q: query,
          per_page: TOTAL_CLIPS * 3, // Request more videos to account for filtering
          safesearch: true,
          orientation: "vertical", // Get portrait videos
          min_width: 720, // Minimum width for decent quality
          min_height: 1280, // Minimum height for portrait videos
        },
      }
    );

    logger.debug("Pixabay API Response received", {
      videosCount: response.data.hits?.length || 0,
    });

    if (!response.data.hits || response.data.hits.length === 0) {
      return NextResponse.json(
        { message: "No videos found for the given query" },
        { status: 404 }
      );
    }

    // Filter for portrait videos with duration less than MAX_DURATION seconds
    const filteredVideos = response.data.hits.filter(
      (video) =>
        video.videos.large.height > video.videos.large.width &&
        video.duration <= MAX_DURATION
    );

    logger.debug("Filtered videos", {
      totalVideos: response.data.hits.length,
      filteredVideos: filteredVideos.length,
      maxDuration: MAX_DURATION,
    });

    // Process each video sequentially
    for (let i = 0; i < Math.min(TOTAL_CLIPS, filteredVideos.length); i++) {
      const videoFileName = `video_${i + 1}.mp4`;
      const tempPath = path.join(videosDir, `temp_${videoFileName}`);
      const finalPath = path.join(videosDir, videoFileName);

      logger.debug("Processing video clip", {
        index: i + 1,
        tempPath,
        finalPath,
        duration: filteredVideos[i].duration,
      });

      try {
        const video = filteredVideos[i];

        // Get the best quality video that fits our requirements
        const videoUrl = video.videos.large.url;

        logger.debug(`Downloading video ${i + 1}`, {
          url: videoUrl,
          dimensions: `${video.videos.large.width}x${video.videos.large.height}`,
          duration: video.duration,
        });

        const videoResponse = await axios({
          method: "get",
          url: videoUrl,
          responseType: "stream",
        });

        const writer = fs.createWriteStream(tempPath);
        videoResponse.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        // Remove audio and ensure portrait orientation
        // Also scale to 1080x1920 while maintaining aspect ratio
        const ffmpegCommand = `ffmpeg -i "${tempPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset medium -crf 23 -an "${finalPath}"`;

        try {
          await execAsync(ffmpegCommand);
          fs.unlinkSync(tempPath); // Clean up temp file

          logger.info("Successfully processed video clip", {
            index: i + 1,
            path: `/videos/${videoFileName}`,
          });

          videoPaths.push(`/videos/${videoFileName}`);
        } catch (ffmpegError) {
          logger.error("FFmpeg processing error", {
            index: i + 1,
            error:
              ffmpegError instanceof Error
                ? ffmpegError.message
                : "Unknown error",
          });
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
          continue;
        }
      } catch (downloadError) {
        logger.error("Video download error", {
          index: i + 1,
          error:
            downloadError instanceof Error
              ? downloadError.message
              : "Unknown error",
        });
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        continue;
      }
    }

    logger.info("Completed Pixabay clip generation", {
      totalClips: videoPaths.length,
      paths: videoPaths,
    });

    return NextResponse.json({ videoPaths });
  } catch (error) {
    logger.error("Error in generatePixabayClips", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to generate clips from Pixabay" },
      { status: 500 }
    );
  }
}
