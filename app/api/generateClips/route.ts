import axios from "axios";
import fs from "fs";
import path from "path";

// Pexels API Key (from .env.local)
const pexelsApiKey = process.env.PEXELS_API_KEY;

export async function POST(req) {
  try {
    const { topic, style, language } = await req.json();

    // Basic validation
    if (!topic) {
      return new Response(JSON.stringify({ message: "Topic is required" }), {
        status: 400,
      });
    }

    // Make a request to the Pexels API to search for videos
    const response = await axios.get("https://api.pexels.com/videos/search", {
      params: {
        query: `${topic} ${style}`, // Combine topic and style for search query
        per_page: 5, // Limit to 5 video clips
        lang: language || "en", // Set language, default to 'en' if not provided
      },
      headers: {
        Authorization: pexelsApiKey, // Pass the API key in headers
      },
    });

    // Get video URLs
    const videoUrls = response.data.videos
      .map((video) => video.video_files[0]?.link)
      .filter(Boolean);

    // Prepare the directory to store videos
    const publicDir = path.join(process.cwd(), "public", "videos");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const videoPaths = [];
    for (const [index, videoUrl] of videoUrls.entries()) {
      const videoPath = path.join(publicDir, `video_${index + 1}.mp4`);

      try {
        // Download the video and save it to the public directory
        const videoStream = await axios.get(videoUrl, {
          responseType: "stream",
        });

        await new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(videoPath);
          videoStream.data.pipe(writeStream);
          videoStream.data.on("end", resolve);
          videoStream.data.on("error", reject);
        });

        // Check the file size to ensure the video is not corrupted
        const stats = fs.statSync(videoPath);
        if (stats.size > 0) {
          videoPaths.push(`/videos/video_${index + 1}.mp4`);
        } else {
          console.warn(`Video ${videoPath} is empty and will be ignored.`);
          fs.unlinkSync(videoPath); // Remove corrupted file
        }
      } catch (downloadError) {
        console.error(
          `Error downloading video from ${videoUrl}:`,
          downloadError.message
        );
        // Continue to the next video if one fails
      }
    }

    // Return the paths of the successfully downloaded video clips
    return new Response(JSON.stringify({ videoPaths }), { status: 200 });
  } catch (error) {
    console.error("Error fetching videos from Pexels:", error);
    return new Response(
      JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
      { status: 500 }
    );
  }
}
