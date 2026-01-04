
import React, { useState } from 'react';
import { Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import { generateMappingAssistant } from '../services/geminiService';

interface AIAssistantProps {
  onClose: () => void;
  onShapesGenerated: (shapes: any[]) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onClose, onShapesGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: "Hello! I'm your LumeMap Assistant. I can help you generate complex geometries, frame structures, or dynamic patterns. Try asking: 'Create a 4-pane window frame' or 'Make a psychedelic hex pattern'." }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userPrompt = prompt;
    setMessages(prev => [...prev, { role: 'user', text: userPrompt }]);
    setPrompt('');
    setIsLoading(true);

    try {
      const result = await generateMappingAssistant(userPrompt);
      if (result && result.shapes) {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: result.explanation || `I've generated ${result.shapes.length} shapes for you. Applying them to the canvas now.` 
        }]);
        onShapesGenerated(result.shapes);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I couldn't generate those shapes. Try a different description." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Something went wrong. Please check your connection." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute right-6 top-24 bottom-24 w-96 flex flex-col bg-slate-900 border border-white/10 rounded-3xl z-50 shadow-2xl overflow-hidden">
      <div className="p-4 bg-slate-800/80 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold text-white">AI Assistant</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-xs text-slate-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-slate-800/50">
        <div className="relative">
          <input 
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a shape or pattern..."
            className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-xl text-white hover:bg-purple-500 disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 text-center uppercase tracking-widest">Powered by Gemini Pro</p>
      </form>
    </div>
  );
};

export default AIAssistant;
