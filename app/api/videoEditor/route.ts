import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import logger from "@/utils/logger";

const execAsync = promisify(exec);

// Types for the request body
interface VideoEffect {
  type: string;
  options: Record<string, any>;
}

interface VideoClip {
  fileName: string;
  startTime?: number;
  duration?: number;
  effects?: VideoEffect[];
}

interface EditRequest {
  clips: VideoClip[];
  audio?: {
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
  };
  output: {
    format: string;
    resolution?: string;
    fps?: number;
    quality?: string;
  };
  effects?: {
    transition?: {
      type: string;
      duration: number;
    };
    text?: {
      content: string;
      position: string;
      fontSize: number;
      color: string;
      startTime?: number;
      duration?: number;
    }[];
    overlay?: {
      image: string;
      position: string;
      size: string;
      opacity?: number;
    };
    colorAdjustment?: {
      brightness?: number;
      contrast?: number;
      saturation?: number;
    };
    speed?: number;
    stabilize?: boolean;
  };
}

class FFmpegCommandBuilder {
  private inputFiles: string[] = [];
  private filterComplex: string[] = [];
  private outputOptions: string[] = [];
  private currentStreamIndex = 0;

  constructor(private readonly outputPath: string) {}

  addInput(filePath: string): number {
    this.inputFiles.push(`-i "${filePath}"`);
    return this.currentStreamIndex++;
  }

  addFilter(filter: string) {
    this.filterComplex.push(filter);
  }

  addOutputOption(option: string) {
    this.outputOptions.push(option);
  }

  private buildFilterComplex(): string {
    return this.filterComplex.length > 0
      ? `-filter_complex "${this.filterComplex.join(";")}"`
      : "";
  }

  build(): string {
    return `ffmpeg -y ${this.inputFiles.join(
      " "
    )} ${this.buildFilterComplex()} ${this.outputOptions.join(" ")} "${
      this.outputPath
    }"`;
  }

  // Add new helper method for text positioning
  private getTextPosition(
    position: string,
    width: number = 1080,
    height: number = 1920
  ): string {
    const positions: { [key: string]: string } = {
      "center,center": `x=(w-text_w)/2:y=(h-text_h)/2`,
      "center,top": `x=(w-text_w)/2:y=10`,
      "center,bottom": `x=(w-text_w)/2:y=h-text_h-10`,
      "left,center": `x=10:y=(h-text_h)/2`,
      "right,center": `x=w-text_w-10:y=(h-text_h)/2`,
      "center,top+150": `x=(w-text_w)/2:y=150`,
      "center,bottom-100": `x=(w-text_w)/2:y=h-text_h-100`,
    };

    // If position contains explicit coordinates (e.g., "10,10")
    if (/^\d+,\d+$/.test(position)) {
      const [x, y] = position.split(",");
      return `x=${x}:y=${y}`;
    }

    return positions[position] || positions["center,center"];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: EditRequest = await req.json();
    logger.info("Starting video edit process", { body });

    const outputDir = path.join(process.cwd(), "public", "output");
    const outputPath = path.join(outputDir, "edited_video.mp4");
    const videosDir = path.join(process.cwd(), "public", "videos");
    const audioPath = path.join(
      process.cwd(),
      "public",
      "generated_speech.mp3"
    );

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Validate input files exist
    for (const clip of body.clips) {
      const videoPath = path.join(videosDir, clip.fileName);
      if (!fs.existsSync(videoPath)) {
        return NextResponse.json(
          { error: `Video file not found: ${clip.fileName}` },
          { status: 400 }
        );
      }
    }

    const builder = new FFmpegCommandBuilder(outputPath);
    const streamIndexes: number[] = [];

    // Add video inputs
    for (const clip of body.clips) {
      const videoPath = path.join(videosDir, clip.fileName);
      const streamIndex = builder.addInput(videoPath);
      streamIndexes.push(streamIndex);
    }

    // Add audio input if exists
    const hasAudio = fs.existsSync(audioPath);
    if (hasAudio) {
      builder.addInput(audioPath);
    }

    // Build complex filter graph
    let filterGraph = "";

    // 1. Handle video concatenation
    if (body.clips.length === 1) {
      filterGraph += `[0:v]copy[outv];`;
    } else if (body.clips.length > 1) {
      const concatParts = streamIndexes.map((i) => `[${i}:v]`).join("");
      filterGraph += `${concatParts}concat=n=${body.clips.length}:v=1:a=0[outv];`;
    }

    // 2. Apply effects in sequence
    if (body.effects) {
      // Color adjustments
      if (body.effects.colorAdjustment) {
        const {
          brightness = 0,
          contrast = 1,
          saturation = 1,
        } = body.effects.colorAdjustment;
        filterGraph += `[outv]eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}[outv];`;
      }

      // Text overlays with proper positioning
      if (body.effects.text) {
        body.effects.text.forEach((text, index) => {
          const position = builder.getTextPosition(text.position);
          const fontPath = "C\\:/Windows/Fonts/arial.ttf"; // Escape Windows path properly

          filterGraph +=
            `[outv]drawtext=text='${text.content}':` +
            `fontsize=${text.fontSize}:` +
            `fontcolor=${text.color}:` +
            `${position}:` +
            `fontfile='${fontPath}'` +
            (text.startTime !== undefined
              ? `:enable='between(t,${text.startTime},${
                  text.startTime + (text.duration || 0)
                })'`
              : "") +
            `[outv];`;
        });
      }

      // Image overlay
      if (body.effects.overlay) {
        const overlayPath = path.join(
          process.cwd(),
          "public",
          body.effects.overlay.image
        );
        if (fs.existsSync(overlayPath)) {
          const overlayIndex = builder.addInput(overlayPath);
          const position = body.effects.overlay.position.replace(",", ":");
          filterGraph +=
            `[outv][${overlayIndex}:v]overlay=${position}` +
            (body.effects.overlay.opacity
              ? `:alpha=${body.effects.overlay.opacity}`
              : "") +
            `[outv];`;
        }
      }

      // Speed adjustment
      if (body.effects.speed) {
        const pts = 1 / body.effects.speed;
        filterGraph += `[outv]setpts=${pts}*PTS[outv];`;
      }

      // Transitions
      if (body.effects.transition && body.clips.length > 1) {
        const duration = body.effects.transition.duration || 1;
        switch (body.effects.transition.type) {
          case "fade":
            filterGraph += `[outv]fade=t=in:st=0:d=${duration},fade=t=out:st=${
              body.clips.length * 5 - duration
            }:d=${duration}[outv];`;
            break;
          case "crossfade":
            // Add crossfade logic here
            break;
        }
      }
    }

    // Final format conversion
    filterGraph += `[outv]format=yuv420p[finalv]`;
    builder.addFilter(filterGraph);

    // Add output options
    builder.addOutputOption('-map "[finalv]"');
    if (hasAudio) {
      const audioStreamIndex = body.clips.length;
      builder.addOutputOption(`-map ${audioStreamIndex}:a`);
    }

    // Quality and format settings
    builder.addOutputOption("-c:v libx264");
    builder.addOutputOption("-preset medium");
    builder.addOutputOption("-crf 23");
    builder.addOutputOption("-c:a aac");
    if (body.output.resolution) {
      builder.addOutputOption(`-s ${body.output.resolution}`);
    }
    if (body.output.fps) {
      builder.addOutputOption(`-r ${body.output.fps}`);
    }

    const ffmpegCommand = builder.build();
    logger.debug("Generated FFmpeg command", { command: ffmpegCommand });

    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      if (stderr) {
        logger.warn("FFmpeg stderr output", { stderr });
      }

      // Verify the output file exists and has size
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error("Output file was not generated properly");
      }

      logger.info("Video editing completed successfully");

      return NextResponse.json({
        status: "success",
        message: "Video edited successfully",
        url: "/output/edited_video.mp4",
      });
    } catch (ffmpegError) {
      logger.error("FFmpeg execution error", {
        error:
          ffmpegError instanceof Error ? ffmpegError.message : "Unknown error",
        command: ffmpegCommand,
      });
      throw ffmpegError;
    }
  } catch (error) {
    logger.error("Error in video editing", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to process video edit" },
      { status: 500 }
    );
  }
}
