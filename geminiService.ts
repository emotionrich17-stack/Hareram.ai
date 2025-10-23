
import { GoogleGenAI, Chat, GenerateContentResponse, Modality, Type, VeoOperation } from "@google/genai";

let ai: GoogleGenAI;

const getAi = () => {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}

export const createChat = (systemInstruction: string): Chat => {
  return getAi().chats.create({
    model: 'gemini-2.5-flash',
    config: { systemInstruction },
  });
};

export const generateText = async (
  prompt: string,
  useThinking: boolean,
  useSearch: boolean,
  useMaps: boolean,
  currentPosition: GeolocationPosition | null,
): Promise<GenerateContentResponse> => {
  const modelName = useThinking ? 'gemini-2.5-pro' : 'gemini-2.5-flash-lite';
  const tools: any[] = [];
  if (useSearch) tools.push({ googleSearch: {} });
  if (useMaps) tools.push({ googleMaps: {} });

  const config: any = {};
  if (useThinking) config.thinkingConfig = { thinkingBudget: 32768 };
  if (tools.length > 0) config.tools = tools;
  
  if (useMaps && currentPosition) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        },
      },
    };
  }

  return getAi().models.generateContent({
    model: modelName,
    contents: prompt,
    config,
  });
};

export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
  const response = await getAi().models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio,
    },
  });
  const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
  return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
  const response = await getAi().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: imageBase64, mimeType } }
      ]
    },
  });
  return response.text;
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
  const response = await getAi().models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64ImageBytes: string = part.inlineData.data;
      return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
    }
  }
  throw new Error("No image generated");
};

export const generateVideo = async (prompt: string, imageBase64: string, mimeType: string, aspectRatio: '16:9' | '9:16'): Promise<VeoOperation> => {
    // Re-create AI instance to ensure latest key is used
    const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await veoAi.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: {
            imageBytes: imageBase64,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        }
    });
};

export const checkVideoOperation = async (operation: VeoOperation): Promise<VeoOperation> => {
    // Re-create AI instance to ensure latest key is used
    const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await veoAi.operations.getVideosOperation({ operation: operation });
};


export const generateSpeech = async (text: string): Promise<string> => {
    const response = await getAi().models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data returned from API");
    }
    return base64Audio;
};


export const connectLive = (callbacks: {
    onopen: () => void;
    onmessage: (message: any) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}) => {
    return getAi().live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: 'You are Hareram, a friendly and helpful AI assistant.',
        },
    });
};
