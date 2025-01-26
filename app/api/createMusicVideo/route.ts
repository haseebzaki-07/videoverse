import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { statSync, existsSync, readFileSync } from "fs";
import path from "path";

import logger from "@/utils/logger";

const execAsync = promisify(exec);

// Helper function to check if video is ready
const checkVideoReady = async (filePath: string): Promise<boolean> => {
  try {
    logger.info("Checking if video file is ready", { filePath });

    // Check if the file exists and is accessible
    const stats = statSync(filePath);
    logger.debug("File stats retrieved", {
      filePath,
      size: stats.size,
      lastModified: stats.mtime,
    });

    if (stats.size === 0) {
      logger.warn("File size is 0. File may not be ready.", { filePath });
      return false;
    }

    // Check if the file is still being written to
    const initialSize = stats.size;
    logger.debug("Initial file size recorded", { filePath, initialSize });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalSize = statSync(filePath).size;
    logger.debug("Final file size recorded after delay", {
      filePath,
      finalSize,
    });

    const isReady = initialSize === finalSize;

    if (isReady) {
      logger.info("File is ready for further processing", { filePath });
    } else {
      logger.warn("File size changed, indicating it is still being written", {
        filePath,
        initialSize,
        finalSize,
      });
    }

    return isReady;
  } catch (error) {
    logger.error("Error checking if video file is ready", {
      filePath,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
};

export async function GET() {
  try {
    const fileListPath = path.join(
      process.cwd(),
      "public",
      "output",
      "file-list.txt"
    );
    const audioPath = path.join(
      process.cwd(),
      "public",
      "generated_speech.mp3"
    );
    const outputPath = path.join(
      process.cwd(),
      "public",
      "output",
      "final_video.mp4"
    );

    // Log initial state and file existence
    logger.info("Starting final video creation", {
      fileListPath,
      fileListExists: existsSync(fileListPath),
      audioPath,
      audioExists: existsSync(audioPath),
      outputPath,
    });

    // Check if required files exist
    if (!existsSync(fileListPath)) {
      throw new Error("File list not found");
    }
    if (!existsSync(audioPath)) {
      throw new Error("Audio file not found");
    }

    // Log file contents for debugging
    const fileListContent = readFileSync(fileListPath, "utf-8");
    logger.debug("File list contents", { content: fileListContent });

    // Get audio duration for logging
    try {
      const audioStats = statSync(audioPath);
      const { stdout: audioDuration } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
      );
      const duration = parseFloat(audioDuration);
      logger.info("Audio file details", {
        duration,
        exists: existsSync(audioPath),
        size: audioStats.size,
      });
    } catch (error) {
      logger.error("Error getting audio duration", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Execute ffmpeg command with detailed logging
    const ffmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -i "${audioPath}" -c:v libx264 -c:a aac -strict experimental -shortest "${outputPath}"`;

    logger.debug("Executing FFmpeg command", { command: ffmpegCommand });

    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);

      // Log any FFmpeg output
      if (stderr) {
        logger.warn("FFmpeg stderr output", { stderr });
      }
      if (stdout) {
        logger.debug("FFmpeg stdout output", { stdout });
      }

      // Wait for video to be fully generated
      let attempts = 0;
      const maxAttempts = 10;
      let videoReady = false;

      while (attempts < maxAttempts && !videoReady) {
        videoReady = await checkVideoReady(outputPath);
        if (!videoReady) {
          logger.info(
            `Waiting for video to be ready... Attempt ${
              attempts + 1
            }/${maxAttempts}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
          attempts++;
        }
      }

      if (!videoReady) {
        throw new Error("Video generation timed out");
      }

      const outputStats = statSync(outputPath);
      logger.info("Successfully created final video", {
        outputSize: outputStats.size,
        outputExists: existsSync(outputPath),
        outputModified: outputStats.mtime,
      });

      // Check output video duration
      const { stdout: videoDuration } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`
      );
      logger.info("Output video details", {
        duration: parseFloat(videoDuration),
        path: outputPath,
      });

      return NextResponse.json({
        message: "Video generated successfully",
        videoUrl: "/output/final_video.mp4",
      });
    } catch (ffmpegError) {
      logger.error("FFmpeg execution failed", {
        error:
          ffmpegError instanceof Error ? ffmpegError.message : "Unknown error",
        command: ffmpegCommand,
      });
      throw ffmpegError;
    }
  } catch (error) {
    const typedError = error as Error;
    logger.error("Error in final video creation", {
      error: {
        message: typedError.message,
        stack: typedError.stack,
        name: typedError.name,
      },
    });
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 }
    );
  }
}
