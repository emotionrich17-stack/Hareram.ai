
export enum Feature {
  CHAT = 'Chat',
  TEXT_GEN = 'Text Gen',
  IMAGE_GEN = 'Image Gen',
  IMAGE_EDIT = 'Image Edit',
  IMAGE_ANALYZE = 'Image Analyze',
  VIDEO_GEN = 'Video Gen',
  LIVE_AGENT = 'Live Agent',
  TTS = 'TTS',
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// For Veo video generation operations
export interface VeoOperation {
  name: string;
  done: boolean;
  response?: {
    generatedVideos: {
      video: {
        uri: string;
      };
    }[];
  };
}
