"use client";
import axios from "axios";
import { useState } from "react";
import styles from "./VideoGenerator.module.css"; // Correctly import the CSS module

export default function VideoGenerator() {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("");
  const [voice, setVoice] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topics = [
    "Ambient Sound",
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
    "Movies & TV Shows"
  ];
  
  const stylesData = [
    { name: "Comic", image: "/images/comic.avif" },
    { name: "Water Color", image: "/images/water_color.avif" },
    { name: "Photography", image: "/images/photography.avif" },
    { name: "Environment", image: "/images/environment.avif" },
  ];
  const durations = ["30", "60", "120"];
  const languages = ["English", "Spanish", "French", "German"];
  const voices = ["Male", "Female", "Robotic"];

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      const keywords = [style, topic].filter(Boolean);

      console.log({
        topic,
        style,
        keywords,
        duration,
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/generateVideo`,
        {
          topic,
          style,
          keywords,
          duration,
        }
      );

      if (response.status === 200) {
        setVideoUrl(response.data.videoUrl);
      } else {
        throw new Error("Unexpected response status: " + response.status);
      }
    } catch (error) {
      console.error("Error generating video:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with a status code other than 2xx
          setError(
            `Error: ${error.response.data.error || "Server error occurred."}`
          );
        } else if (error.request) {
          // No response received
          setError(
            "Error: No response from server. Please check your network connection."
          );
        } else {
          // Axios error triggered during setup
          setError(`Error: ${error.message}`);
        }
      } else {
        // Non-Axios error
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Topic</h2>
      <label>What is the topic of your video?</label>
      <select value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="">Select a topic</option>
        {topics.map((topic) => (
          <option key={topic} value={topic}>
            {topic}
          </option>
        ))}
      </select>

      <h2 className={styles.heading}>Style</h2>
      <label>Select your video style!</label>
      <div className={styles.stylesContainer}>
        {stylesData.map(({ name, image }) => (
          <div
            key={name}
            className={`${styles["styleOption"]} ${
              style === name ? styles.selected : ""
            }`}
            onClick={() => setStyle(name)}
          >
            <img src={image} alt={name} />
            <p>{name}</p>
          </div>
        ))}
      </div>

      <h2 className={styles.heading}>Duration</h2>
      <label>What is the duration of your video?</label>
      <select value={duration} onChange={(e) => setDuration(e.target.value)}>
        <option value="">Select video duration</option>
        {durations.map((dur) => (
          <option key={dur} value={dur}>
            {dur}
          </option>
        ))}
      </select>

      <h2 className={styles.heading}>Video Language</h2>
      <label>Select your video language!</label>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="">Select language</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>

      <h2 className={styles.heading}>Voice Over</h2>
      <label>Select from all available voices</label>
      <select value={voice} onChange={(e) => setVoice(e.target.value)}>
        <option value="">Select voice</option>
        {voices.map((voice) => (
          <option key={voice} value={voice}>
            {voice}
          </option>
        ))}
      </select>

      <button onClick={handleGenerate} className={styles.generateButton}>
        Generate Video
      </button>

      {loading && (
        <div className={styles["loadingCard"]}>
          <p>Generating video, please wait...</p>
        </div>
      )}

      {error && (
        <div className={styles["errorMessage"]}>
          <p>{error}</p>
        </div>
      )}

      {videoUrl && (
        <div className={styles["videoResult"]}>
          <p>
            Video generated successfully! Watch it{" "}
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
