import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

// Kling AI API configuration
const KLING_API_KEY = process.env.KLING_API_KEY!;
const KLING_API_BASE_URL = "https://api.piapi.ai/api/v1";

interface KlingVideoRequest {
  prompt: string;
  negative_prompt?: string;
  duration?: 5 | 10;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  mode?: "std" | "pro";
  version?: "1.0" | "1.5" | "1.6";
}

interface KlingAPIResponse {
  code: number;
  data: {
    task_id: string;
    status: string;
    output?: {
      works?: Array<{
        video?: {
          resource: string;
          resource_without_watermark?: string;
        };
      }>;
    };
  };
  message: string;
}

async function downloadVideo(url: string, filePath: string): Promise<void> {
  try {
    const response = await axios({
      method: "get",
      url,
      responseType: "arraybuffer", // Changed to arraybuffer for better handling
      timeout: 30000, // 30 seconds timeout
    });

    fs.writeFileSync(filePath, response.data);
    logger.info("Video file saved successfully", { filePath });
  } catch (error) {
    logger.error("Error downloading video", {
      error: error instanceof Error ? error.message : "Unknown error",
      url,
      filePath,
    });
    throw new Error("Failed to download video");
  }
}

async function pollForCompletion(taskId: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes maximum wait time
  const pollInterval = 5000; // 5 seconds between checks

  while (attempts < maxAttempts) {
    try {
      const taskResponse = await axios.get<KlingAPIResponse>(
        `${KLING_API_BASE_URL}/task/${taskId}`,
        {
          headers: {
            "x-api-key": KLING_API_KEY,
          },
        }
      );

      const status = taskResponse.data.data.status.toLowerCase();
      logger.debug("Task status check", {
        taskId,
        status,
        attempt: attempts + 1,
      });

      if (status === "completed") {
        const videoResource = taskResponse.data.data.output?.works?.[0]?.video;
        if (videoResource) {
          const videoUrl =
            videoResource.resource_without_watermark || videoResource.resource;
          if (videoUrl) {
            return videoUrl;
          }
          throw new Error("No video URL found in completed task");
        }
        throw new Error("No video resource found in completed task");
      } else if (status === "failed") {
        throw new Error("Task failed");
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      logger.error("Error checking task status", {
        error: error instanceof Error ? error.message : "Unknown error",
        taskId,
        attempt: attempts + 1,
      });
      throw error;
    }
  }

  throw new Error("Video generation timed out");
}

export async function POST(req: NextRequest) {
  try {
    const body: KlingVideoRequest = await req.json();
    logger.info("Starting Kling video generation", { prompt: body.prompt });

    // Basic validation
    if (!body.prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Ensure the klingVideo directory exists
    const videoDir = path.join(process.cwd(), "public", "klingVideo");
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    // Create task request
    const createTaskResponse = await axios.post<KlingAPIResponse>(
      `${KLING_API_BASE_URL}/task`,
      {
        model: "kling",
        task_type: "video_generation",
        input: {
          prompt: body.prompt,
          negative_prompt: body.negative_prompt || "",
          cfg_scale: 0.5,
          duration: body.duration || 5,
          aspect_ratio: body.aspect_ratio || "9:16",
          mode: body.mode || "std",
          version: body.version || "1.6",
        },
      },
      {
        headers: {
          "x-api-key": KLING_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (
      createTaskResponse.data.code !== 200 ||
      !createTaskResponse.data.data.task_id
    ) {
      throw new Error("Failed to create Kling task");
    }

    const taskId = createTaskResponse.data.data.task_id;
    logger.info("Kling task created", { taskId });

    // Poll for completion and get video URL
    const videoUrl = await pollForCompletion(taskId);
    logger.info("Video URL received", { videoUrl });

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const videoFileName = `kling_video_${timestamp}.mp4`;
    const videoPath = path.join(videoDir, videoFileName);

    // Download and save the video with retries
    let downloadAttempts = 0;
    const maxDownloadAttempts = 3;

    while (downloadAttempts < maxDownloadAttempts) {
      try {
        await downloadVideo(videoUrl, videoPath);
        break;
      } catch (downloadError) {
        downloadAttempts++;
        if (downloadAttempts === maxDownloadAttempts) {
          throw new Error("Failed to download video after multiple attempts");
        }
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Verify file exists and has size
    if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
      throw new Error("Video file was not saved properly");
    }

    return NextResponse.json({
      status: "success",
      message: "Video generated and saved successfully",
      videoPath: `/klingVideo/${videoFileName}`,
      taskId,
    });
  } catch (error) {
    logger.error("Error in generateKlingVideo", {
      error: error instanceof Error ? error.message : "Unknown error",
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
