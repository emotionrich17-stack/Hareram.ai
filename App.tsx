

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chat, GenerateContentResponse } from '@google/genai';
import { Feature, ChatMessage, VeoOperation } from './types';
import { fileToBase64, encode, decode, decodeAudioData } from './utils/helpers';
import * as api from './services/geminiService';
import { ChatIcon, TextIcon, ImageIcon, VideoIcon, LiveIcon, SpeakerIcon, SparklesIcon, UploadIcon } from './components/icons';

// --- HELPER & UI COMPONENTS (Defined outside main component) ---

const FeatureButton: React.FC<{
  feature: Feature;
  currentFeature: Feature;
  onClick: (feature: Feature) => void;
  children: React.ReactNode;
}> = ({ feature, currentFeature, onClick, children }) => (
  <button
    onClick={() => onClick(feature)}
    className={`flex flex-col items-center justify-center space-y-2 p-3 rounded-lg transition-all duration-200 ${
      currentFeature === feature ? 'bg-blue-600 text-white scale-105' : 'bg-gray-700 hover:bg-gray-600'
    }`}
  >
    {children}
    <span className="text-xs font-medium">{feature}</span>
  </button>
);

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
);

const GroundingChunk: React.FC<{ chunk: any }> = ({ chunk }) => {
    const source = chunk.web || chunk.maps;
    if (!source || !source.uri) return null;
    return (
        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-400 hover:underline bg-gray-800 p-2 rounded-md truncate">
           {source.title || source.uri}
        </a>
    )
}

// --- FEATURE COMPONENTS (Defined outside main component) ---

const Chatbot: React.FC = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setChat(api.createChat('You are Hareram, a helpful AI assistant.'));
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !chat || isLoading) return;
        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const stream = await chat.sendMessageStream({ message: input });
            let modelResponse = '';
            setMessages(prev => [...prev, { role: 'model', content: '' }]);
            for await (const chunk of stream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = modelResponse;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'model', content: 'Sorry, I encountered an error.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg p-4">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                           <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length-1].role === 'user' && (
                     <div className="flex justify-start">
                        <div className="max-w-lg px-4 py-2 rounded-lg bg-gray-700">
                           <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex items-center">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-l-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ask Hareram anything..."
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-r-md disabled:bg-gray-500">
                    Send
                </button>
            </div>
        </div>
    );
};

const TextGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useThinking, setUseThinking] = useState(false);
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const [groundingChunks, setGroundingChunks] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [position, setPosition] = useState<GeolocationPosition | null>(null);

    useEffect(() => {
        if (useMaps && !position) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setPosition(pos),
                (err) => setError('Could not get location for Maps. Please grant permission.')
            );
        }
    }, [useMaps, position]);

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setResponse('');
        setGroundingChunks([]);
        setError('');
        try {
            const result = await api.generateText(prompt, useThinking, useSearch, useMaps, position);
            setResponse(result.text);
            setGroundingChunks(result.candidates?.[0]?.groundingMetadata?.groundingChunks || []);
        } catch (e) {
            setError('Failed to generate text. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your prompt here... For complex tasks, try Thinking Mode!"
            />
            <div className="flex flex-wrap items-center gap-4">
                 <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:bg-gray-500 flex items-center justify-center"
                >
                    {isLoading ? <LoadingSpinner/> : 'Generate'}
                </button>
                <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-lg">
                    <input type="checkbox" id="thinking" checked={useThinking} onChange={(e) => setUseThinking(e.target.checked)} />
                    <label htmlFor="thinking" className="text-sm font-medium">🤔 Thinking Mode (Pro)</label>
                </div>
                 <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-lg">
                    <input type="checkbox" id="search" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} />
                    <label htmlFor="search" className="text-sm font-medium">🌐 Google Search</label>
                </div>
                 <div className="flex items-center space-x-2 bg-gray-800 p-2 rounded-lg">
                    <input type="checkbox" id="maps" checked={useMaps} onChange={(e) => setUseMaps(e.target.checked)} />
                    <label htmlFor="maps" className="text-sm font-medium">🗺️ Google Maps</label>
                </div>
            </div>
            {error && <p className="text-red-400">{error}</p>}
            {(isLoading || response || groundingChunks.length > 0) && (
                <div className="bg-gray-800 p-4 rounded-lg mt-4">
                    <h3 className="text-lg font-semibold mb-2">Response</h3>
                    {isLoading && !response && <p>Generating...</p>}
                    <p className="whitespace-pre-wrap">{response}</p>
                    {groundingChunks.length > 0 && (
                        <div className="mt-4">
                           <h4 className="font-semibold mb-2">Sources:</h4>
                           <div className="space-y-2">
                            {groundingChunks.map((chunk, i) => <GroundingChunk key={i} chunk={chunk} />)}
                           </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [imageUrl, setImageUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setImageUrl('');
        setError('');
        try {
            const url = await api.generateImage(prompt, aspectRatio);
            setImageUrl(url);
        } catch (e) {
            setError('Failed to generate image. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="A futuristic robot drinking coffee..."
            />
            <div className="flex items-center space-x-4">
                 <button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:bg-gray-500 flex items-center justify-center">
                    {isLoading ? <LoadingSpinner/> : 'Generate'}
                </button>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg p-2">
                    <option value="1:1">1:1 (Square)</option>
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="4:3">4:3</option>
                    <option value="3:4">3:4</option>
                </select>
            </div>
            {error && <p className="text-red-400">{error}</p>}
            {isLoading && <div className="flex justify-center p-8"><LoadingSpinner /></div>}
            {imageUrl && <img src={imageUrl} alt="Generated" className="rounded-lg max-w-full mx-auto mt-4" />}
        </div>
    );
};

const ImageEditor: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [originalImage, setOriginalImage] = useState<File | null>(null);
    const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
    const [editedImageUrl, setEditedImageUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setOriginalImage(file);
            setOriginalImageUrl(URL.createObjectURL(file));
            setEditedImageUrl('');
        }
    };
    
    const handleSubmit = async () => {
        if (!prompt.trim() || !originalImage) return;
        setIsLoading(true);
        setEditedImageUrl('');
        setError('');
        try {
            const base64 = await fileToBase64(originalImage);
            const url = await api.editImage(prompt, base64, originalImage.type);
            setEditedImageUrl(url);
        } catch(e) {
            setError('Failed to edit image. Please try again.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <div className="flex-1 space-y-4">
                    <label className="block w-full cursor-pointer bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500">
                        <UploadIcon className="mx-auto h-12 w-12 text-gray-400"/>
                        <span className="mt-2 block text-sm font-medium text-gray-300">
                            {originalImage ? originalImage.name : 'Click to upload an image'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden"/>
                    </label>
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add a retro filter..."
                    />
                    <button onClick={handleSubmit} disabled={isLoading || !originalImage || !prompt} className="w-full bg-blue-600 text-white px-6 py-2 rounded-md disabled:bg-gray-500 flex items-center justify-center">
                       {isLoading ? <LoadingSpinner/> : 'Edit Image'}
                    </button>
                    {error && <p className="text-red-400">{error}</p>}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-center font-semibold mb-2">Original</h3>
                        {originalImageUrl && <img src={originalImageUrl} alt="Original" className="rounded-lg w-full h-auto object-contain" />}
                    </div>
                    <div>
                        <h3 className="text-center font-semibold mb-2">Edited</h3>
                        {isLoading && <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>}
                        {editedImageUrl && <img src={editedImageUrl} alt="Edited" className="rounded-lg w-full h-auto object-contain" />}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ImageAnalyzer: React.FC = () => {
    // This is similar to ImageEditor but uses a different API call.
    // For brevity, combining with a similar UI.
    const [prompt, setPrompt] = useState('Describe this image.');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
            setAnalysis('');
        }
    };
    
    const handleSubmit = async () => {
        if (!prompt.trim() || !imageFile) return;
        setIsLoading(true);
        setAnalysis('');
        setError('');
        try {
            const base64 = await fileToBase64(imageFile);
            const result = await api.analyzeImage(prompt, base64, imageFile.type);
            setAnalysis(result);
        } catch(e) {
            setError('Failed to analyze image.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <div className="flex-1 space-y-4">
                    <label className="block w-full cursor-pointer bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500">
                        <UploadIcon className="mx-auto h-12 w-12 text-gray-400"/>
                        <span className="mt-2 block text-sm font-medium text-gray-300">
                            {imageFile ? imageFile.name : 'Click to upload an image'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden"/>
                    </label>
                    {imageUrl && <img src={imageUrl} alt="For analysis" className="rounded-lg w-full h-auto object-contain max-h-64" />}
                </div>
                <div className="flex-1 flex flex-col space-y-4">
                     <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="What is in this image?"
                    />
                    <button onClick={handleSubmit} disabled={isLoading || !imageFile || !prompt} className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:bg-gray-500 flex items-center justify-center">
                       {isLoading ? <LoadingSpinner/> : 'Analyze'}
                    </button>
                    {error && <p className="text-red-400">{error}</p>}
                    {(isLoading || analysis) && (
                        <div className="bg-gray-800 p-4 rounded-lg flex-1 overflow-y-auto">
                            <h3 className="font-semibold mb-2">Analysis</h3>
                            {isLoading && <p>Analyzing...</p>}
                            <p className="whitespace-pre-wrap">{analysis}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [videoUrl, setVideoUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const operationRef = useRef<VeoOperation | null>(null);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success after dialog opens to avoid race condition
            setApiKeySelected(true);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
        }
    };

    const pollOperation = useCallback(async (op: VeoOperation) => {
        operationRef.current = op;
        while (operationRef.current && !operationRef.current.done) {
            setLoadingMessage('Processing video... this can take a few minutes.');
            await new Promise(resolve => setTimeout(resolve, 10000));
            try {
                operationRef.current = await api.checkVideoOperation(operationRef.current);
            } catch (e) {
                setError('Failed to check video status. The API key might be invalid.');
                setIsLoading(false);
                // Reset key selection state
                setApiKeySelected(false);
                return;
            }
        }
        if (operationRef.current?.done) {
            const uri = operationRef.current.response?.generatedVideos?.[0]?.video?.uri;
            if (uri) {
                const downloadUrl = `${uri}&key=${process.env.API_KEY}`;
                const response = await fetch(downloadUrl);
                const blob = await response.blob();
                setVideoUrl(URL.createObjectURL(blob));
            } else {
                setError('Video generation completed, but no video was returned.');
            }
            setIsLoading(false);
        }
    }, []);

    const handleSubmit = async () => {
        if (!prompt.trim() || !imageFile) return;
        setIsLoading(true);
        setVideoUrl('');
        setError('');
        setLoadingMessage('Starting video generation...');
        try {
            const base64 = await fileToBase64(imageFile);
            const initialOp = await api.generateVideo(prompt, base64, imageFile.type, aspectRatio);
            await pollOperation(initialOp);
        } catch (e: any) {
             if (e.message?.includes("Requested entity was not found")) {
                 setError("API Key error. Please select your API key again.");
                 setApiKeySelected(false);
             } else {
                 setError('Failed to start video generation.');
             }
            console.error(e);
            setIsLoading(false);
        }
    };

    if (!apiKeySelected) {
        return (
            <div className="text-center p-8 bg-gray-800 rounded-lg">
                <h2 className="text-xl font-bold mb-4">API Key Required for Veo</h2>
                <p className="mb-4">Video generation requires a project with billing enabled. Please select your API key to continue.</p>
                <p className="text-sm text-gray-400 mb-4">For more info, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">billing documentation</a>.</p>
                <button onClick={handleSelectKey} className="bg-blue-600 text-white px-6 py-2 rounded-md">
                    Select API Key
                </button>
                {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                     <label className="block w-full cursor-pointer bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-blue-500">
                        <UploadIcon className="mx-auto h-10 w-10 text-gray-400"/>
                        <span className="mt-2 block text-sm font-medium text-gray-300">
                            {imageFile ? imageFile.name : 'Upload starting image'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden"/>
                    </label>
                    {imageUrl && <img src={imageUrl} alt="Start frame" className="rounded-lg w-full object-contain max-h-48" />}
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="A cinematic shot of..."
                    />
                    <div className="flex items-center space-x-4">
                         <button onClick={handleSubmit} disabled={isLoading || !imageFile || !prompt} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-md disabled:bg-gray-500 flex items-center justify-center">
                            {isLoading ? <LoadingSpinner/> : 'Generate Video'}
                        </button>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')} className="bg-gray-800 border border-gray-700 rounded-lg p-2">
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="9:16">9:16 (Portrait)</option>
                        </select>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                    {isLoading && <div className="text-center space-y-4"><LoadingSpinner /><p>{loadingMessage}</p></div>}
                    {!isLoading && videoUrl && <video src={videoUrl} controls autoPlay loop className="rounded-lg max-w-full max-h-full"></video>}
                    {!isLoading && !videoUrl && <p className="text-gray-400">Your generated video will appear here.</p>}
                    {error && <p className="text-red-400">{error}</p>}
                </div>
            </div>
        </div>
    );
};

const LiveAgent: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState('Not connected. Press Start to talk.');
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const startSession = async () => {
        setIsSessionActive(true);
        setStatus('Connecting...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Fix: Cast window to any to allow webkitAudioContext for cross-browser compatibility
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            // Fix: Cast window to any to allow webkitAudioContext for cross-browser compatibility
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromiseRef.current = api.connectLive({
                onopen: () => {
                    setStatus('Connected! You can start talking.');
                    mediaStreamSourceRef.current = audioContextRef.current!.createMediaStreamSource(stream);
                    scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(audioContextRef.current.destination);
                },
                onmessage: async (message) => {
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContextRef.current.destination);
                        source.addEventListener('ended', () => {
                            audioQueueRef.current.delete(source);
                        });
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        audioQueueRef.current.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                         for (const source of audioQueueRef.current.values()) {
                            source.stop();
                         }
                         audioQueueRef.current.clear();
                         nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e) => {
                    console.error('Live session error:', e);
                    setStatus('Connection error. Please try again.');
                    stopSession();
                },
                onclose: () => {
                    setStatus('Connection closed.');
                    stopSession(false);
                },
            });

        } catch (err) {
            console.error('Failed to get user media', err);
            setStatus('Microphone access denied. Please enable it in your browser settings.');
            setIsSessionActive(false);
        }
    };
    
    const stopSession = (shouldClose = true) => {
        if (sessionPromiseRef.current && shouldClose) {
            sessionPromiseRef.current.then(session => session.close());
        }
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        audioContextRef.current?.close();
        
        for (const source of audioQueueRef.current.values()) {
          source.stop();
        }
        audioQueueRef.current.clear();
        
        outputAudioContextRef.current?.close();
        
        setIsSessionActive(false);
        setStatus('Not connected. Press Start to talk.');
        sessionPromiseRef.current = null;
    };

    return (
        <div className="text-center space-y-6 p-8 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-bold">Live Conversation with Hareram</h2>
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}>
                <LiveIcon className="w-12 h-12 text-white" />
            </div>
            <p className="text-lg text-gray-300">{status}</p>
            <div>
                {!isSessionActive ? (
                    <button onClick={startSession} className="bg-blue-600 text-white px-8 py-3 rounded-full font-semibold">Start Session</button>
                ) : (
                    <button onClick={() => stopSession()} className="bg-red-600 text-white px-8 py-3 rounded-full font-semibold">Stop Session</button>
                )}
            </div>
        </div>
    );
};

const TextToSpeech: React.FC = () => {
    const [text, setText] = useState('Hello, I am Hareram. How can I help you today?');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const handleSpeak = async () => {
        if (!text.trim()) return;
        setIsLoading(true);
        setError('');
        
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        
        try {
            if (!audioContextRef.current) {
                // Fix: Cast window to any to allow webkitAudioContext for cross-browser compatibility
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            }
            const base64Audio = await api.generateSpeech(text);
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
            
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
            audioSourceRef.current = source;
        } catch (e) {
            setError('Failed to generate speech.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
             <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter text to speak..."
            />
            <button
                onClick={handleSpeak}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:bg-gray-500 flex items-center justify-center space-x-2"
            >
                {isLoading ? <LoadingSpinner/> : <SpeakerIcon className="w-5 h-5"/>}
                <span>Speak</span>
            </button>
             {error && <p className="text-red-400">{error}</p>}
        </div>
    );
};


// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [currentFeature, setCurrentFeature] = useState<Feature>(Feature.CHAT);

  const renderFeature = () => {
    switch (currentFeature) {
      case Feature.CHAT:
        return <Chatbot />;
      case Feature.TEXT_GEN:
        return <TextGenerator />;
      case Feature.IMAGE_GEN:
        return <ImageGenerator />;
      case Feature.IMAGE_EDIT:
        return <ImageEditor />;
      case Feature.IMAGE_ANALYZE:
        return <ImageAnalyzer />;
      case Feature.VIDEO_GEN:
        return <VideoGenerator />;
      case Feature.LIVE_AGENT:
          return <LiveAgent />;
      case Feature.TTS:
          return <TextToSpeech/>
      default:
        return <p>Select a feature</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col p-4 md:p-6">
      <header className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Hareram AI
        </h1>
        <p className="text-gray-400 mt-2">Your all-in-one AI assistant powered by Gemini</p>
      </header>
      
      <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <FeatureButton feature={Feature.CHAT} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <ChatIcon className="w-8 h-8"/>
        </FeatureButton>
        <FeatureButton feature={Feature.TEXT_GEN} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <TextIcon className="w-8 h-8"/>
        </FeatureButton>
        <FeatureButton feature={Feature.IMAGE_GEN} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <SparklesIcon className="w-8 h-8"/>
        </FeatureButton>
        <FeatureButton feature={Feature.IMAGE_EDIT} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <ImageIcon className="w-8 h-8"/>
        </FeatureButton>
        <FeatureButton feature={Feature.IMAGE_ANALYZE} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <ImageIcon className="w-8 h-8 text-blue-300"/>
        </FeatureButton>
         <FeatureButton feature={Feature.VIDEO_GEN} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <VideoIcon className="w-8 h-8"/>
        </FeatureButton>
         <FeatureButton feature={Feature.LIVE_AGENT} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <LiveIcon className="w-8 h-8"/>
        </FeatureButton>
        <FeatureButton feature={Feature.TTS} currentFeature={currentFeature} onClick={setCurrentFeature}>
          <SpeakerIcon className="w-8 h-8"/>
        </FeatureButton>
      </nav>

      <main className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl p-4 md:p-6 shadow-2xl shadow-black/20">
        {renderFeature()}
      </main>
    </div>
  );
};

export default App;