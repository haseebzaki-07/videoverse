"use client";
import axios from "axios";
import { useState } from "react";
import styles from "./VideoGenerator.module.css";
import Image from "next/image";

export default function VideoGenerator() {
  const [topic, setTopic] = useState<string>("");
  const [style, setStyle] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [voice, setVoice] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [userPrompt, setUserPrompt] = useState<string>(""); // New state for user prompt
  const [promptVideoUrl, setPromptVideoUrl] = useState<string>(""); // Video URL from prompt generation

  const topics: string[] = [
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

  const durations: string[] = ["30", "60", "120"];
  const voices: string[] = ["Male", "Female", "Robotic"];

  const handleGenerate = async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const requestPayload = {
        topic,
        style,
        language: selectedLanguage || "en-US",
        duration: duration || "60",
        ssmlGender: voice || "NEUTRAL",
        voiceName: "en-US-Wavenet-D", // Map based on voice selection
      };

      console.log("Request Payload:", requestPayload);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/generateVideo`,
        requestPayload
      );

      if (response.status === 200) {
        setVideoUrl(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/output/final_video.mp4`
        );
      } else {
        throw new Error("Unexpected response status: " + response.status);
      }
    } catch (error) {
      handleAxiosError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptGenerate = async (): Promise<void> => {
    if (!userPrompt.trim()) {
      setError("Please enter a valid prompt.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/analyzePrompt`,
        { prompt: userPrompt } // Send the prompt to the backend
      );

      if (response.status === 200) {
        setPromptVideoUrl(response.data.videoUrl);
      } else {
        throw new Error("Unexpected response status: " + response.status);
      }
    } catch (error) {
      handleAxiosError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAxiosError = (error: unknown): void => {
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
      {/* Existing fields and UI */}
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
      >
        <option value="">Select a language</option>
        {/* languages.map((language, index) => (
          <option key={index} value={language}>
            {language}
          </option>
        )) */}
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
        Generate Video
      </button>

      <div className={styles.promptSection}>
        <h2 className={styles.heading}>Custom Video Prompt</h2>
        <label className={styles.label}>Enter your video prompt:</label>
        <textarea
          value={userPrompt} // Bind to userPrompt
          onChange={(e) => setUserPrompt(e.target.value)} // Update userPrompt
          placeholder="Describe your video idea..."
          className={styles.textarea}
        />
        <button
          onClick={handlePromptGenerate}
          className={styles.generatePromptButton}
        >
          Generate Video from Prompt
        </button>
      </div>
      {loading && <p>Generating video, please wait...</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}

      {videoUrl && (
        <p>
          Video generated successfully! Watch it{" "}
          <a href={videoUrl} target="_blank" rel="noopener noreferrer">
            here
          </a>
        </p>
      )}
      {promptVideoUrl && (
        <p>
          Video generated successfully from prompt! Watch it{" "}
          <a href={promptVideoUrl} target="_blank" rel="noopener noreferrer">
            here
          </a>
        </p>
      )}
    </div>
  );
}
