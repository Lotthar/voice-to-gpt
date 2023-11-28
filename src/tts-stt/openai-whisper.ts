import axios from 'axios';
import FormData from 'form-data';
import { openai } from '../util/openai-util.js';
import { Readable } from "stream";


export const generateTextFromSpeech = async(audioBuffer: Buffer, audioFormat: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', audioBuffer, `audio.${audioFormat}`);
    formData.append('model', 'whisper-1');
    try {
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.OPEN_API_KEY}`
            },
        });
        if (response.status === 200 && response.data.text) return response.data.text;
        
        throw new Error('Failed to get valid response from the OpenAI Whisper API');
    } catch (error) {
        console.error('Error generating text from speech:', error);
        throw error;
    }
}

export const generateSpeechFromText = async(text: string) => {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return Readable.from(buffer);
}
