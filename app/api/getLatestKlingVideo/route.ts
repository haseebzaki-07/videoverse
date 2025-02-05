import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

export async function GET() {
  try {
    const videoDir = path.join(process.cwd(), "public", "klingMusicVideo");

    // Ensure directory exists
    if (!fs.existsSync(videoDir)) {
      logger.info("KlingMusicVideo directory does not exist", { videoDir });
      return NextResponse.json({ error: "No videos found" }, { status: 404 });
    }

    // Get all files and sort by creation time (newest first)
    const files = fs
      .readdirSync(videoDir)
      .filter(
        (file) => file.startsWith("kling_music_video_") && file.endsWith(".mp4")
      )
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(videoDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      logger.info("No videos found in directory", { videoDir });
      return NextResponse.json({ error: "No videos found" }, { status: 404 });
    }

    // Get the latest video
    const latestVideo = files[0];
    const videoPath = `/klingMusicVideo/${latestVideo.name}`;

    logger.info("Found latest video", {
      videoPath,
      createdAt: new Date(latestVideo.time).toISOString(),
    });

    return NextResponse.json({
      success: true,
      videoPath,
      createdAt: latestVideo.time,
    });
  } catch (error) {
    logger.error("Error getting latest video", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: "Failed to get latest video",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
