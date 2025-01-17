// /app/api/generatePrompt/route.js
import axios from 'axios';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    // Extract keywords from the request body
    const { theme, mood, style, location } = await req.json();

    // Construct a base prompt based on the keywords
    const basePrompt = `
      Generate a concise, visually captivating prompt for a music video based on the following parameters:
      - Theme: ${theme}
      - Mood: ${mood}
      - Style: ${style}
      - Location: ${location}

      The prompt should be short and descriptive, ideally 1 to 2 sentences, focusing on visual elements that fit the music video concept.
      Please ensure the prompt feels creative and suitable for a music video production.`;

    // Send the constructed prompt to OpenAI's API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4', // Or gpt-3.5, based on your access
        messages: [
          {
            role: 'system',
            content: 'You are an expert music video concept artist.',
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

    // Extract the generated prompt from the OpenAI response
    const generatedPrompt = response.data.choices[0].message.content.trim();

    // Return the generated prompt in the response
    return NextResponse.json({ prompt: generatedPrompt });
  } catch (error) {
    console.error('Error generating prompt:', error.message);
    return NextResponse.json(
      { error: 'Error generating prompt', details: error.message },
      { status: 500 }
    );
  }
}
