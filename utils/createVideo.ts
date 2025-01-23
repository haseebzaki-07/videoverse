import { exec } from "child_process";
import { NextResponse } from "next/server"; // if you're working with Next.js

export async function createVideo() {
  try {
    // Define the exact FFmpeg command to run
    const ffmpegCommand = `
      ffmpeg -f concat -safe 0 -i "D:\\Hakctoberfest\\shorts2.lol\\shorts.lol\\public\\output\\file-list.txt" 
      -i "D:\\Hakctoberfest\\shorts2.lol\\shorts.lol\\public\\generated_speech.mp3" 
      -c:v libx264 -c:a aac -strict experimental 
      "D:\\Hakctoberfest\\shorts2.lol\\shorts.lol\\public\\output\\final_video.mp4"
    `.trim();

    console.log(`Running FFmpeg command: ${ffmpegCommand}`);

    await new Promise<void>((resolve, reject) => {
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution error: ${error.message}`);
          console.error(`FFmpeg stderr: ${stderr}`);
          return reject(
            new Error("Error during FFmpeg video creation process.")
          );
        }

        if (stderr) {
          console.warn(`FFmpeg stderr: ${stderr}`);
        }

        console.log(`FFmpeg stdout: ${stdout}`);
        resolve();
      });
    });

    // Return success message after video creation
    return NextResponse.json(
      {
        message: "Video created successfully!",
        output: "/output/final_video.mp4",
      },
      { status: 200 }
    );
  } catch (error) {
    // Improved error logging
    console.error(
      "Error occurred during video creation:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      {
        error: `Unexpected error occurred during video creation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
