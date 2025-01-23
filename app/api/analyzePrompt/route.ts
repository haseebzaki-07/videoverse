import axios from "axios";
import { NextResponse } from "next/server";

// Helper function to extract parameters from the prompt
async function extractParameters(prompt) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that extracts video parameters from a user prompt.",
          },
          {
            role: "user",
            content: `Extract the following details from this prompt: "${prompt}".
              - Topic
              - Style
              - Language (default to en-US if not mentioned)
              - Duration in minutes (default to 1 minutes if not mentioned)
              - SSML Gender (default to NEUTRAL if not mentioned)
              - Voice Name (default to en-US-Wavenet-D if not mentioned)
              Return ONLY a valid JSON object with these keys: topic, style, language, duration, ssmlGender, and voiceName. Do not include any explanation or text outside of the JSON object.`,
          },
        ],
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      }
    );

    // Parse and return the JSON response
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error("Error extracting parameters with GPT:", error.message);
    // Return default values if GPT API fails
    return {
      topic: "Default Topic",
      style: "Cinematic",
      language: "en-US",
      duration: 1, // Set to 2 instead of 1 for consistency with defaults
      ssmlGender: "NEUTRAL",
      voiceName: "en-US-Wavenet-D",
    };
  }
}
// The main API handler
export async function POST(req) {
  try {
    // Parse the request body
    const { prompt } = await req.json();
    console.log("User prompt received:", prompt);

    // Step 1: Extract parameters from the prompt
    const { topic, style, language, duration, ssmlGender, voiceName } =
      await extractParameters(prompt);
    console.log("Extracted parameters:", {
      topic,
      style,
      language,
      duration,
      ssmlGender,
      voiceName,
    });

    // Step 2: Call the existing video generation API
    let videoResponse;
    try {
      videoResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generateVideo`,
        {
          topic,
          style,
          language,
          duration,
          ssmlGender,
          voiceName,
        }
      );
      console.log("Video generation API response:", videoResponse.data);
    } catch (error) {
      console.error("Error calling video generation API:", error.message);
      console.error("Full error:", error.response?.data || error);
      return NextResponse.json(
        { error: "Failed to generate video" },
        { status: 500 }
      );
    }

    // Return the final video URL
    const { videoUrl } = videoResponse.data;
    if (!videoUrl) {
      return NextResponse.json(
        { error: "Video generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ videoUrl });
  } catch (error) {
    console.error("Unexpected error in processing prompt:", error.message);
    return NextResponse.json(
      {
        error: "Unexpected error in processing prompt",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
