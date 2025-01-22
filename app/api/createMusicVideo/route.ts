import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const accessAsync = promisify(fs.access);
const unlinkAsync = promisify(fs.unlink);

export async function GET() {
  try {
    // Define the paths for the inputs and output
    const fileListPath = path.join(process.cwd(), 'public/output/file-list.txt');
    const audioPath = path.join(process.cwd(), 'public/generated_speech.mp3');
    const outputPath = path.join(process.cwd(), 'public/output/final_video.mp4');

    console.log(`Starting video generation process.`);
    console.log(`File list path: ${fileListPath}`);
    console.log(`Audio path: ${audioPath}`);
    console.log(`Output path: ${outputPath}`);

    // Check if the output file already exists
    try {
      await accessAsync(outputPath);
      console.log(`Output file already exists at ${outputPath}. Overwriting...`);
      await unlinkAsync(outputPath); // Remove the existing file
      console.log(`Existing file at ${outputPath} deleted.`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`No existing file at ${outputPath}. Proceeding with generation.`);
      } else {
        throw err; // Re-throw unexpected errors
      }
    }

    // Validate video files and write to file-list.txt
    const fileList = [];
    const publicDir = path.join(process.cwd(), 'public/videos');
    const files = fs.readdirSync(publicDir);

    for (const file of files) {
      const filePath = path.join(publicDir, file);

      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          // Check video duration to prevent corrupted or extremely long files
          const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`);
          const duration = parseFloat(stdout);

          if (duration > 0 && duration < 600) { // Ignore files longer than 10 minutes
            fileList.push(`file '${filePath.replace(/'/g, "'\\''")}'`);
          } else {
            console.warn(`Ignoring file ${file} due to invalid duration: ${duration}s`);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
      }
    }

    if (fileList.length === 0) {
      throw new Error('No valid video files found for concatenation.');
    }

    // Write validated video files to file-list.txt
    fs.writeFileSync(fileListPath, fileList.join('\n'));

    // Construct the ffmpeg command
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -i "${audioPath}" -c:v libx264 -c:a aac -strict experimental -shortest "${outputPath}"`;

    console.log(`Executing ffmpeg command: ${ffmpegCommand}`);

    // Execute the ffmpeg command
    const { stdout, stderr } = await execAsync(ffmpegCommand);

    if (stdout) {
      console.log(`ffmpeg stdout: ${stdout}`);
    }

    if (stderr) {
      console.warn(`ffmpeg stderr: ${stderr}`);
    }

    console.log(`Video generation completed successfully.`);
    return NextResponse.json({ message: 'Video generated successfully', output: outputPath });
  } catch (error) {
    console.error(`Error executing ffmpeg: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return NextResponse.json({ error: 'Failed to generate video', details: error.message }, { status: 500 });
  }
}
