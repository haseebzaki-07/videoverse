import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function generateImages(prompt: string): Promise<string[]> {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt,
        n: 5,
        size: '1024x1024',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const imageUrls = response.data.data.map((image: { url: string }) => image.url);
    return imageUrls;
  } catch (error) {
    console.error('Error generating images:', error.message);
    throw new Error('Error generating images');
  }
}
