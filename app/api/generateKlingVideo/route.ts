import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

// Kling AI API configuration
const KLING_API_KEY = process.env.KLING_API_KEY!;
const KLING_API_BASE_URL = "https://api.piapi.ai/api/v1";

// Constants for video generation
const DEFAULT_DURATION = 5;
const MAX_DURATION = 10;
const MIN_DURATION = 5;
const MAX_POLLING_ATTEMPTS = 300; // 25 minutes with 5-second intervals
const POLLING_INTERVAL = 5000; // 5 seconds

interface KlingVideoRequest {
  prompt: string;
  negative_prompt?: string;
  duration?: number;
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
      responseType: "arraybuffer",
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

  while (attempts < MAX_POLLING_ATTEMPTS) {
    try {
      logger.info("Polling attempt", {
        attempt: attempts + 1,
        maxAttempts: MAX_POLLING_ATTEMPTS,
        timeElapsed: `${(attempts * POLLING_INTERVAL) / 1000} seconds`,
      });

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
            logger.info("Video generation completed", {
              taskId,
              attempts: attempts + 1,
              totalTime: `${(attempts * POLLING_INTERVAL) / 1000} seconds`,
            });
            return videoUrl;
          }
          throw new Error("No video URL found in completed task");
        }
        throw new Error("No video resource found in completed task");
      } else if (status === "failed") {
        throw new Error("Task failed");
      }

      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
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

  throw new Error(
    `Video generation timed out after ${
      (MAX_POLLING_ATTEMPTS * POLLING_INTERVAL) / 1000
    } seconds`
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { prompt, duration = DEFAULT_DURATION, aspect_ratio = "9:16" } = body;

    // Validate and normalize duration
    duration = Number(duration) || DEFAULT_DURATION;
    duration = Math.max(MIN_DURATION, Math.min(duration, MAX_DURATION));

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    logger.info("Starting video generation", {
      prompt,
      duration,
      aspect_ratio,
    });

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
          prompt,
          negative_prompt: "blurry, low quality, distorted",
          cfg_scale: 0.5,
          duration,
          aspect_ratio,
          mode: "std",
          version: "1.6",
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
    const fileName = `kling_video_${timestamp}.mp4`;
    const filePath = path.join(videoDir, fileName);

    // Download the video
    await downloadVideo(videoUrl, filePath);

    return NextResponse.json({
      success: true,
      videoPath: `/klingVideo/${fileName}`,
      taskId,
    });
  } catch (error) {
    logger.error("Error in video generation", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate video",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
