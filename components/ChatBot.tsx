import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { getChatResponseStream } from '../services/geminiService';
import { ChatIcon } from './icons/ChatIcon';
import { SendIcon } from './icons/SendIcon';
import { GenerateContentResponse } from '@google/genai';

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '¡Hola! Soy el Bot Pro de Suspensión. ¿Cómo puedo ayudarte hoy con tus preguntas sobre suspensión?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const stream = await getChatResponseStream(messages, input);
        let modelResponseText = '';
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        
        for await (const chunk of stream) {
            const chunkText = (chunk as GenerateContentResponse).text;
            modelResponseText += chunkText;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { role: 'model', text: modelResponseText };
                return newMessages;
            });
        }
    } catch (error) {
      console.error('Error streaming chat response:', error);
      const errorMessage: ChatMessage = { role: 'model', text: 'Lo siento, encontré un error. Por favor, intenta de nuevo.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-yellow-400 text-black p-3 rounded-full shadow-lg hover:bg-yellow-500 transition-transform transform hover:scale-110"
        aria-label="Abrir Chat"
      >
        <ChatIcon className="w-8 h-8" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-md h-full max-h-[70vh] bg-gray-900 border-2 border-yellow-400 rounded-lg shadow-2xl flex flex-col z-50">
      <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center">
            <ChatIcon className="h-8 w-8 text-yellow-400 mr-3" />
            <h3 className="text-lg font-bold text-white">Bot Pro de Suspensión</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && <ChatIcon className="w-6 h-6 text-yellow-400 flex-shrink-0 mb-1" />}
            <div className={`max-w-xs md:max-w-sm lg:max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="text-sm break-words">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex items-end gap-2 justify-start">
                <ChatIcon className="w-6 h-6 text-yellow-400 flex-shrink-0 mb-1" />
                <div className="p-3 rounded-lg bg-gray-700">
                    <div className="flex gap-1.5 items-center">
                        <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></span>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Haz una pregunta..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-l-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading} className="bg-yellow-400 text-black px-4 py-2 rounded-r-md hover:bg-yellow-500 disabled:bg-yellow-700">
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
