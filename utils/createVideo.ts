import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';

export async function createVideo(
  imageUrls: string[],
  audioUrl: string,
  outputVideoPath: string
): Promise<string> {
  try {
    const imagePaths = await downloadImages(imageUrls);
    const audioPath = await downloadAudio(audioUrl);
    const videoFile = await generateVideo(imagePaths, audioPath, outputVideoPath);
    return videoFile;
  } catch (error) {
    console.error('Error creating video:', error.message);
    throw new Error('Error creating video');
  }
}

async function downloadImages(imageUrls: string[]): Promise<string[]> {
  const imagePaths: string[] = [];
  const imagesDir = path.join(process.cwd(), 'public', 'temp_images');

  if (!fs.existsSync(imagesDir)) {
    try {
      fs.mkdirSync(imagesDir, { recursive: true });
    } catch (error) {
      console.error(`Error creating images directory: ${error.message}`);
      throw new Error('Error creating images directory');
    }
  }

  for (const [index, imageUrl] of imageUrls.entries()) {
    const imagePath = path.join(imagesDir, `image_${index + 1}.jpg`);
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      await fs.promises.writeFile(imagePath, response.data);
      imagePaths.push(imagePath);
    } catch (error) {
      console.error(`Error downloading image ${imageUrl}:`, error.message);
      throw new Error('Error downloading images');
    }
  }

  return imagePaths;
}

async function downloadAudio(audioUrl: string): Promise<string> {
  const audioPath = path.join(process.cwd(), 'public', 'temp_audio_new.mp3');
  try {
    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    await fs.promises.writeFile(audioPath, response.data);
    return audioPath;
  } catch (error) {
    console.error(`Error downloading audio ${audioUrl}:`, error.message);
    throw new Error('Error downloading audio');
  }
}

async function generateVideo(
  imagePaths: string[],
  audioPath: string,
  outputVideoPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Step 1: Get audio duration dynamically using ffmpeg
    ffmpeg(audioPath)
      .ffprobe((err, metadata) => {
        if (err) {
          console.error(`Error getting audio metadata: ${err.message}`);
          return reject(new Error('Error getting audio metadata'));
        }

        const audioDuration = metadata.format.duration; // Get the audio duration in seconds

        if (!audioDuration || audioDuration <= 0) {
          return reject(new Error('Invalid audio duration'));
        }

        // Step 2: Calculate the duration for each image
        const imageDuration = audioDuration / imagePaths.length; // Duration per image
        const ffmpegCommand = ffmpeg();

        // Step 3: Add images to video with appropriate duration for each
        imagePaths.forEach(imagePath => {
          ffmpegCommand.input(imagePath).inputOptions('-framerate 1'); // Add image input at 1fps (one image per second)
        });

        // Step 4: Add audio to video
        ffmpegCommand.input(audioPath);

        // Step 5: Configure video encoding and ensure video length matches audio
        ffmpegCommand
          .output(outputVideoPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(`-t ${audioDuration}`) // Set video length to match audio duration
          .outputOptions('-framerate 1') // Ensures one frame per second
          .on('end', () => resolve(outputVideoPath))
          .on('error', err => {
            console.error(`Error in video creation: ${err.message}`);
            reject(new Error('Error in video creation'));
          })
          .run();
      });
  });
}
