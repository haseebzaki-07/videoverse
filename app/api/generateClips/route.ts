import axios from "axios";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "@/utils/logger";
import { NextResponse } from "next/server";

const execAsync = promisify(exec);

// Pexels API Key (from .env.local)
const pexelsApiKey = process.env.PEXELS_API_KEY!;

// Define interfaces for Pexels API response
interface PexelsVideoFile {
  link: string;
  quality: string;
  width: number;
  height: number;
}

interface PexelsVideo {
  video_files: PexelsVideoFile[];
  width: number;
  height: number;
}

interface PexelsResponse {
  videos: PexelsVideo[];
}

export async function POST(req: NextRequest) {
  try {
    const { style, topic } = await req.json();
    logger.info("Starting clip generation", { style, topic });

    const videoPaths: string[] = [];
    const TOTAL_CLIPS = 5;

    // Basic validation
    if (!topic) {
      return NextResponse.json(
        { message: "Topic is required" },
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

    // Make a request to the Pexels API to search for videos
    // Request more videos than needed to account for filtering
    const response = await axios.get<PexelsResponse>(
      `https://api.pexels.com/videos/search`,
      {
        headers: { Authorization: pexelsApiKey },
        params: {
          query: `${topic} ${style}`.trim(),
          per_page: TOTAL_CLIPS * 3, // Request more videos to filter
          orientation: "portrait", // Request only portrait videos
        },
      }
    );

    logger.debug("Pexels API Response received", {
      videosCount: response.data.videos?.length || 0,
    });

    if (!response.data.videos || response.data.videos.length === 0) {
      return NextResponse.json(
        { message: "No videos found for the given query" },
        { status: 404 }
      );
    }

    // Filter for portrait videos (height > width)
    const portraitVideos = response.data.videos.filter(
      (video) => video.height > video.width
    );

    logger.debug("Filtered portrait videos", {
      totalVideos: response.data.videos.length,
      portraitVideos: portraitVideos.length,
    });

    // Process each video sequentially
    for (let i = 0; i < Math.min(TOTAL_CLIPS, portraitVideos.length); i++) {
      const videoFileName = `video_${i + 1}.mp4`;
      const tempPath = path.join(videosDir, `temp_${videoFileName}`);
      const finalPath = path.join(videosDir, videoFileName);

      logger.debug("Processing video clip", {
        index: i + 1,
        tempPath,
        finalPath,
      });

      try {
        const video = portraitVideos[i];
        if (!video.video_files || video.video_files.length === 0) {
          logger.warn(`No video files found for index ${i + 1}, skipping`);
          continue;
        }

        // Find the best quality portrait video file
        const portraitFile =
          video.video_files.find(
            (file) => file.height > file.width && file.quality === "hd"
          ) || video.video_files[0];

        logger.debug(`Downloading video ${i + 1}`, {
          url: portraitFile.link,
          dimensions: `${portraitFile.width}x${portraitFile.height}`,
        });

        const videoResponse = await axios({
          method: "get",
          url: portraitFile.link,
          responseType: "stream",
        });

        const writer = fs.createWriteStream(tempPath);
        videoResponse.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        // Remove audio and ensure portrait orientation
        const ffmpegCommand = `ffmpeg -i "${tempPath}" -c:v copy -an "${finalPath}"`;

        try {
          await execAsync(ffmpegCommand);
          fs.unlinkSync(tempPath);

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

    logger.info("Completed clip generation", {
      totalClips: videoPaths.length,
      paths: videoPaths,
    });

    return NextResponse.json({ videoPaths });
  } catch (error) {
    logger.error("Error in generateClips", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to generate clips" },
      { status: 500 }
    );
  }
}
