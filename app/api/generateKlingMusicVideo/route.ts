import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "@/utils/logger";

const execAsync = promisify(exec);

async function getMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return parseFloat(stdout.trim());
  } catch (error) {
    logger.error("Error getting media duration", {
      filePath,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to get media duration");
  }
}

async function verifyAudioFile(audioPath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams a -show_streams "${audioPath}"`
    );
    return stdout.length > 0;
  } catch (error) {
    logger.error("Error verifying audio file", {
      audioPath,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Define the directories
    const videoDir = path.join(process.cwd(), "public", "klingVideo");
    const audioDir = path.join(process.cwd(), "public", "freesound");
    const outputDir = path.join(process.cwd(), "public", "klingMusicVideo");

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Clear existing files in the output directory
    const existingFiles = fs.readdirSync(outputDir);
    for (const file of existingFiles) {
      fs.unlinkSync(path.join(outputDir, file));
    }
    logger.info("Cleared existing files from klingMusicVideo directory");

    // Get the video file path (fixed name)
    const videoPath = path.join(videoDir, "kling_video.mp4");

    // Get the audio file (only MP3 file in freesound directory)
    const audioFiles = fs.readdirSync(audioDir).filter(file => file.endsWith('.mp3'));
    if (audioFiles.length !== 1) {
      throw new Error("Expected exactly one MP3 file in freesound directory");
    }
    const audioPath = path.join(audioDir, audioFiles[0]);

    // Verify files exist and audio file contains audio stream
    if (!fs.existsSync(videoPath) || !fs.existsSync(audioPath)) {
      logger.error("File paths do not exist", {
        videoPath,
        audioPath,
        videoExists: fs.existsSync(videoPath),
        audioExists: fs.existsSync(audioPath),
      });
      return NextResponse.json(
        {
          error: "Video or audio file does not exist",
          details: {
            videoPath,
            audioPath,
            videoExists: fs.existsSync(videoPath),
            audioExists: fs.existsSync(audioPath),
          },
        },
        { status: 404 }
      );
    }

    // Verify audio file has audio stream
    const hasAudio = await verifyAudioFile(audioPath);
    if (!hasAudio) {
      logger.error("Audio file does not contain audio stream", { audioPath });
      return NextResponse.json(
        {
          error: "Invalid audio file",
          details: "The audio file does not contain an audio stream",
        },
        { status: 400 }
      );
    }

    // Get durations
    const videoDuration = await getMediaDuration(videoPath);
    const audioDuration = await getMediaDuration(audioPath);

    logger.info("Media durations", {
      videoDuration,
      audioDuration,
    });

    // Use fixed output filename
    const outputPath = path.join(outputDir, "kling_music_video.mp4");

    // Construct FFmpeg command with improved audio handling
    const ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${audioPath}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -y "${outputPath}"`;

    try {
      logger.info("Executing FFmpeg command", { ffmpegCommand });
      const { stdout, stderr } = await execAsync(ffmpegCommand);

      if (stderr) {
        logger.warn("FFmpeg stderr output", { stderr });
      }

      // Verify the output file exists and has size
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error("Output file was not generated properly");
      }

      // Verify the output video has audio
      const hasOutputAudio = await verifyAudioFile(outputPath);
      if (!hasOutputAudio) {
        throw new Error("Generated video file does not contain audio");
      }

      const finalDuration = await getMediaDuration(outputPath);

      logger.info("Music video generated successfully", {
        outputPath,
        finalDuration,
        videoFile: "kling_video.mp4",
        audioFile: audioFiles[0],
        outputSize: fs.statSync(outputPath).size,
      });

      return NextResponse.json({
        success: true,
        videoPath: `/klingMusicVideo/kling_music_video.mp4`,
        duration: finalDuration,
        originalVideo: "kling_video.mp4",
        originalAudio: audioFiles[0],
      });
    } catch (ffmpegError) {
      logger.error("FFmpeg execution error", {
        error: ffmpegError instanceof Error ? ffmpegError.message : "Unknown error",
        command: ffmpegCommand,
      });
      throw new Error("Failed to generate music video");
    }
  } catch (error) {
    logger.error("Error in generateKlingMusicVideo", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: "Failed to generate music video",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
