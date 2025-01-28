import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import logger from "@/utils/logger";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Update DEFAULT_VALUES with more balanced settings
const DEFAULT_VALUES = {
  duration: 5,
  resolution: "1080x1920",
  fps: 24,
  transitionDuration: 1,
  fontSize: {
    title: 42, // Reduced from 48 for better readability
    subtitle: 36, // Reduced from 42
    caption: 32, // Reduced from 36
  },
  textColors: {
    primary: "#FFFFFF",
    secondary: "#FFD700",
    accent: "#00FF00",
  },
  audio: {
    volume: 0.8, // 0.8 = 80% volume, more balanced than 1.0
    fadeIn: 1.5, // Reduced from 2 for smoother transition
    fadeOut: 1.5, // Reduced from 2 for smoother transition
    bass: 2, // Reduced from 5 for clearer audio
    treble: 1, // Reduced from 5 for clearer audio
  },
  colorAdjustment: {
    brightness: 0.05, // Subtle brightness increase (range: -1 to 1)
    contrast: 1.1, // Slight contrast enhancement
    saturation: 1.05, // Subtle saturation boost
    gamma: 1.0, // Neutral gamma
    vibrance: 1.1, // Slight vibrance enhancement
  },
  filters: {
    vignette: {
      angle: 45,
      strength: 0.3, // Reduced strength for subtler effect
    },
  },
};

interface PromptRequest {
  prompt: string;
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

    // Prepare the system message for OpenAI
    const systemMessage = `You are a video editing assistant. Analyze the user's prompt and generate a detailed video editing request.
    The request should include appropriate transitions, text overlays, effects, and audio settings.
    Generate a JSON response that matches the VideoEditor API requirements with the following structure:
    {
      "clips": Array<{
        "fileName": string,
        "duration": number
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
        "resolution": string,
        "fps": number,
        "quality": string
      },
      "effects": {
        "transition": {
          "type": string,
          "duration": number
        },
        "text": Array<{
          "content": string,
          "position": string,
          "fontSize": number,
          "color": string,
          "startTime": number,
          "duration": number,
          "bold"?: boolean,
          "italic"?: boolean,
          "boxColor"?: string,
          "boxOpacity"?: number
        }>,
        "colorAdjustment": {
          "brightness": number,
          "contrast": number,
          "saturation": number,
          "gamma": number,
          "vibrance": number
        },
        "filters": Array<{
          "type": string,
          "options": object
        }>,
        "speed": number
      }
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
    } catch (parseError) {
      logger.error("Error parsing OpenAI response", { error: parseError });
      editRequest = generateDefaultRequest();
    }

    // Forward the request to the video editor API
    const editorResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/videoEditor`,
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
  // Add default clips configuration
  const defaultClips = [
    { fileName: "video_1.mp4", duration: 5 },
    { fileName: "video_2.mp4", duration: 5 },
    { fileName: "video_3.mp4", duration: 5 },
    { fileName: "video_4.mp4", duration: 5 },
    { fileName: "video_5.mp4", duration: 5 },
  ];

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

  // Process text overlays with reasonable font sizes
  const textOverlays = (aiResponse.effects?.text || []).map((text: any) => ({
    ...text,
    fontSize: clamp(text.fontSize || DEFAULT_VALUES.fontSize.title, 24, 48),
    color: text.color || DEFAULT_VALUES.textColors.primary,
    boxOpacity: text.boxOpacity || 0.5,
  }));

  return {
    clips: defaultClips,
    audio: audioSettings,
    output: {
      format: "mp4",
      resolution: DEFAULT_VALUES.resolution,
      fps: DEFAULT_VALUES.fps,
      quality: "high",
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
      text: textOverlays,
      colorAdjustment,
      filters: [
        {
          type: "vignette",
          options: {
            angle: DEFAULT_VALUES.filters.vignette.angle,
            strength: DEFAULT_VALUES.filters.vignette.strength,
          },
        },
      ],
      speed: clamp(aiResponse.effects?.speed || 1.0, 0.8, 1.2),
    },
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
      text: [
        {
          content: "VideoVerse",
          position: "center,center",
          fontSize: DEFAULT_VALUES.fontSize.title,
          color: DEFAULT_VALUES.textColors.primary,
          startTime: 0,
          duration: 3,
          bold: true,
          boxColor: "#000000",
          boxOpacity: 0.5,
        },
      ],
      colorAdjustment: DEFAULT_VALUES.colorAdjustment,
      filters: [
        {
          type: "vignette",
          options: {
            angle: DEFAULT_VALUES.filters.vignette.angle,
            strength: DEFAULT_VALUES.filters.vignette.strength,
          },
        },
      ],
      speed: 1.0,
    },
  };
}
