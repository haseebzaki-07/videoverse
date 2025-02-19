"use client";
import { useState } from "react";
import styles from "./VideoGenerator.module.css";
import Image from "next/image";
import logger from "@/utils/logger";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function VideoGenerator() {
  const [activeTab, setActiveTab] = useState("fields"); // 'fields' or 'prompt'
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const [duration, setDuration] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [voice, setVoice] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [generatedSpeeches, setGeneratedSpeeches] = useState([]);
  const [selectedSpeech, setSelectedSpeech] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previousVideoUrl, setPreviousVideoUrl] = useState(
    "/output/final_video.mp4"
  );
  const [showPreviousVideo, setShowPreviousVideo] = useState(false);

  const topics = [
    "Ambient Sound",
    "Random AI",
    "Nature",
    "Technology",
    "Motivational",
    "Gaming",
    "Sports",
    "Health & Wellness",
    "Science",
    "Music",
    "Travel",
    "Cryptocurrency",
    "Space Exploration",
    "Movies & TV Shows",
  ];

  const stylesData = [
    { name: "Comic", image: "/images/comic.avif" },
    { name: "Water Color", image: "/images/water_color.avif" },
    { name: "Photography", image: "/images/photography.avif" },
    { name: "Environment", image: "/images/environment.avif" },
  ];

  const durations = ["30", "60", "120"];
  const voices = ["Male", "Female", "Robotic"];

  const router = useRouter();

  const handleGenerate = async () => {
    if (!topic || !style || !duration) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedSpeeches([]);

    try {
      logger.info("Starting speech generation with input fields", {
        topic,
        style,
        duration,
        language: selectedLanguage,
        voice,
      });

      const analyzeResponse = await axios.post(`/api/analyzeText`, {
        topic,
        style,
        language: selectedLanguage || "en-US",
        duration: parseInt(duration) / 60,
        ssmlGender: voice || "NEUTRAL",
        voiceName: "en-US-Wavenet-D",
      });

      if (analyzeResponse.data?.speeches?.length > 0) {
        logger.info("Successfully generated speeches", {
          speechCount: analyzeResponse.data.speeches.length,
        });
        setGeneratedSpeeches(analyzeResponse.data.speeches);
      } else {
        throw new Error("No speeches were generated");
      }
    } catch (error) {
      logger.error("Error in handleGenerate", { error });
      handleAxiosError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptGenerate = async () => {
    if (!userPrompt.trim()) {
      setError("Please enter a valid prompt.");
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedSpeeches([]);

    try {
      logger.info("Starting prompt analysis", { prompt: userPrompt });

      // Step 1: Analyze the prompt first
      const promptAnalysis = await axios.post(`/api/analyzePrompt`, {
        prompt: userPrompt,
      });

      if (!promptAnalysis.data) {
        throw new Error("Failed to analyze prompt");
      }

      // Step 2: Use the analyzed data for text analysis
      const analyzeResponse = await axios.post(`/api/analyzeText`, {
        topic: promptAnalysis.data.topic || "General",
        style: promptAnalysis.data.style || "Cinematic",
        language: promptAnalysis.data.language || "en-US",
        duration: promptAnalysis.data.duration || 1,
        ssmlGender: promptAnalysis.data.ssmlGender || "NEUTRAL",
        voiceName: promptAnalysis.data.voiceName || "en-US-Wavenet-D",
      });

      if (!analyzeResponse.data?.speeches?.length) {
        throw new Error("No speeches were generated");
      }

      logger.info("Successfully generated speeches", {
        speechCount: analyzeResponse.data.speeches.length,
      });

      // Update UI state with the results
      setGeneratedSpeeches(analyzeResponse.data.speeches);
      setTopic(promptAnalysis.data.topic || "");
      setStyle(promptAnalysis.data.style || "Cinematic");
      setDuration(String(promptAnalysis.data.duration * 60) || "60");
      setSelectedLanguage(promptAnalysis.data.language || "en-US");
      setVoice(promptAnalysis.data.ssmlGender || "NEUTRAL");
    } catch (error) {
      logger.error("Error in handlePromptGenerate", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      handleAxiosError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeechSelect = async (speech) => {
    if (!speech) {
      setError("Invalid speech selected");
      return;
    }

    setSelectedSpeech(speech);
    setLoading(true);
    setError("");

    try {
      logger.info("Starting video clips generation");
      const clipsResponse = await axios.post(`/api/generateClips`, {
        style: style || "Cinematic",
        topic,
        duration: parseInt(duration) || 60,
      });

      if (!clipsResponse.data?.videoPaths?.length) {
        throw new Error("No video clips were generated");
      }

      logger.info("Starting TTS process");
      const ttsResponse = await axios.post(`/api/tts`, {
        text: speech,
        languageCode: selectedLanguage || "en-US",
        ssmlGender: voice || "NEUTRAL",
        voiceName: "en-US-Wavenet-D",
      });

      if (!ttsResponse.data?.audioPath) {
        throw new Error("Failed to generate audio");
      }

      logger.info("Starting final video creation");
      const videoResponse = await axios.get(`/api/createMusicVideo`);

      if (videoResponse.data?.videoUrl) {
        logger.info("Video creation successful");
        setVideoUrl(videoResponse.data.videoUrl);
      } else {
        throw new Error("Failed to create final video");
      }
    } catch (error) {
      logger.error("Error in handleSpeechSelect", { error });
      handleAxiosError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPreviousVideo = () => {
    setShowPreviousVideo(true);
    setVideoUrl("");
    setGeneratedSpeeches([]);
    setSelectedSpeech("");
  };

  const handleAxiosError = (error) => {
    console.error("Error generating video:", error);

    if (axios.isAxiosError(error)) {
      if (error.response) {
        setError(
          `Error: ${error.response.data.error || "Server error occurred."}`
        );
      } else if (error.request) {
        setError("Error: No response from server. Please check your network.");
      } else {
        setError(`Error: ${error.message}`);
      }
    } else if (error instanceof Error) {
      setError(`Error: ${error.message}`);
    } else {
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      {/* Header with View Previous Video button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("fields")}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${
                activeTab === "fields"
                  ? "bg-white text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            aria-label="Generate with fields"
          >
            Generate with Fields
          </button>
          <button
            onClick={() => setActiveTab("prompt")}
            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${
                activeTab === "prompt"
                  ? "bg-white text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            aria-label="Generate with prompt"
          >
            Generate with Prompt
          </button>
        </div>
        <button
          onClick={handleViewPreviousVideo}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium 
            hover:bg-gray-200 transition-colors flex items-center space-x-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>View Previous Video</span>
        </button>
      </div>

      {/* Previous Video Preview Section */}
      {showPreviousVideo && (
        <div className="mt-8 space-y-6">
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <video
              key={previousVideoUrl}
              src={previousVideoUrl}
              controls
              className="w-full aspect-video"
              autoPlay={false}
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => {
                setShowPreviousVideo(false);
                setVideoUrl("");
              }}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium 
                hover:bg-gray-700 transition-colors"
            >
              Generate New Video
            </button>
            <button
              onClick={() =>
                router.push(
                  `/videoEditor?videoUrl=${encodeURIComponent(
                    previousVideoUrl
                  )}`
                )
              }
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium 
                hover:bg-blue-700 transition-colors"
            >
              Advanced Edit
            </button>
          </div>
        </div>
      )}

      {/* Current Video Preview Section */}
      {videoUrl && !showPreviousVideo && (
        <div className="mt-8 space-y-6">
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full aspect-video"
              autoPlay={false}
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => {
                setVideoUrl("");
                setGeneratedSpeeches([]);
                setSelectedSpeech("");
                setShowPreview(false);
              }}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium 
                hover:bg-gray-700 transition-colors"
            >
              Generate New Video
            </button>
            <button
              onClick={() =>
                router.push(
                  `/videoEditor?videoUrl=${encodeURIComponent(videoUrl)}`
                )
              }
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium 
                hover:bg-blue-700 transition-colors"
            >
              Advanced Edit
            </button>
          </div>
        </div>
      )}

      {!videoUrl && !showPreviousVideo && (
        <>
          {/* Fields Tab Content */}
          {activeTab === "fields" && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Step 1: Choose Topic
                </h3>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a topic</option>
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Step 2: Choose Style
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stylesData.map(({ name, image }) => (
                    <div
                      key={name}
                      onClick={() => setStyle(name)}
                      className={`relative rounded-lg overflow-hidden cursor-pointer transition-all
                        ${
                          style === name
                            ? "ring-4 ring-blue-500 scale-105"
                            : "hover:scale-105"
                        }`}
                    >
                      <Image
                        src={image}
                        alt={name}
                        width={500}
                        height={500}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                        <p className="text-white text-center text-sm">{name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Step 3: Duration
                  </h3>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select duration</option>
                    {durations.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} seconds
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Step 4: Language
                  </h3>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a language</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Italian">Italian</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Korean">Korean</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Arabic">Arabic</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Step 5: Voice
                  </h3>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select voice</option>
                    {voices.map((voiceOption) => (
                      <option key={voiceOption} value={voiceOption}>
                        {voiceOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 
                  transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Generating..." : "Generate Scripts"}
              </button>
            </div>
          )}

          {/* Prompt Tab Content */}
          {activeTab === "prompt" && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Enter Your Video Prompt
                </h3>
                <p className="text-gray-600 mb-4">
                  Describe your video idea in detail. Include information about
                  the style, topic, duration, and any specific requirements you
                  have.
                </p>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Example: Create a 60-second motivational video with upbeat background music and nature scenes..."
                  className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 
                    focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <button
                  onClick={handlePromptGenerate}
                  disabled={loading}
                  className="w-full mt-4 py-4 bg-blue-600 text-white rounded-lg font-medium 
                    hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Generating..." : "Generate Scripts"}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Generated Scripts Section */}
          {generatedSpeeches.length > 0 && (
            <div className="space-y-6 mt-8">
              <h3 className="text-xl font-semibold text-gray-800">
                Select a Script
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedSpeeches.map((speech, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all
                      ${
                        selectedSpeech === speech
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                  >
                    <h4 className="font-medium text-gray-800 mb-2">
                      Script Option {index + 1}
                    </h4>
                    <p className="text-gray-600 text-sm mb-4">{speech}</p>
                    <button
                      onClick={() => handleSpeechSelect(speech)}
                      disabled={loading || selectedSpeech === speech}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium 
                        hover:bg-blue-700 transition-colors disabled:bg-gray-400 
                        disabled:cursor-not-allowed"
                    >
                      {loading
                        ? "Processing..."
                        : selectedSpeech === speech
                        ? "Selected"
                        : "Select This Script"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
