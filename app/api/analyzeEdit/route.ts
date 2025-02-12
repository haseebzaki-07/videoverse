import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import logger from "@/utils/logger";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add type for video filters
type VideoFilter =
  | "enhance"
  | "dramatic"
  | "warm"
  | "cool"
  | "dreamy"
  | "sharp"
  | "sketch"
  | "vignette";

// Update DEFAULT_VALUES with more balanced settings
const DEFAULT_VALUES = {
  duration: 5,
  resolution: "1080x1920",
  fps: 24,
  transitionDuration: 1,
  audio: {
    volume: 0.8, // 0.8 = 80% volume, more balanced than 1.0
    fadeIn: 2, // Reduced from 2 for smoother transition
    fadeOut: 2, // Reduced from 2 for smoother transition
    bass: 2, // Reduced from 5 for clearer audio
    treble: 1, // Reduced from 5 for clearer audio
    normalize: true,
  },
  colorAdjustment: {
    brightness: 0.05, // Subtle brightness increase (range: -1 to 1)
    contrast: 1.1, // Slight contrast enhancement
    saturation: 1.05, // Subtle saturation boost
    gamma: 1.0, // Neutral gamma
    vibrance: 1.1, // Slight vibrance enhancement
  },
  videoFilters: {
    enhance: "eq=contrast=1.5:brightness=0.1:saturation=1.2",
    dramatic: "curves=preset=strong_contrast",
    warm: "colorbalance=rs=.3:gs=-.3:bs=-.3",
    cool: "hue=h=90:s=1",
    dreamy: "gblur=sigma=10",
    sharp: "unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=2",
    sketch: "edgedetect=low=0.1:high=0.3",
    vignette: "vignette,eq=gamma=1.5",
  } as const,
};

interface PromptRequest {
  prompt: string;
}

// Define interface for clip structure
interface Clip {
  fileName?: string;
  duration?: number;
  startTime?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: PromptRequest = await req.json();
    logger.info("Analyzing edit prompt", { prompt: body.prompt });

    if (!body.prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Update the system message for OpenAI
    const systemMessage = `You are a video editing assistant. Analyze the user's prompt and generate a detailed video editing request.
    The request should include appropriate transitions, text overlays, videofilters, color adjustments, effects, speed and audio settings.
    
    You can select one of the following video filters based on the user's prompt or mood:
    - "enhance": Enhances overall video quality with balanced contrast and saturation
    - "dramatic": Creates a strong contrast effect for dramatic scenes
    - "warm": Adds a warm color temperature
    - "cool": Adds a cool color temperature
    - "dreamy": Creates a soft, dream-like effect
    - "sharp": Enhances details and sharpness
    - "sketch": Creates an artistic sketch-like effect
    - "vignette": Adds a vignette effect to the video

    If the user's prompt doesn't specify a particular mood or style, randomly select one that might enhance the video.
    
    Generate a JSON response that matches the VideoEditor API requirements with the following structure:
    {
      "clips": Array<{
        "fileName": string,
        "duration": number,  // Duration in seconds for each clip
        "startTime"?: number // Optional start time for the clip
      }>,
      "audio": {
        "volume": number,
        "fadeIn": number,
        "fadeOut": number,
        "bass": number,
        "treble": number,
        "normalize": boolean
      },
      "output": {
        "format": string,
        "resolution": string,  // Format: "widthxheight" (e.g., "1080x1920" for portrait, "1920x1080" for landscape)
        "fps": number,
        "quality": string
      },
      "effects": {
        "transition": {
          "type": string,
          "duration": number
        },
        "colorAdjustment": {
          "brightness": number,
          "contrast": number,
          "saturation": number,
          "gamma": number,
          "vibrance": number
        },
        "speed": number
      },
      "finalFilter": string
    }`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: body.prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Parse OpenAI response and merge with defaults
    let editRequest;
    try {
      const aiResponse = completion.choices[0].message.content;
      if (!aiResponse) {
        throw new Error("No response from OpenAI");
      }

      // Parse the AI response and merge with defaults
      const parsedResponse = JSON.parse(aiResponse);
      editRequest = mergeWithDefaults(parsedResponse);
      console.log("editRequest", editRequest);
    } catch (parseError) {
      logger.error("Error parsing OpenAI response", { error: parseError });
      editRequest = generateDefaultRequest();
    }

    // Update the logging before making the request to videoEditor
    logger.info("Sending request to video editor API:", {
      requestBody: JSON.stringify({
        clips: editRequest.clips.map((clip) => ({
          fileName: clip.fileName,
          duration: clip.duration,
        })),
        audio: {
          volume: editRequest.audio?.volume || 1,
          fadeIn: editRequest.audio?.fadeIn || 2,
          fadeOut: editRequest.audio?.fadeOut || 2,
          bass: editRequest.audio?.bass || 2,
          treble: editRequest.audio?.treble || 1,
          normalize: editRequest.audio?.normalize || true,
        },
        output: {
          format: editRequest.output.format,
          resolution: editRequest.output.resolution,
          fps: editRequest.output.fps,
          quality: editRequest.output.quality,
        },
        effects: {
          transition: {
            type: editRequest.effects?.transition?.type || "fade",
            duration: editRequest.effects?.transition?.duration || 1,
          },
          colorAdjustment: {
            brightness:
              editRequest.effects?.colorAdjustment?.brightness || 0.05,
            contrast: editRequest.effects?.colorAdjustment?.contrast || 1.1,
            saturation:
              editRequest.effects?.colorAdjustment?.saturation || 1.05,
            gamma: editRequest.effects?.colorAdjustment?.gamma || 1,
            vibrance: editRequest.effects?.colorAdjustment?.vibrance || 1.1,
          },
          speed: editRequest.effects?.speed || 1,
        },
        finalFilter: editRequest.finalFilter,
      }),
    });

    // Forward the request to the video editor API
    const editorResponse = await fetch(
      `/api/videoEditor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editRequest),
      }
    );

    if (!editorResponse.ok) {
      const errorData = await editorResponse.json();
      throw new Error(
        `Video editor API request failed: ${JSON.stringify(errorData)}`
      );
    }

    const result = await editorResponse.json();
    return NextResponse.json({
      status: "success",
      editRequest,
      result,
    });
  } catch (error) {
    logger.error("Error in analyzeEdit", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to analyze and process edit request" },
      { status: 500 }
    );
  }
}

// Update mergeWithDefaults function
function mergeWithDefaults(aiResponse: any) {
  // Handle dynamic clip durations if specified in AI response
  const defaultClips = [
    { fileName: "video_1.mp4", duration: 5 },
    { fileName: "video_2.mp4", duration: 5 },
    { fileName: "video_3.mp4", duration: 5 },
    { fileName: "video_4.mp4", duration: 5 },
    { fileName: "video_5.mp4", duration: 5 },
  ];

  // If AI response includes clips with durations, merge them with defaults
  const clips = aiResponse.clips?.length
    ? aiResponse.clips.map((clip: Clip, index: number) => ({
        fileName: `video_${index + 1}.mp4`,
        duration: clip.duration || defaultClips[index].duration,
        startTime: clip.startTime,
      }))
    : defaultClips;

  // Handle dynamic resolution if specified in AI response
  const resolution = aiResponse.output?.resolution || DEFAULT_VALUES.resolution;

  // Validate resolution format (should be widthxheight)
  const validResolution = /^\d+x\d+$/.test(resolution)
    ? resolution
    : DEFAULT_VALUES.resolution;

  // Ensure audio values are within reasonable ranges
  const audioSettings = {
    volume: clamp(
      aiResponse.audio?.volume || DEFAULT_VALUES.audio.volume,
      0.5,
      1.0
    ),
    fadeIn: clamp(
      aiResponse.audio?.fadeIn || DEFAULT_VALUES.audio.fadeIn,
      0.5,
      2.0
    ),
    fadeOut: clamp(
      aiResponse.audio?.fadeOut || DEFAULT_VALUES.audio.fadeOut,
      0.5,
      2.0
    ),
    bass: clamp(aiResponse.audio?.bass || DEFAULT_VALUES.audio.bass, 1, 3),
    treble: clamp(
      aiResponse.audio?.treble || DEFAULT_VALUES.audio.treble,
      1,
      2
    ),
    normalize: true,
  };

  // Ensure color adjustments are within reasonable ranges
  const colorAdjustment = {
    brightness: clamp(
      aiResponse.effects?.colorAdjustment?.brightness ||
        DEFAULT_VALUES.colorAdjustment.brightness,
      -0.2,
      0.2
    ),
    contrast: clamp(
      aiResponse.effects?.colorAdjustment?.contrast ||
        DEFAULT_VALUES.colorAdjustment.contrast,
      0.9,
      1.2
    ),
    saturation: clamp(
      aiResponse.effects?.colorAdjustment?.saturation ||
        DEFAULT_VALUES.colorAdjustment.saturation,
      0.9,
      1.2
    ),
    gamma: clamp(
      aiResponse.effects?.colorAdjustment?.gamma ||
        DEFAULT_VALUES.colorAdjustment.gamma,
      0.9,
      1.1
    ),
    vibrance: clamp(
      aiResponse.effects?.colorAdjustment?.vibrance ||
        DEFAULT_VALUES.colorAdjustment.vibrance,
      1.0,
      1.2
    ),
  };

  // Select a random filter if none specified
  const filterKeys = Object.keys(DEFAULT_VALUES.videoFilters) as VideoFilter[];
  const getFilterValue = (filterName: string | undefined) => {
    if (!filterName) {
      const randomKey =
        filterKeys[Math.floor(Math.random() * filterKeys.length)];
      return DEFAULT_VALUES.videoFilters[randomKey];
    }
    return (
      DEFAULT_VALUES.videoFilters[filterName as VideoFilter] ||
      DEFAULT_VALUES.videoFilters.enhance
    );
  };

  const finalFilter = getFilterValue(aiResponse.finalFilter);

  return {
    clips,
    audio: audioSettings,
    output: {
      format: "mp4",
      resolution: validResolution,
      fps: aiResponse.output?.fps || DEFAULT_VALUES.fps,
      quality: aiResponse.output?.quality || "high",
    },
    effects: {
      transition: {
        type: aiResponse.effects?.transition?.type || "fade",
        duration: clamp(
          aiResponse.effects?.transition?.duration ||
            DEFAULT_VALUES.transitionDuration,
          0.5,
          2
        ),
      },
      colorAdjustment,
      speed: clamp(aiResponse.effects?.speed || 1, 0.5, 2.0),
    },
    finalFilter,
  };
}

// Helper function to clamp values within a range
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Update generateDefaultRequest function
function generateDefaultRequest() {
  const defaultClips = [
    { fileName: "video_1.mp4", duration: 5 },
    { fileName: "video_2.mp4", duration: 5 },
    { fileName: "video_3.mp4", duration: 5 },
    { fileName: "video_4.mp4", duration: 5 },
    { fileName: "video_5.mp4", duration: 5 },
  ];

  // Select a random default filter and get its value
  const filterKeys = Object.keys(DEFAULT_VALUES.videoFilters) as VideoFilter[];
  const randomKey = filterKeys[Math.floor(Math.random() * filterKeys.length)];
  const randomFilter = DEFAULT_VALUES.videoFilters[randomKey];

  return {
    clips: defaultClips,
    audio: DEFAULT_VALUES.audio,
    output: {
      format: "mp4",
      resolution: DEFAULT_VALUES.resolution,
      fps: DEFAULT_VALUES.fps,
      quality: "high",
    },
    effects: {
      transition: {
        type: "fade",
        duration: DEFAULT_VALUES.transitionDuration,
      },
      colorAdjustment: DEFAULT_VALUES.colorAdjustment,
      speed: 1.0,
    },
    finalFilter: randomFilter,
  };
}
