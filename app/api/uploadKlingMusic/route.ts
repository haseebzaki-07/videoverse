import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed audio formats
const ALLOWED_FORMATS = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"];

export async function POST(req: NextRequest) {
  try {
    // Check if the request is multipart form-data
    if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Request must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    // Validate file exists
    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FORMATS.includes(audioFile.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Allowed formats: MP3, WAV, OGG" },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Ensure the klingMusic directory exists
    const musicDir = path.join(process.cwd(), "public", "klingMusic");
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
    }

    // Generate unique filename with timestamp and original extension
    const timestamp = Date.now();
    const fileExtension = audioFile.name.split(".").pop() || "mp3";
    const fileName = `kling_music_${timestamp}.${fileExtension}`;
    const filePath = path.join(musicDir, fileName);

    // Convert File to ArrayBuffer and save
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      fs.writeFileSync(filePath, buffer);
      logger.info("Audio file saved successfully", { filePath });

      // Verify file exists and has size
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        throw new Error("Audio file was not saved properly");
      }

      return NextResponse.json({
        status: "success",
        message: "Audio file uploaded successfully",
        audioPath: `/klingMusic/${fileName}`,
        fileName: fileName,
        size: audioFile.size,
        type: audioFile.type,
      });
    } catch (writeError) {
      logger.error("Error saving audio file", {
        error:
          writeError instanceof Error ? writeError.message : "Unknown error",
        filePath,
      });
      throw new Error("Failed to save audio file");
    }
  } catch (error) {
    logger.error("Error in uploadKlingMusic", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        error: "Failed to upload audio file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Configure the API route to handle larger files
export const config = {
  api: {
    bodyParser: false,
  },
};
