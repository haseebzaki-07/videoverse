// /app/api/generateSpeech/route.js
import axios from 'axios';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    // Extract keywords and duration from the request body
    const { style, topic, duration } = await req.json();

    // Calculate the approximate word count based on speech duration (130-150 words per minute)
    const wordsPerMinute = 140;  // Average words per minute
    const wordCount = wordsPerMinute * duration;  // Total word count for the speech

    // Construct a base prompt based on the keywords and duration
    const basePrompt = `
      Generate a beautiful, eloquent speech that fits a video based on the following parameters:
      - Style: ${style} 
      - Topic: ${topic}
      - Duration: Approximately ${duration} minute(s) of speech

      The speech should be engaging, inspiring, and captivating. It should be appropriate for a video narrative, using clear, poetic language to evoke emotions. The tone should align with the specified style and theme of the video. Please ensure that the speech fits within the estimated word count (around ${wordCount} words), making sure it resonates with viewers while respecting the time limit.
    `;

    // Send the constructed prompt to OpenAI's API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4', // Or gpt-3.5, based on your access
        messages: [
          {
            role: 'system',
            content: 'You are an expert speechwriter specializing in video narratives and storytelling.',
          },
          {
            role: 'user',
            content: basePrompt,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Extract the generated speech from the OpenAI response
    const generatedSpeech = response.data.choices[0].message.content.trim();

    // Return the generated speech in the response
    return NextResponse.json({ speech: generatedSpeech });
  } catch (error) {
    console.error('Error generating speech:', error.message);
    return NextResponse.json(
      { error: 'Error generating speech', details: error.message },
      { status: 500 }
    );
  }
}
