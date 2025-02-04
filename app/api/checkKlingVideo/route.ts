import { NextRequest, NextResponse } from "next/server";
import logger from "@/utils/logger";

interface KlingVideoResponse {
  code: number;
  data: {
    task_id: string;
    model: string;
    task_type: string;
    status: "completed" | "processing" | "pending" | "failed" | "staged";
    config: {
      service_mode: string;
      webhook_config: {
        endpoint: string;
        secret: string;
      };
    };
    input: Record<string, any>;
    output: {
      type: string;
      status: number;
      works: Array<{
        status: number;
        type: string;
        cover: {
          resource: string;
          resource_without_watermark: string;
          height: number;
          width: number;
          duration: number;
        };
        video: {
          resource: string;
          resource_without_watermark: string;
          height: number;
          width: number;
          duration: number;
        };
      }>;
    };
    meta: Record<string, any>;
    detail: any;
    logs: Array<any>;
    error: {
      code: number;
      raw_message: string;
      message: string;
      detail: any;
    };
  };
  message: string;
}

const KLING_API_BASE_URL = "https://api.piapi.ai/api/v1";
const MAX_POLLING_TIME = 180; // 3 minutes (180 seconds)
const POLLING_INTERVAL = 5000; // 5 seconds between checks

async function pollVideoStatus(
  taskId: string,
  klingApiKey: string,
  startTime: number = Date.now()
): Promise<NextResponse> {
  // Check if we've exceeded the maximum polling time
  if (Date.now() - startTime > MAX_POLLING_TIME * 1000) {
    logger.error("Polling timeout exceeded", {
      taskId,
      maxTime: MAX_POLLING_TIME,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Polling timeout exceeded",
        details: `Video generation took longer than ${MAX_POLLING_TIME} seconds`,
      },
      { status: 408 }
    );
  }

  try {
    const response = await fetch(`${KLING_API_BASE_URL}/task/${taskId}`, {
      method: "GET",
      headers: {
        "x-api-key": klingApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data: KlingVideoResponse = await response.json();
    logger.info("Polling status received", {
      taskId,
      status: data.data.status,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
    });

    switch (data.data.status) {
      case "completed":
        const videoWork = data.data.output?.works?.[0]?.video;
        if (!videoWork?.resource) {
          throw new Error("Video completed but no resource URL provided");
        }
        return NextResponse.json({
          success: true,
          status: "completed",
          video: {
            url: videoWork.resource,
            urlWithoutWatermark: videoWork.resource_without_watermark,
            duration: videoWork.duration,
            width: videoWork.width,
            height: videoWork.height,
          },
        });

      case "failed":
        return NextResponse.json(
          {
            success: false,
            status: "failed",
            error: data.data.error.message || "Video generation failed",
            details: data.data.error,
          },
          { status: 500 }
        );

      case "processing":
      case "pending":
        // Wait for the polling interval before next check
        await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
        return pollVideoStatus(taskId, klingApiKey, startTime);

      default:
        throw new Error(`Unknown status: ${data.data.status}`);
    }
  } catch (error) {
    logger.error("Error during polling", {
      error: error instanceof Error ? error.message : "Unknown error",
      taskId,
    });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;
    const klingApiKey = process.env.KLING_API_KEY;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    if (!klingApiKey) {
      logger.error("Kling API key is not configured");
      return NextResponse.json(
        { error: "Kling API key is not configured" },
        { status: 500 }
      );
    }

    logger.info("Starting video status polling", { taskId });
    return pollVideoStatus(taskId, klingApiKey);
  } catch (error) {
    logger.error("Error in video status check", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check video status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method to support status checks via query parameters
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      { error: "Task ID is required as a query parameter" },
      { status: 400 }
    );
  }

  // Forward the request to POST handler
  const response = await POST(
    new NextRequest(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskId }),
    })
  );

  return response;
}
