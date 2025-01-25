import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import logger from "@/utils/logger";

const execAsync = promisify(exec);
const accessAsync = promisify(fs.access);
const unlinkAsync = promisify(fs.unlink);

const srtPath = path.join(process.cwd(), "public", "output", "captions.srt");

// Helper function to check if video is ready
async function checkVideoReady(outputPath: string): Promise<boolean> {
  try {
    // Check if file exists and is not empty
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) return false;

    // Check if file is still being written
    const initialSize = stats.size;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    const currentSize = fs.statSync(outputPath).size;

    // If size is still changing, file is still being written
    if (initialSize !== currentSize) return false;

    // Verify video file integrity
    const { stderr } = await execAsync(`ffprobe -v error "${outputPath}"`);

    return !stderr; // If no error, video is valid
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const fileListPath = path.join(
      process.cwd(),
      "public/output/file-list.txt"
    );
    const audioPath = path.join(process.cwd(), "public/generated_speech.mp3");
    const outputPath = path.join(
      process.cwd(),
      "public/output/final_video.mp4"
    );

    // Log initial state and file existence
    logger.info("Starting final video creation", {
      fileListPath,
      fileListExists: fs.existsSync(fileListPath),
      audioPath,
      audioExists: fs.existsSync(audioPath),
      outputPath,
    });

    // Check if required files exist
    if (!fs.existsSync(fileListPath)) {
      throw new Error("File list not found");
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error("Audio file not found");
    }

    // Log file contents for debugging
    const fileListContent = fs.readFileSync(fileListPath, "utf-8");
    logger.debug("File list contents", { content: fileListContent });

    // Get audio duration for logging
    try {
      const { stdout: audioDuration } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
      );
      const duration = parseFloat(audioDuration);
      logger.info("Audio file details", {
        duration,
        exists: fs.existsSync(audioPath),
        size: fs.statSync(audioPath).size,
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

      const outputStats = fs.statSync(outputPath);
      logger.info("Successfully created final video", {
        outputSize: outputStats.size,
        outputExists: fs.existsSync(outputPath),
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
    // Log detailed error information
    logger.error("Error in final video creation", {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : "Unknown error",
      filesExist: {
        fileList: fs.existsSync(
          path.join(process.cwd(), "public/output/file-list.txt")
        ),
        audio: fs.existsSync(
          path.join(process.cwd(), "public/generated_speech.mp3")
        ),
        output: fs.existsSync(
          path.join(process.cwd(), "public/output/final_video.mp4")
        ),
      },
    });

    return NextResponse.json(
      {
        error: "Failed to generate video",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
