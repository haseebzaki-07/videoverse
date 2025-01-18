import { NextResponse } from 'next/server';
import axios from 'axios';

const FREESOUND_API_KEY = process.env.FREESOUND_API; // Replace with your actual Freesound API key
export async function POST(req: Request) {
  try {
    const { keywords, duration } = await req.json();

    // Construct query string from keywords
    const query = keywords.join(' ');

    // Freesound API endpoint with sorting by duration in descending order
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
        Authorization: `Token ${FREESOUND_API_KEY}`
      }
    });
    const soundDetails = soundDetailsResponse.data;

    // Extract the audio preview URL
    const audioUrl = soundDetails.previews['preview-hq-mp3']; // or 'preview-lq-mp3'

    return NextResponse.json({ audioUrl });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching sound samples', details: error.message },
      { status: 500 }
    );
  }
}




