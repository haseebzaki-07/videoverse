// /app/api/generateSpeech/route.js
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import logger from "@/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const { topic, style, language, duration, ssmlGender, voiceName } =
      await req.json();
    logger.info("Received parameters for analysis", {
      style,
      topic,
      duration,
      language,
      ssmlGender,
      voiceName,
    });

    // Calculate the approximate word count
    const wordCount = 140 * duration;
    logger.debug("Calculated target word count", { wordCount });

    // Construct a base prompt based on the keywords and duration
    const basePrompt = `
      Generate 3 distinct variations of a beautiful, eloquent speech that fits a video based on the following parameters:
      - Style: ${style} 
      - Topic: ${topic}
      - Duration: Approximately ${duration} minute(s) of speech
      - Language: ${language}

      Each speech should be engaging, inspiring, and captivating, but with different approaches or angles. They should be appropriate for a video narrative, using clear, poetic language to evoke emotions. The tone should align with the specified style and theme of the video. Please ensure that each speech fits within the estimated word count (around ${wordCount} words), making sure it resonates with viewers while respecting the time limit.

      Format your response as:
      SPEECH_1:
      [First speech content]

      SPEECH_2:
      [Second speech content]

      SPEECH_3:
      [Third speech content]
    `;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert speechwriter specializing in video narratives and storytelling.",
          },
          {
            role: "user",
            content: basePrompt,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    logger.info("Received response from OpenAI API");

    const rawContent = response.data.choices[0].message.content.trim();
    const speeches = rawContent
      .split(/SPEECH_[123]:/g)
      .filter((speech: string) => speech.trim())
      .map((speech: string) => speech.trim());

    logger.info("Successfully parsed speeches", {
      speechCount: speeches.length,
      speechLengths: speeches.map((s: string) => s.length),
      averageLength:
        speeches.reduce((acc: number, s: string) => acc + s.length, 0) /
        speeches.length,
    });

    // Generate SRT file for the first speech
    const srtPath = path.join(
      process.cwd(),
      "public",
      "output",
      "captions.srt"
    );
    logger.debug("Generating SRT file", { path: srtPath });
    generateSRT(speeches[0], duration, srtPath);

    return NextResponse.json({
      speeches,
      parameters: {
        topic,
        style,
        language,
        duration,
        ssmlGender,
        voiceName,
        wordCount,
      },
    });
  } catch (error) {
    logger.error("Error in analyzeText", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to analyze text" },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  try {
    // Ensure seconds is a valid number and not negative
    if (isNaN(seconds) || seconds < 0) {
      seconds = 0;
    }

    // Convert to milliseconds and ensure it's within valid range
    const milliseconds = Math.min(Math.floor(seconds * 1000), 86399999); // Max 23:59:59,999

    const date = new Date(milliseconds);
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const secs = String(date.getUTCSeconds()).padStart(2, "0");
    const ms = String(date.getUTCMilliseconds()).padStart(3, "0");

    return `${hours}:${minutes}:${secs},${ms}`;
  } catch (error) {
    console.error("Error formatting time:", error);
    return "00:00:00,000"; // Return default time in case of error
  }
}

function generateSRT(text: string, duration: number, outputPath: string) {
  try {
    // const wordsPerMinute = 150; // Remove if not used
    const words = text.split(" ");
    const totalWords = words.length;

    // Convert duration to seconds if it's in minutes
    const totalDuration = (duration || 1) * 60; // Default to 1 minute if duration is invalid
    const secondsPerWord = totalDuration / totalWords;

    let currentTime = 0;
    let srtContent = "";
    let index = 1;

    for (let i = 0; i < words.length; i += 10) {
      const segment = words.slice(i, i + 10).join(" ");
      const startTime = currentTime;
      const endTime = Math.min(
        currentTime + secondsPerWord * 10,
        totalDuration
      );

      srtContent += `${index}\n`;
      srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      srtContent += `${segment}\n\n`;

      currentTime = endTime;
      index++;
    }

    fs.writeFileSync(outputPath, srtContent);
  } catch (error) {
    console.error("Error generating SRT:", error);
    // Write a default SRT file in case of error
    const defaultSRT =
      "1\n00:00:00,000 --> 00:00:05,000\nError generating captions.\n\n";
    fs.writeFileSync(outputPath, defaultSRT);
  }
}
