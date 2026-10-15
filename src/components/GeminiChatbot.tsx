import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Globe, 
  ExternalLink, 
  Bot, 
  User, 
  RotateCcw, 
  ShoppingBag,
  HelpCircle,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { ChatMessage, Product } from '../types';

interface GeminiChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialQuery?: string;
  onOpenProductByName?: (name: string) => void;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  isOpen,
  onClose,
  products,
  initialQuery = '',
  onOpenProductByName,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Namaskaram! 🙏 I am **YEM Concierge**, your personal shopping assistant for **YEM MART**.

How can I help you today?
• Recommend gifts, fashion, tech & kitchen essentials
• Answer questions about Kerala delivery (Ernakulam, Trivandrum, Calicut, etc.)
• Guide you through WhatsApp ordering & UPI payment verification
• Check live specs and festival trends with **Google Search Grounding**

Feel free to ask in **English** or **Malayalam / Manglish**!`,
      timestamp: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle initialQuery when passed from parent
  useEffect(() => {
    if (initialQuery && isOpen) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery, isOpen]);

  const handleSendMessage = async (textToSend = input) => {
    const text = textToSend.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build lightweight product context to feed to server
      const productSummary = products
        .slice(0, 10)
        .map((p) => `${p.name} (${p.category}, ₹${p.price})`)
        .join('; ');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          productContext: productSummary,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'model',
        content: data.text || 'I am ready to help you with anything related to YEM MART.',
        timestamp: new Date().toISOString(),
        searchGrounding: data.searchGrounding || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chatbot error:', err);
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `I'm currently unable to reach the AI engine (${err.message || 'Network issue'}).\n\nFor immediate assistance, please connect with our team directly on WhatsApp (+91 7510447887) or browse our categories above.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content: `Namaskaram! How can I assist you today with YEM MART collections or Kerala delivery?`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  if (!isOpen) return null;

  const quickPrompts = [
    'Best deals today on electronics & fashion?',
    'Delivery time for Ernakulam & Thrissur?',
    'Recommend traditional Kerala gift hampers',
    'How do I order via WhatsApp?',
    'Dosa tawa specs & pre-seasoning details',
  ];

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[420px] sm:h-[620px] flex flex-col bg-white sm:rounded-3xl shadow-2xl border border-neutral-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-[#171717] text-white flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C9A44C] text-[#171717] flex items-center justify-center font-black text-sm shadow-sm">
            <Sparkles className="w-4 h-4 fill-[#171717]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight text-white">YEM Concierge</h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-[#C9A44C] font-semibold border border-neutral-700">
                gemini-3.5-flash
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Google Search Grounding Enabled</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={resetChat}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Clear Chat History"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Close Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F6F2]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-[#171717] text-[#C9A44C] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                  isUser
                    ? 'bg-[#171717] text-white rounded-tr-none'
                    : 'bg-white text-neutral-800 border border-[#E7E5E0] rounded-tl-none'
                }`}
              >
                {/* Formatted Text rendering with basic markdown bullets */}
                <div className="whitespace-pre-line space-y-1">
                  {msg.content}
                </div>

                {/* Google Search Grounding Citations */}
                {msg.searchGrounding && msg.searchGrounding.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-1.5">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3 h-3 text-[#C9A44C]" />
                      <span>Google Search Grounding Sources:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.searchGrounding.map((item, idx) => (
                        <a
                          key={idx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-100 hover:bg-amber-100/60 text-[11px] text-neutral-700 font-medium transition-colors border border-neutral-200"
                        >
                          <span className="truncate max-w-[150px]">{item.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-[#C9A44C] text-[#171717] flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <div className="w-7 h-7 rounded-lg bg-[#171717] text-[#C9A44C] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white px-4 py-2.5 rounded-2xl border border-[#E7E5E0] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C9A44C] animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-[#C9A44C] animate-bounce delay-100"></span>
              <span className="w-2 h-2 rounded-full bg-[#C9A44C] animate-bounce delay-200"></span>
              <span className="text-[11px] text-neutral-400 ml-1">Searching & composing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips */}
      <div className="px-3 py-2 bg-white border-t border-[#E7E5E0] overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-[#F7F6F2] hover:bg-neutral-200 text-neutral-700 text-[11px] font-medium whitespace-nowrap transition-colors border border-neutral-200 shrink-0"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-[#E7E5E0]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything in English or Malayalam/Manglish..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-[#171717] text-white hover:bg-[#C9A44C] hover:text-[#171717] disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-neutral-400 text-center mt-1.5">
          Grounded with Google Search • Supports Manglish & Malayalam
        </p>
      </div>
    </div>
  );
};
