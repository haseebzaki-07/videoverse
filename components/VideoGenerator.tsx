"use client"
import axios from 'axios';
import { useState } from 'react';
import styles from './VideoGenerator.module.css'; // Correctly import the CSS module

export default function VideoGenerator() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('');
  const [duration, setDuration] = useState('');
  const [language, setLanguage] = useState('');
  const [voice, setVoice] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const topics = ['Scary', 'Random AI', 'Fun Facts', 'Motivational'];
  const stylesData = [
    { name: 'Comic', image: '/images/comic-style.jpg' },
    { name: 'Water Color', image: '/images/watercolor-style.jpg' },
    { name: 'Photography', image: '/images/photography-style.jpg' },
    { name: 'Environment', image: '/images/environment-style.jpg' }
  ];
  const durations = ['30', '60', '120'];
  const languages = ['English', 'Spanish', 'French', 'German'];
  const voices = ['Male', 'Female', 'Robotic'];

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    
   
  
    try {
      const keywords = [style, topic].filter(Boolean); 
      
      console.log({
        topic,
        style,
        keywords,
        duration
      });
      
  
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/generateVideo`, {
        topic,
        style,
        keywords,
        duration
      });
  
      if (response.status === 200) {
        setVideoUrl(response.data.videoUrl);
      } else {
        throw new Error('Unexpected response status: ' + response.status);
      }
    } catch (error) {
      console.error('Error generating video:', error);
  
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with a status code other than 2xx
          setError(`Error: ${error.response.data.error || 'Server error occurred.'}`);
        } else if (error.request) {
          // No response received
          setError('Error: No response from server. Please check your network connection.');
        } else {
          // Axios error triggered during setup
          setError(`Error: ${error.message}`);
        }
      } else {
        // Non-Axios error
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className={styles.container}>
      <h1>Video Generator</h1>
      <h2>Topic</h2>
      <label>What is the topic of your video?</label>
      <select value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="">Select a topic</option>
        {topics.map((topic) => (
          <option key={topic} value={topic}>{topic}</option>
        ))}
      </select>

      <h2>Style</h2>
      <label>Select your video style!</label>
      <div>
        {stylesData.map(({ name, image }) => (
          <div
            key={name}
            className={`${styles['style-option']} ${style === name ? styles.selected : ''}`}
            onClick={() => setStyle(name)}
          >
            <img src={image} alt={name} />
            <p>{name}</p>
          </div>
        ))}
      </div>

      <h2>Duration</h2>
      <label>What is the duration of your video?</label>
      <select value={duration} onChange={(e) => setDuration(e.target.value)}>
        <option value="">Select video duration</option>
        {durations.map((dur) => (
          <option key={dur} value={dur}>{dur}</option>
        ))}
      </select>

      <h2>Video Language</h2>
      <label>Select your video language!</label>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="">Select language</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>

      <h2>Voice Over</h2>
      <label>Select from all available voices</label>
      <select value={voice} onChange={(e) => setVoice(e.target.value)}>
        <option value="">Select voice</option>
        {voices.map((voice) => (
          <option key={voice} value={voice}>{voice}</option>
        ))}
      </select>

      <button onClick={handleGenerate}>Generate Video</button>

      {loading && (
        <div className={styles['loading-card']}>
          <p>Generating video, please wait...</p>
        </div>
      )}

      {error && (
        <div className={styles['error-message']}>
          <p>{error}</p>
        </div>
      )}

      {videoUrl && (
        <div className={styles['video-result']}>
          <p>Video generated successfully! Watch it <a href={videoUrl} target="_blank">here</a>.</p>
        </div>
      )}
    </div>
  );
}
