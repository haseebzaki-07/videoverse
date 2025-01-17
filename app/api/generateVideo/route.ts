import { createVideo } from '@/utils/createVideo';
import { generateImages } from '@/utils/generateImages';
import { NextResponse } from 'next/server';
import path from 'path';
import axios from 'axios';

const FREESOUND_API_KEY = '0W2Oy6PMmYRnIPG96uwoN9SIA9R5sArjZURKZTm2'; // Replace with your actual Freesound API key

export async function POST(req) {
  try {
    const { topic, style, keywords, duration } = await req.json();
    console.log(topic, style, keywords, duration);

    // Step 1: Call the generatePrompt API to get a concise prompt for the music video
    const promptResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/analyzeText`,
      {
        topic,
       
        style,
        
      }
    );

    const prompt = promptResponse.data.prompt;
    console.log('Generated Prompt:', prompt);

    if (!prompt) {
      console.error('Error: No prompt generated');
      throw new Error('No prompt generated');
    }

    // Step 2: Fetch audio URL based on keywords and duration using Freesound API
    const query = keywords.join(' ');
    const FREESOUND_API_ENDPOINT = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&filter=duration:[0 TO ${duration}]&sort=duration_desc&token=${FREESOUND_API_KEY}`;

    const response = await axios.get(FREESOUND_API_ENDPOINT);
    const results = response.data.results;

    if (results.length === 0) {
      return NextResponse.json({ error: 'No matching sounds found' }, { status: 404 });
    }

    // Select the longest sound from the results
    const longestSound = results[0]; // The first result will have the longest duration due to sorting
    const soundId = longestSound.id;

    // Fetch detailed sound information using the sound ID
    const soundDetailsResponse = await axios.get(`https://freesound.org/apiv2/sounds/${soundId}/`, {
      headers: {
        Authorization: `Token ${FREESOUND_API_KEY}`,
      },
    });
    const soundDetails = soundDetailsResponse.data;

    // Extract the audio preview URL
    const audioUrl = soundDetails.previews['preview-hq-mp3']; // or 'preview-lq-mp3'
    console.log("Audio URL:", audioUrl);

    // Step 3: Generate images based on the generated prompt
    const imageUrls = await generateImages(prompt);

    // Step 4: Create a video using the generated images and audio
    const outputVideoPath = path.join(process.cwd(), 'public', 'output_video.mp4');
    const videoUrl = await createVideo(imageUrls, audioUrl, outputVideoPath);

    return NextResponse.json({ videoUrl: `/output_video.mp4` });
  } catch (error) {
    console.error('Error generating video:', error.message);
    return NextResponse.json(
      { error: 'Error generating video', details: error.message },
      { status: 500 }
    );
  }
}
