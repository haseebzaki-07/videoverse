import axios from 'axios';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { topic, style, language, duration, ssmlGender = 'NEUTRAL', voiceName } = await req.json();
    console.log('Received data:', { topic, style, language, duration, ssmlGender, voiceName });

    // Step 1: Call the generateClip API to get video clips for the topic, style, and language
    let videoResponse;
    try {
      videoResponse = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generateClips`, {
        topic,
        style,
        language,
      });
      console.log('generateClip API response:', videoResponse.data);
    } catch (error) {
      console.error('Error calling generateClip API:', error.message);
      console.error('Full error:', error.response?.data || error);
      return NextResponse.json({ error: 'Failed to generate video clips' }, { status: 500 });
    }

    const videoPaths = videoResponse.data.videoPaths;
    if (!videoPaths || videoPaths.length === 0) {
      console.error('No video clips generated');
      return NextResponse.json({ error: 'No video clips generated' }, { status: 400 });
    }

    // Step 2: Call the analyzeText API to generate a speech based on the topic, style, and duration
    let speechResponse;
    try {
      speechResponse = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analyzeText`, {
        style,
        topic,
        duration,
      });
      console.log('analyzeText API response:', speechResponse.data);
    } catch (error) {
      console.error('Error calling analyzeText API:', error.message);
      console.error('Full error:', error.response?.data || error);
      return NextResponse.json({ error: 'Failed to generate speech text' }, { status: 500 });
    }

    const generatedSpeech = speechResponse.data.speech;
    if (!generatedSpeech) {
      console.error('Speech generation failed');
      return NextResponse.json({ error: 'Speech generation failed' }, { status: 500 });
    }

    // Step 3: Generate speech-to-text (TTS) audio using the generated speech
    let ttsResponse;
    try {
      ttsResponse = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/tts`, {
        text: generatedSpeech,
        languageCode: language || 'en-US',
        ssmlGender,  // Include ssmlGender
        voiceName,   // Include voiceName
      });
      console.log('generateSpeech API response:', ttsResponse.data);
    } catch (error) {
      console.error('Error calling generateSpeech API:', error.message);
      console.error('Full error:', error.response?.data || error);
      return NextResponse.json({ error: 'Failed to generate speech-to-text audio' }, { status: 500 });
    }

    const audioPath = ttsResponse.data.audioPath;
    if (!audioPath) {
      console.error('Failed to generate audio');
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
    }

    // Step 4: Call the createMusicVideo API to combine video clips and audio
    let videoUrlResponse;
    try {
      videoUrlResponse = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}/api/createMusicVideo`, {
        params: {
          videoPaths: videoPaths.join(','), // Send the video paths as a comma-separated string
          audioPath, // Pass the generated audio path
        },
      });
      console.log('createMusicVideo API response:', videoUrlResponse.data);
    } catch (error) {
      console.error('Error calling createMusicVideo API:', error.message);
      console.error('Full error:', error.response?.data || error);
      return NextResponse.json({ error: 'Failed to create final video' }, { status: 500 });
    }

    const videoUrl = videoUrlResponse.data.output;
    return NextResponse.json({ videoUrl: `/output/final_video.mp4` });
  } catch (error) {
    console.error('Unexpected error in video and speech generation:', error.message);
    console.error('Full error:', error.stack || error);
    return NextResponse.json({ error: 'Unexpected error in video and speech generation', details: error.message }, { status: 500 });
  }
}
