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
  trimStart?: number;
  trimEnd?: number;
  effects?: VideoEffect[];
  speed?: number;
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
    zoomPan?: {
      zoomStart?: number;
      zoomEnd?: number;
      xStart?: number;
      xEnd?: number;
      yStart?: number;
      yEnd?: number;
      duration?: number;
    };
  };
  finalFilter?: string;
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

  addFilter(filter: string): void {
    this.filterComplex.push(filter);
  }

  addOutputOption(option: string): void {
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

  private escapeText(text: string): string {
    return text
      .replace(/'/g, "'\\''")
      .replace(/:/g, "\\:")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\\/g, "/");
  }

  private getFontPath(): string {
    return "C:/Windows/Fonts/arial.ttf";
  }

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

    if (/^\d+,\d+$/.test(position)) {
      const [x, y] = position.split(",");
      return `x=${x}:y=${y}`;
    }

    return positions[position] || positions["center,center"];
  }

  buildTextFilter(
    text: {
      content: string;
      position: string;
      fontSize: number;
      color: string;
      startTime?: number;
      duration?: number;
    },
    lastLabel: string,
    nextLabel: string
  ): string {
    const startTime = text.startTime || 0;
    const duration = text.duration || 0;
    const position = this.getTextPosition(text.position);
    const escapedText = this.escapeText(text.content);

    // Build the drawtext filter with proper escaping but keep font path format
    return (
      `[${lastLabel}]drawtext=` +
      `text='${escapedText}':` + // Keep quotes around text
      `fontsize=${text.fontSize}:` +
      `fontcolor=${text.color}:` +
      `${position}:` +
      `fontfile='C:/Windows/Fonts/arial.ttf':` + // Keep original font path format
      `enable='gte(t,${startTime})*lte(t,${startTime + duration})'` + // Use gte/lte instead of between
      `[${nextLabel}];`
    );
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

    // Calculate total video duration from clips
    let totalVideoDuration = 0;
    const clipInfos = await Promise.all(
      body.clips.map(async (clip) => {
        const videoPath = path.join(videosDir, clip.fileName);
        // Get video duration using ffprobe
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
        );
        const sourceDuration = parseFloat(stdout);
        const clipDuration = clip.duration || sourceDuration;
        totalVideoDuration += clipDuration;
        return {
          ...clip,
          sourceDuration,
          actualDuration: clipDuration,
        };
      })
    );

    // Get audio duration
    let audioDuration = 0;
    if (fs.existsSync(audioPath)) {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
      );
      audioDuration = parseFloat(stdout);
    }

    // Determine final video duration (use shorter of video or audio)
    const targetDuration = Math.min(totalVideoDuration, audioDuration);

    // Adjust clip durations proportionally if needed
    const durationScale = targetDuration / totalVideoDuration;
    const adjustedClips = clipInfos.map((clip) => ({
      ...clip,
      actualDuration: clip.actualDuration * durationScale,
    }));

    const builder = new FFmpegCommandBuilder(outputPath);
    const streamIndexes: number[] = [];

    // Add video inputs with trim and speed filters
    let currentTime = 0;
    const clipFilters: string[] = [];

    for (const [index, clip] of adjustedClips.entries()) {
      const videoPath = path.join(videosDir, clip.fileName);
      const streamIndex = builder.addInput(videoPath);
      streamIndexes.push(streamIndex);

      // Create trim and speed filter for each clip
      const speed = clip.speed || 1.0;
      const trimFilter = `[${streamIndex}:v]trim=duration=${clip.actualDuration},setpts=PTS/${speed}[clip${index}];`;
      clipFilters.push(trimFilter);
    }

    // Add audio input
    const hasAudio = fs.existsSync(audioPath);
    let audioStreamIndex = -1;
    if (hasAudio) {
      audioStreamIndex = builder.addInput(audioPath);
    }

    // Build complex filter graph
    let filterGraph = "";

    // 1. First normalize frame rates, scale to target resolution, and trim clips
    for (const [index, clip] of adjustedClips.entries()) {
      filterGraph +=
        `[clip${index}]` +
        // First normalize fps and scale
        `fps=24,` +
        `scale=4000:-1,` + // Scale up for smoother zoom
        `setsar=1` +
        `[scaledclip${index}];`;

      // Apply speed effect
      filterGraph +=
        `[scaledclip${index}]setpts=${1 / (clip.speed || 1)}*PTS` +
        `[speedclip${index}];`;

      // Apply zoompan if specified
      if (body.effects?.zoomPan) {
        const {
          zoomStart = 1.0,
          zoomEnd = 2.0,
          duration = 5,
        } = body.effects.zoomPan;

        // Calculate zoom speed based on start, end, and duration
        const zoomSpeed = ((zoomEnd - zoomStart) / (duration * 24)).toFixed(4);

        filterGraph +=
          `[speedclip${index}]zoompan=` +
          `z='if(eq(on,1),${zoomStart},min(${zoomEnd},pzoom+${zoomSpeed}))':` +
          `x='iw/2-(iw/zoom/2)':` +
          `y='ih/2-(ih/zoom/2)':` +
          `d=1:s=1080x1920:fps=24` +
          `[zoomedclip${index}];`;
      } else {
        filterGraph +=
          `[speedclip${index}]scale=1080:1920:force_original_aspect_ratio=decrease,` +
          `pad=1080:1920:(ow-iw)/2:(oh-ih)/2` +
          `[zoomedclip${index}];`;
      }
    }

    // 2. Add transitions between clips
    if (body.effects?.transition) {
      const transitionDuration = body.effects.transition.duration || 1;

      // Apply fade effects to zoomed clips
      for (let i = 0; i < adjustedClips.length; i++) {
        const clipDuration =
          adjustedClips[i].actualDuration / (adjustedClips[i].speed || 1);

        if (i === 0) {
          // First clip only needs fade out
          filterGraph += `[zoomedclip${i}]fade=t=out:st=${
            clipDuration - transitionDuration
          }:d=${transitionDuration}[fadedclip${i}];`;
        } else if (i === adjustedClips.length - 1) {
          // Last clip only needs fade in
          filterGraph += `[zoomedclip${i}]fade=t=in:st=0:d=${transitionDuration}[fadedclip${i}];`;
        } else {
          // Middle clips need both fade in and fade out
          filterGraph += `[zoomedclip${i}]fade=t=in:st=0:d=${transitionDuration},fade=t=out:st=${
            clipDuration - transitionDuration
          }:d=${transitionDuration}[fadedclip${i}];`;
        }
      }

      // Concatenate all faded clips
      const concatInputs = adjustedClips
        .map((_, i) => `[fadedclip${i}]`)
        .join("");
      filterGraph += `${concatInputs}concat=n=${adjustedClips.length}:v=1:a=0[mainv];`;
    } else {
      // Simple concatenation of zoomed clips without transitions
      const concatInputs = adjustedClips
        .map((_, i) => `[zoomedclip${i}]`)
        .join("");
      filterGraph += `${concatInputs}concat=n=${adjustedClips.length}:v=1:a=0[mainv];`;
    }

    // Remove the old zoompan section and continue with color adjustments
    if (body.effects) {
      // Color adjustments
      if (body.effects.colorAdjustment) {
        const {
          brightness = 0,
          contrast = 1,
          saturation = 1,
        } = body.effects.colorAdjustment;
        filterGraph += `[mainv]eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}[colorv];`;
      } else {
        filterGraph += `[mainv]copy[colorv];`;
      }

      // Text overlays
      if (body.effects.text && body.effects.text.length > 0) {
        let lastLabel = "colorv";
        body.effects.text.forEach((text, index) => {
          const nextLabel =
            index === body.effects.text.length - 1 ? "textv" : `text${index}`;
          if (text) {
            filterGraph += builder.buildTextFilter(text, lastLabel, nextLabel);
            lastLabel = nextLabel;
          }
        });
      } else {
        filterGraph += `[colorv]copy[textv];`;
      }

      // Speed adjustment
      if (body.effects.speed) {
        const pts = 1 / body.effects.speed;
        filterGraph += `[textv]setpts=${pts}*PTS[speedv];`;
      } else {
        filterGraph += `[textv]copy[speedv];`;
      }

      // Final format conversion
      if (body.finalFilter) {
        filterGraph += `[speedv]${body.finalFilter}[filteredv];`;
        filterGraph += `[filteredv]format=yuv420p[finalv];`;
      } else {
        filterGraph += `[speedv]format=yuv420p[finalv];`;
      }
    } else {
      // If no effects, just convert format
      filterGraph += `[mainv]format=yuv420p[finalv]`;
    }

    builder.addFilter(filterGraph);

    // Add output options
    builder.addOutputOption('-map "[finalv]"');

    // Handle audio
    if (hasAudio) {
      if (body.audio) {
        const { volume = 1, fadeIn = 0, fadeOut = 0 } = body.audio;
        builder.addOutputOption(
          `-af "afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${
            targetDuration - fadeOut
          }:d=${fadeOut},volume=${volume}"`
        );
      }
      builder.addOutputOption(`-map ${audioStreamIndex}:a`);
    }

    // Quality and format settings
    builder.addOutputOption("-c:v libx264");
    builder.addOutputOption("-preset medium");
    builder.addOutputOption("-crf 23");
    builder.addOutputOption("-c:a aac");
    builder.addOutputOption("-s 1080x1920"); // Force output resolution
    builder.addOutputOption("-r 24"); // Force constant output frame rate
    builder.addOutputOption(`-t ${targetDuration}`);

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
