import axios from "axios";
import path from "path";
import fs from "fs";
import { NextResponse, NextRequest } from "next/server";
import logger from "@/utils/logger";
import { GoogleAuth } from "google-auth-library";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

// Add error checking for environment variables
const checkRequiredEnvVars = () => {
  const required = [
    "GOOGLE_TTS_PROJECT_ID",
    "GOOGLE_TTS_PRIVATE_KEY",
    "GOOGLE_TTS_CLIENT_EMAIL",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

// Initialize Google Auth client
const auth = new GoogleAuth({
  projectId: process.env.GOOGLE_TTS_PROJECT_ID,
  credentials: {
    private_key: process.env.GOOGLE_TTS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_TTS_CLIENT_EMAIL,
  },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export async function POST(req: NextRequest) {
  try {
    checkRequiredEnvVars();

    const { text, languageCode, ssmlGender, voiceName } = await req.json();

    logger.info("Received TTS request", {
      textLength: text.length,
      languageCode,
      ssmlGender,
      voiceName,
    });

    // Define the fixed output path
    const outputPath = path.join(
      process.cwd(),
      "public",
      "generated_speech.mp3"
    );

    // Get access token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      throw new Error("Failed to get access token");
    }

    // Call Google Cloud TTS API
    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize`,
      {
        input: { text },
        voice: {
          languageCode: languageCode || "en-US",
          ssmlGender: ssmlGender || "NEUTRAL",
          name: voiceName || "en-US-Wavenet-D",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.data.audioContent) {
      throw new Error("No audio content received from Google TTS API");
    }

    // Save audio file
    const audioContent = Buffer.from(response.data.audioContent, "base64");
    fs.writeFileSync(outputPath, audioContent);

    logger.info("TTS generation successful", { outputPath });

    return NextResponse.json({
      audioPath: "/generated_speech.mp3",
      duration: audioContent.length / 32000, // Approximate duration in seconds
    });
  } catch (error) {
    logger.error("Error in TTS generation", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}

// Initialize Text-to-Speech client
const client = new TextToSpeechClient({
  projectId: process.env.GOOGLE_TTS_PROJECT_ID,
  credentials: {
    private_key: process.env.GOOGLE_TTS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_TTS_CLIENT_EMAIL,
  },
});

export async function GET() {
  try {
    if (!client) {
      return NextResponse.json(
        { message: "Text-to-Speech service not properly configured" },
        { status: 500 }
      );
    }

    const [result] = await client.listVoices({});
    return NextResponse.json({ voices: result.voices });
  } catch (error) {
    console.error("Error fetching voices:", error);
    return NextResponse.json(
      {
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
