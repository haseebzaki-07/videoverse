import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import path from "path";
import fs from "fs";
import { NextResponse, NextRequest } from "next/server";

// Add error checking for environment variables
const checkRequiredEnvVars = () => {
  const required = [
    "GOOGLE_TTS_PRIVATE_KEY",
    "GOOGLE_TTS_CLIENT_EMAIL",
    "GOOGLE_TTS_PROJECT_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

// Create a client instance with error handling
const createTTSClient = () => {
  try {
    checkRequiredEnvVars();

    return new TextToSpeechClient({
      credentials: {
        private_key:
          process.env.GOOGLE_TTS_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
        client_email: process.env.GOOGLE_TTS_CLIENT_EMAIL || "",
      },
      projectId: process.env.GOOGLE_TTS_PROJECT_ID || "",
    });
  } catch (error) {
    console.error("Failed to create TTS client:", error);
    return null;
  }
};

const client = createTTSClient();

export async function POST(req: NextRequest) {
  try {
    // Check if client was created successfully
    if (!client) {
      return NextResponse.json(
        { message: "Text-to-Speech service not properly configured" },
        { status: 500 }
      );
    }

    const {
      text,
      languageCode = "en-US",
      ssmlGender = "NEUTRAL",
      voiceName,
    } = await req.json();

    if (!text) {
      return NextResponse.json(
        { message: "Text is required" },
        { status: 400 }
      );
    }

    // Ensure the output directory exists
    const outputDir = path.join(process.cwd(), "public");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Construct the request
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
      {
        input: { text },
        voice: {
          languageCode,
          ssmlGender:
            ssmlGender as protos.google.cloud.texttospeech.v1.SsmlVoiceGender,
          name: voiceName,
        },
        audioConfig: { audioEncoding: "MP3" },
      };

    // Synthesize speech
    const [response] = await client.synthesizeSpeech(request);
    const outputFile = path.join(outputDir, "generated_speech.mp3");

    // Write the audio content to file
    fs.writeFileSync(outputFile, response.audioContent as Buffer);

    return NextResponse.json({
      message: "Audio generated successfully",
      audioPath: "/generated_speech.mp3",
    });
  } catch (error) {
    console.error("Error in TTS:", error);
    return NextResponse.json(
      {
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (!client) {
      return NextResponse.json(
        { message: "Text-to-Speech service not properly configured" },
        { status: 500 }
      );
    }

    const [result] = await client.listVoices();
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
