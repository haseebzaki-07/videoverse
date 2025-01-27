import axios from "axios";
import { NextResponse, NextRequest } from "next/server";

// Helper function to extract parameters from the prompt
async function extractParameters(prompt: string) {
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
    if (error instanceof Error) {
      console.error("Error extracting parameters with GPT:", error.message);
    } else {
      console.error("Unknown error extracting parameters with GPT:", error);
    }
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
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { prompt } = await req.json();
    console.log("User prompt received:", prompt);

    // Extract parameters from the prompt
    const parameters = await extractParameters(prompt);
    console.log("Extracted parameters:", parameters);

    // Return the extracted parameters directly
    return NextResponse.json({
      topic: parameters.topic || "General",
      style: parameters.style || "Cinematic",
      language: parameters.language || "en-US",
      duration: parameters.duration || 1,
      ssmlGender: parameters.ssmlGender || "NEUTRAL",
      voiceName: parameters.voiceName || "en-US-Wavenet-D",
    });
  } catch (error) {
    console.error("Error in analyzePrompt:", error);
    return NextResponse.json(
      { error: "Failed to analyze prompt" },
      { status: 500 }
    );
  }
}