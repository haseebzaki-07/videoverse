import axios, { AxiosResponse } from "axios";
import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      topic,
      style,
      language,
      duration,
      ssmlGender = "NEUTRAL",
      voiceName,
    } = await req.json();
    console.log("Received data:", {
      topic,
      style,
      language,
      duration,
      ssmlGender,
      voiceName,
    });

    // Step 1: Call the generateClip API to get video clips for the topic, style, and language
    let videoResponse: AxiosResponse<{ videoPaths: string[] }>;
    try {
      videoResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generateClips`,
        {
          topic,
          style,
          language,
        }
      );
      console.log("generateClip API response:", videoResponse.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error calling generateClip API:", error.message);
        console.error("Full error:", error.response?.data || error);
      } else if (error instanceof Error) {
        console.error("Error calling generateClip API:", error.message);
      } else {
        console.error("Unknown error calling generateClip API:", error);
      }
      return NextResponse.json(
        { error: "Failed to generate video clips" },
        { status: 500 }
      );
    }

    const videoPaths = videoResponse.data.videoPaths;
    if (!videoPaths || videoPaths.length === 0) {
      console.error("No video clips generated");
      return NextResponse.json(
        { error: "No video clips generated" },
        { status: 400 }
      );
    }

    // Step 2: Call the analyzeText API to generate a speech based on the topic, style, and duration
    let speechResponse: AxiosResponse<{ speech: string }>;
    try {
      speechResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/analyzeText`,
        {
          style,
          topic,
          duration,
        }
      );
      console.log("analyzeText API response:", speechResponse.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error calling analyzeText API:", error.message);
        console.error("Full error:", error.response?.data || error);
      } else if (error instanceof Error) {
        console.error("Error calling analyzeText API:", error.message);
      } else {
        console.error("Unknown error calling analyzeText API:", error);
      }
      return NextResponse.json(
        { error: "Failed to generate speech text" },
        { status: 500 }
      );
    }

    const generatedSpeech = speechResponse.data.speech;
    if (!generatedSpeech) {
      console.error("Speech generation failed");
      return NextResponse.json(
        { error: "Speech generation failed" },
        { status: 500 }
      );
    }

    // Step 3: Generate speech-to-text (TTS) audio using the generated speech
    let ttsResponse: AxiosResponse<{ audioPath: string }>;
    try {
      ttsResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tts`,
        {
          text: generatedSpeech,
          languageCode: language || "en-US",
          ssmlGender,
          voiceName,
        }
      );
      console.log("generateSpeech API response:", ttsResponse.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error calling generateSpeech API:", error.message);
        console.error("Full error:", error.response?.data || error);
      } else if (error instanceof Error) {
        console.error("Error calling generateSpeech API:", error.message);
      } else {
        console.error("Unknown error calling generateSpeech API:", error);
      }
      return NextResponse.json(
        { error: "Failed to generate speech-to-text audio" },
        { status: 500 }
      );
    }

    const audioPath = ttsResponse.data.audioPath;
    if (!audioPath) {
      console.error("Failed to generate audio");
      return NextResponse.json(
        { error: "Failed to generate audio" },
        { status: 500 }
      );
    }

    // Step 4: Call the createMusicVideo API to combine video clips and audio
    let videoUrlResponse: AxiosResponse<{ output: string }>;
    try {
      videoUrlResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/createMusicVideo`,
        {
          params: {
            videoPaths: videoPaths.join(","), // Send the video paths as a comma-separated string
            audioPath, // Pass the generated audio path
          },
        }
      );
      console.log("createMusicVideo API response:", videoUrlResponse.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error calling createMusicVideo API:", error.message);
        console.error("Full error:", error.response?.data || error);
      } else if (error instanceof Error) {
        console.error("Error calling createMusicVideo API:", error.message);
      } else {
        console.error("Unknown error calling createMusicVideo API:", error);
      }
      return NextResponse.json(
        { error: "Failed to create final video" },
        { status: 500 }
      );
    }

    return NextResponse.json({ videoUrl: videoUrlResponse.data.output });
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        "Unexpected error in video and speech generation:",
        error.message
      );
    } else {
      console.error("Unknown error in video and speech generation:", error);
    }
    return NextResponse.json(
      {
        error: "Unexpected error in video and speech generation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
