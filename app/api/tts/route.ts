import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";

// Create a client instance dynamically using environment variables
const client = new TextToSpeechClient({
  credentials: {
    private_key: process.env.GOOGLE_TTS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_TTS_CLIENT_EMAIL,
  },
  projectId: process.env.GOOGLE_TTS_PROJECT_ID,
});

export async function POST(req) {
  try {
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

    // Construct the request with optional voiceName
    const request = {
      input: { text },
      voice: { languageCode, ssmlGender, name: voiceName },
      audioConfig: { audioEncoding: "MP3" },
    };

    // Perform the Text-to-Speech request
    const [response] = await client.synthesizeSpeech(request);

    // Path to the 'public' directory in Next.js
    const outputPath = path.join(
      process.cwd(),
      "public",
      "generated_speech.mp3"
    );

    // Write the audio content to the public directory
    fs.writeFileSync(outputPath, response.audioContent);

    // Return the path to the generated audio file
    return NextResponse.json({
      message: "Audio generated successfully",
      audioPath: "/generated_speech.mp3", // URL to the generated file in the public folder
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Fetch available voices from Google TTS
    const [result] = await client.listVoices();
    const voices = result.voices;

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("Error fetching voices:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error },
      { status: 500 }
    );
  }
}
