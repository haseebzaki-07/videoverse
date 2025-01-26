"use client";
import { useState } from "react";
import styles from "./VideoGenerator.module.css";
import Image from "next/image";
import logger from "@/utils/logger";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function VideoGenerator() {
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

      const analyzeResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/analyzeText`,
        {
          topic,
          style,
          language: selectedLanguage || "en-US",
          duration: parseInt(duration) / 60,
          ssmlGender: voice || "NEUTRAL",
          voiceName: "en-US-Wavenet-D",
        }
      );

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
      const promptAnalysis = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/analyzePrompt`,
        { prompt: userPrompt }
      );

      if (!promptAnalysis.data) {
        throw new Error("Failed to analyze prompt");
      }

      // Step 2: Use the analyzed data for text analysis
      const analyzeResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/analyzeText`,
        {
          topic: promptAnalysis.data.topic || "General",
          style: promptAnalysis.data.style || "Cinematic",
          language: promptAnalysis.data.language || "en-US",
          duration: promptAnalysis.data.duration || 1,
          ssmlGender: promptAnalysis.data.ssmlGender || "NEUTRAL",
          voiceName: promptAnalysis.data.voiceName || "en-US-Wavenet-D",
        }
      );

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
      const clipsResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generateClips`,
        {
          style: style || "Cinematic",
          topic,
          duration: parseInt(duration) || 60,
        }
      );

      if (!clipsResponse.data?.videoPaths?.length) {
        throw new Error("No video clips were generated");
      }

      logger.info("Starting TTS process");
      const ttsResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tts`,
        {
          text: speech,
          languageCode: selectedLanguage || "en-US",
          ssmlGender: voice || "NEUTRAL",
          voiceName: "en-US-Wavenet-D",
        }
      );

      if (!ttsResponse.data?.audioPath) {
        throw new Error("Failed to generate audio");
      }

      logger.info("Starting final video creation");
      const videoResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/createMusicVideo`
      );

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
    <div className={styles.container}>
      <h2 className={styles.heading}>Generate Video with Fields</h2>
      <label>What is the topic of your video?</label>
      <select
        className="mt-2"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      >
        <option value="">Select a topic</option>
        {topics.map((topic) => (
          <option key={topic} value={topic}>
            {topic}
          </option>
        ))}
      </select>

      <h2 className={styles.heading}>Style</h2>
      <div className={styles.stylesContainer}>
        {stylesData.map(({ name, image }) => (
          <div
            key={name}
            className={`${styles["styleOption"]} ${
              style === name ? styles.selected : ""
            }`}
            onClick={() => setStyle(name)}
          >
            <Image src={image} alt={name} width={500} height={500} />
            <p>{name}</p>
          </div>
        ))}
      </div>

      <h2 className={styles.heading}>Duration</h2>
      <select value={duration} onChange={(e) => setDuration(e.target.value)}>
        <option value="">Select duration</option>
        {durations.map((duration) => (
          <option key={duration} value={duration}>
            {duration} seconds
          </option>
        ))}
      </select>

      <h2 className={styles.heading}>Video Language</h2>
      <select
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
        className="mt-2"
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

      <h2 className={styles.heading}>Voice Over</h2>
      <select value={voice} onChange={(e) => setVoice(e.target.value)}>
        <option value="">Select voice</option>
        {voices.map((voiceOption) => (
          <option key={voiceOption} value={voiceOption}>
            {voiceOption}
          </option>
        ))}
      </select>

      <button onClick={handleGenerate} className={styles.generateButton}>
        {loading ? "Generating..." : "Generate Video"}
      </button>

      {generatedSpeeches.length > 0 && (
        <div className={styles.speechesContainer}>
          <h3 className={styles.subheading}>Select a Script</h3>
          <div className={styles.speechCards}>
            {generatedSpeeches.map((speech, index) => (
              <div
                key={index}
                className={`${styles.speechCard} ${
                  selectedSpeech === speech ? styles.selected : ""
                }`}
              >
                <h4>Script Option {index + 1}</h4>
                <div className={styles.speechContent}>
                  <p>{speech}</p>
                </div>
                <button
                  onClick={() => handleSpeechSelect(speech)}
                  className={styles.selectButton}
                  disabled={loading || selectedSpeech === speech}
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

      <div className={styles.promptSection}>
        <h2 className={styles.heading}>Custom Video Prompt</h2>
        <label className={styles.label}>Enter your video prompt:</label>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Describe your video idea..."
          className={styles.textarea}
        />
        <button
          onClick={handlePromptGenerate}
          className={styles.generatePromptButton}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Scripts"}
        </button>
      </div>
      {loading && <p>Generating video, please wait...</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}

      {videoUrl && (
        <div className={styles.successMessage}>
          <p>Video created successfully!</p>
          <button
            onClick={() =>
              router.push(
                `/videoEditor?videoUrl=${encodeURIComponent(videoUrl)}`
              )
            }
            className={styles.generateButton}
          >
            Edit Video
          </button>
        </div>
      )}
    </div>
  );
}
