import { TextToSpeechClient } from '@google-cloud/text-to-speech';

export async function getAvailableLanguages() {
  const client = new TextToSpeechClient();

  try {
    const [result] = await client.listVoices({});
    const languages = new Set();

    result.voices?.forEach(voice => {
      voice.languageCodes?.forEach(code => languages.add(code));
    });

    // Return the available languages as an array
    return Array.from(languages);
  } catch (error) {
    console.error('Error fetching languages:', error);
    return []; // Return an empty array in case of error
  }
}
