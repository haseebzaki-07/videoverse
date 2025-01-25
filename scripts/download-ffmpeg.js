const https = require("https");
const fs = require("fs");
const path = require("path");

const FFMPEG_FILES = [
  {
    url: "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js",
    filename: "ffmpeg-core.js",
  },
  {
    url: "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.wasm",
    filename: "ffmpeg-core.wasm",
  },
];

const ffmpegDir = path.join(process.cwd(), "public", "ffmpeg");

// Create ffmpeg directory if it doesn't exist
if (!fs.existsSync(ffmpegDir)) {
  fs.mkdirSync(ffmpegDir, { recursive: true });
}

FFMPEG_FILES.forEach((file) => {
  const filePath = path.join(ffmpegDir, file.filename);
  const fileStream = fs.createWriteStream(filePath);

  https
    .get(file.url, (response) => {
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        console.log(`Downloaded ${file.filename}`);
      });
    })
    .on("error", (err) => {
      fs.unlink(filePath, () => {});
      console.error(`Error downloading ${file.filename}:`, err.message);
    });
});
