"use client"
import React, { useState } from 'react';

const PlaySound = () => {
  const [soundId, setSoundId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const playSound = async (soundId) => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`http://localhost:3000/api/generateMusic?soundId=${soundId}`);
      const data = await response.json();
      
      if (data.previews && data.previews['preview-hq-mp3']) {
        const audioUrl = data.previews['preview-hq-mp3'];

        // Create and play audio
        const audio = new Audio(audioUrl);
        audio.play();
      } else {
        setError('Preview not available for this sound.');
      }
    } catch (error) {
      console.error('Error playing sound:', error);
      setError('Error playing sound.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (soundId) {
      playSound(soundId);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="soundId">Sound ID:</label>
        <input
          type="text"
          id="soundId"
          value={soundId}
          onChange={(e) => setSoundId(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Play Sound'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default PlaySound;