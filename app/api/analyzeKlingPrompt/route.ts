import { NextRequest, NextResponse } from "next/server";
import logger from "@/utils/logger";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PromptAnalysisResult {
  mainMood: string;
  keywords: string[];
  musicStyle: string;
  tempo: string;
  description: string;
}

async function analyzePromptWithGPT4(
  prompt: string
): Promise<PromptAnalysisResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OpenAI API key is missing");
      throw new Error(
        "OpenAI API key is not configured in environment variables"
      );
    }

    logger.info("Starting GPT-4 analysis with configuration", {
      apiKeyExists: !!process.env.OPENAI_API_KEY,
      promptLength: prompt.length,
    });

    const systemPrompt = `You are a music expert AI that analyzes text prompts and extracts relevant musical characteristics. 
    Analyze the given prompt and respond ONLY with a JSON object in the following format, nothing else:
    {
      "mainMood": "the primary mood or emotion",
      "keywords": ["3-5 relevant keywords for music search"],
      "musicStyle": "suggested music style",
      "tempo": "slow/medium/fast",
      "description": "brief description of ideal background music"
    }`;

    logger.info("Sending prompt to GPT-4 for analysis", {
      prompt,
      systemPromptLength: systemPrompt.length,
    });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      logger.info("Received response from GPT-4", {
        responseStatus: "success",
        hasChoices: completion.choices.length > 0,
        firstChoiceExists: !!completion.choices[0],
        messageContent: !!completion.choices[0]?.message?.content,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("Empty response from GPT-4");
      }

      try {
        // Clean the response string to ensure it only contains the JSON object
        const cleanedResponse = response
          .trim()
          .replace(/```json\n?|\n?```/g, "");
        const analysis = JSON.parse(cleanedResponse) as PromptAnalysisResult;

        // Validate the required fields
        if (
          !analysis.mainMood ||
          !analysis.keywords ||
          !analysis.musicStyle ||
          !analysis.tempo ||
          !analysis.description
        ) {
          throw new Error("Missing required fields in GPT-4 response");
        }

        logger.info("Successfully parsed GPT-4 response", { analysis });
        return analysis;
      } catch (parseError) {
        logger.error("Failed to parse GPT-4 response", {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Unknown parse error",
          response,
          cleanedResponse: response.trim().replace(/```json\n?|\n?```/g, ""),
        });
        throw new Error("Failed to parse GPT-4 response: " + response);
      }
    } catch (openaiError) {
      logger.error("OpenAI API call failed", {
        error:
          openaiError instanceof Error
            ? openaiError.message
            : "Unknown OpenAI error",
        name: openaiError instanceof Error ? openaiError.name : "Unknown",
        stack: openaiError instanceof Error ? openaiError.stack : undefined,
      });
      throw new Error(
        "OpenAI API call failed: " +
          (openaiError instanceof Error ? openaiError.message : "Unknown error")
      );
    }
  } catch (error) {
    logger.error("Error in GPT-4 analysis", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      prompt,
    });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt. Please provide a text prompt." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    logger.info("Starting prompt analysis", { prompt });

    // Analyze the prompt using GPT-4
    const analysis = await analyzePromptWithGPT4(prompt);

    // Prepare keywords for music search
    const searchKeywords = [
      analysis.mainMood,
      analysis.musicStyle,
      ...analysis.keywords,
    ].filter(
      (keyword, index, self) =>
        // Remove duplicates and empty strings
        keyword && self.indexOf(keyword) === index
    );

    logger.info("Fetching music based on GPT-4 analysis", {
      searchKeywords,
      analysis,
    });

    // Function to attempt music fetch with retries
    async function fetchMusicWithRetry(
      attempt = 1,
      maxAttempts = 3
    ): Promise<any> {
      try {
        const musicResponse = await fetch(
          `${request.nextUrl.origin}/api/getFreesoundMusic`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              keywords: searchKeywords,
              type: "music",
              sort: "rating_desc",
              duration: {
                min: 10, // Ensure minimum duration of 10 seconds
                max: 120, // Increased max duration for better results
              },
            }),
          }
        );

        if (!musicResponse.ok) {
          const errorData = await musicResponse.json();
          throw new Error(
            "Failed to fetch music: " + JSON.stringify(errorData)
          );
        }

        const musicData = await musicResponse.json();

        // Validate the sound duration
        if (
          !musicData.data?.sound?.duration ||
          musicData.data.sound.duration < 10
        ) {
          logger.warn("Retrieved sound is too short or invalid duration", {
            duration: musicData.data?.sound?.duration,
            attempt,
          });

          if (attempt < maxAttempts) {
            logger.info("Retrying with modified keywords", {
              attempt: attempt + 1,
              previousKeywords: searchKeywords,
            });

            // Modify keywords for next attempt by removing the last keyword
            searchKeywords.pop();
            return fetchMusicWithRetry(attempt + 1, maxAttempts);
          }

          throw new Error(
            "Could not find a sound with sufficient duration after multiple attempts"
          );
        }

        return musicData;
      } catch (error) {
        if (attempt < maxAttempts) {
          logger.warn("Fetch attempt failed, retrying", {
            attempt,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return fetchMusicWithRetry(attempt + 1, maxAttempts);
        }
        throw error;
      }
    }

    // Fetch music with retry mechanism
    const musicData = await fetchMusicWithRetry();

    logger.info("Successfully processed prompt and fetched music", {
      prompt,
      analysis,
      musicData: {
        soundId: musicData.data.sound.id,
        soundName: musicData.data.sound.name,
        duration: musicData.data.sound.duration,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        analysis: {
          ...analysis,
          searchKeywords,
        },
        music: musicData.data,
      },
    });
  } catch (error) {
    logger.error("Error in analyzeKlingPrompt", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze prompt and fetch music",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
