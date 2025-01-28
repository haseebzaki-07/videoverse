import { NextRequest, NextResponse } from "next/server";
import { Shotstack, EditApi, Configuration } from "@shotstack/sdk";
import logger from "@/utils/logger";
import path from "path";
import fs from "fs";
import axios from "axios";

// Initialize the client
const client = new Shotstack({
  apiKey: process.env.SHOTSTACK_API_KEY as string,
  host: process.env.SHOTSTACK_HOST || "api.shotstack.io", // or 'api.shotstack.io/stage' for testing
});

// Initialize the Edit API
const editApi = new EditApi(client);

interface EditRequest {
  clips: Array<{
    src: string;
    startTime: number;
    duration: number;
    effects?: Array<{
      type: string;
      options?: any;
    }>;
  }>;
  audioSrc?: string;
  output: {
    format: string;
    resolution: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: EditRequest = await req.json();
    logger.info("Starting Shotstack video edit", { body });

    // Validate request
    if (!body.clips || body.clips.length === 0) {
      return NextResponse.json(
        { error: "At least one clip is required" },
        { status: 400 }
      );
    }

    // Create timeline
    const timeline = {
      soundtrack: body.audioSrc
        ? {
            src: body.audioSrc,
            effect: "fadeInFadeOut",
          }
        : undefined,
      tracks: [
        {
          clips: body.clips.map((clip) => ({
            asset: {
              type: "video",
              src: clip.src,
            },
            start: clip.startTime,
            length: clip.duration,
            effect: clip.effects?.map((effect) => ({
              type: effect.type,
              ...effect.options,
            })),
          })),
        },
      ],
    };

    // Create edit
    const edit = {
      timeline,
      output: {
        format: body.output.format || "mp4",
        resolution: body.output.resolution || "1080p",
        aspectRatio: "9:16",
      },
    };

    logger.debug("Submitting edit to Shotstack", { edit });

    // Submit edit to Shotstack
    const response = await editApi.postRender(edit);

    if (!response.success) {
      throw new Error("Failed to submit edit to Shotstack");
    }

    logger.info("Edit submitted successfully", {
      id: response.response.id,
      message: response.response.message,
    });

    // Poll for render completion
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;
    let renderStatus;

    while (attempts < maxAttempts) {
      const status = await editApi.getRender(response.response.id);
      renderStatus = status.response.status;

      logger.debug("Checking render status", {
        attempt: attempts + 1,
        status: renderStatus,
      });

      if (renderStatus === "done") {
        const outputUrl = status.response.url;
        const outputPath = path.join(
          process.cwd(),
          "public",
          "output",
          "shotstack_video.mp4"
        );

        // Download the rendered video
        const videoResponse = await axios({
          method: "get",
          url: outputUrl,
          responseType: "stream",
        });

        const writer = fs.createWriteStream(outputPath);
        videoResponse.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        logger.info("Video downloaded successfully", { outputPath });

        return NextResponse.json({
          status: "success",
          message: "Video edited and downloaded successfully",
          url: "/output/shotstack_video.mp4",
        });
      }

      if (renderStatus === "failed") {
        throw new Error("Render failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }

    throw new Error("Render timed out");
  } catch (error) {
    logger.error("Error in Shotstack edit", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to process video edit" },
      { status: 500 }
    );
  }
}

// Get render status endpoint
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const renderId = searchParams.get("renderId");

    if (!renderId) {
      return NextResponse.json(
        { error: "Render ID is required" },
        { status: 400 }
      );
    }

    const status = await editApi.getRender(renderId);

    return NextResponse.json({
      status: status.response.status,
      url: status.response.url,
    });
  } catch (error) {
    logger.error("Error getting render status", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to get render status" },
      { status: 500 }
    );
  }
}
