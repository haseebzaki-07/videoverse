import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "@/utils/logger";

const execAsync = promisify(exec);

interface MusicVideoRequest {
  videoId?: string;
  audioId?: string;
}

async function getLatestFile(
  directory: string,
  prefix: string
): Promise<string | null> {
  try {
    const files = fs
      .readdirSync(directory)
      .filter((file) => file.startsWith(prefix))
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(directory, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    return files.length > 0 ? files[0].name : null;
  } catch (error) {
    logger.error("Error getting latest file", {
      directory,
      prefix,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

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

export async function POST(req: NextRequest) {
  try {
    const body: MusicVideoRequest = await req.json();

    // Get the directories
    const videoDir = path.join(process.cwd(), "public", "klingVideo");
    const audioDir = path.join(process.cwd(), "public", "klingMusic");
    const outputDir = path.join(process.cwd(), "public", "klingMusicVideo");

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get the latest or specified files
    let videoFile: string | null;
    let audioFile: string | null;

    if (body.videoId) {
      videoFile =
        fs.readdirSync(videoDir).find((file) => file.includes(body.videoId!)) ||
        null;
    } else {
      videoFile = await getLatestFile(videoDir, "kling_video_");
    }

    if (body.audioId) {
      audioFile =
        fs.readdirSync(audioDir).find((file) => file.includes(body.audioId!)) ||
        null;
    } else {
      audioFile = await getLatestFile(audioDir, "kling_music_");
    }

    if (!videoFile || !audioFile) {
      return NextResponse.json(
        { error: "Video or audio file not found" },
        { status: 404 }
      );
    }

    const videoPath = path.join(videoDir, videoFile);
    const audioPath = path.join(audioDir, audioFile);

    // Verify files exist
    if (!fs.existsSync(videoPath) || !fs.existsSync(audioPath)) {
      return NextResponse.json(
        { error: "Video or audio file does not exist" },
        { status: 404 }
      );
    }

    // Get durations
    const videoDuration = await getMediaDuration(videoPath);
    const audioDuration = await getMediaDuration(audioPath);

    // Use the shorter duration
    const targetDuration = Math.min(videoDuration, audioDuration);

    // Generate output filename
    const timestamp = Date.now();
    const outputFileName = `kling_music_video_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    // Construct FFmpeg command
    const ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${audioPath}" -t ${targetDuration} -map 0:v -map 1:a -c:v copy -c:a aac -shortest "${outputPath}"`;

    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      if (stderr) {
        logger.warn("FFmpeg stderr output", { stderr });
      }

      // Verify the output file exists and has size
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error("Output file was not generated properly");
      }

      logger.info("Music video generated successfully", {
        outputPath,
        videoDuration,
        audioDuration,
        targetDuration,
      });

      return NextResponse.json({
        status: "success",
        message: "Music video generated successfully",
        videoPath: `/klingMusicVideo/${outputFileName}`,
        duration: targetDuration,
        originalVideo: videoFile,
        originalAudio: audioFile,
      });
    } catch (ffmpegError) {
      logger.error("FFmpeg execution error", {
        error:
          ffmpegError instanceof Error ? ffmpegError.message : "Unknown error",
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
