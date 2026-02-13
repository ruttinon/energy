import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Lightbulb, TrendingUp } from 'lucide-react';

const AIChat = ({ projectId, apiBase }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAIAvailable, setIsAIAvailable] = useState(false);
  const [quickActions, setQuickActions] = useState([
    { label: 'วิเคราะห์การใช้พลังงาน', icon: TrendingUp, action: 'analyze' },
    { label: 'ตรวจจับความผิดปกติ', icon: AlertCircle, action: 'anomalies' },
    { label: 'แนะนำการประหยัด', icon: Lightbulb, action: 'recommendations' },
    { label: 'ทำนายการใช้พลังงาน', icon: Bot, action: 'predict' }
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    checkAIStatus();
    if (projectId) {
      setMessages([{
        type: 'system',
        content: `🤖 EnergyLink AI พร้อมช่วยเหลือ! โปรเจค: ${projectId}`,
        timestamp: new Date().toISOString()
      }]);
    }
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkAIStatus = async () => {
    try {
      const response = await fetch(`${apiBase}/api/ai/status`);
      const data = await response.json();
      setIsAIAvailable(data.available);
    } catch (error) {
      console.error('AI status check failed:', error);
      setIsAIAvailable(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message) => {
    if (!message.trim() || !isAIAvailable) return;

    const userMessage = {
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBase}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          project_id: projectId
        })
      });

      const data = await response.json();

      const aiMessage = {
        type: 'ai',
        content: data.response,
        timestamp: data.timestamp,
        model: data.model
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        type: 'error',
        content: 'ขออภัย ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action) => {
    let message = '';
    
    switch (action) {
      case 'analyze':
        message = 'วิเคราะห์การใช้พลังงานของฉันในช่วง 7 วันล่าสุด';
        break;
      case 'anomalies':
        message = 'ตรวจสอบว่ามีการใช้พลังงานผิดปกติในช่วง 24 ชั่วโมงที่ผ่านมาหรือไม่';
        break;
      case 'recommendations':
        message = 'แนะนำวิธีการประหยัดพลังงานให้ฉันหน่อย';
        break;
      case 'predict':
        message = 'ทำนายการใช้พลังงานในช่วง 24 ชั่วโมงข้างหน้า';
        break;
      default:
        return;
    }
    
    await handleSendMessage(message);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  if (!isAIAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Bot className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Service ไม่พร้อมใช้งาน</h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          กรุณาติดตั้งและเริ่มต้น Ollama ก่อนใช้งานฟีเจอร์ AI
        </p>
        <div className="bg-gray-100 p-3 rounded-lg text-xs text-gray-600 max-w-md">
          <p className="font-medium mb-1">วิธีติดตั้ง:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>ดาวน์โหลด Ollama จาก ollama.ai</li>
            <li>ติดตั้งและรัน Ollama</li>
            <li>ดาวน์โหลดโมเดล: ollama pull llama3.2</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">EnergyLink AI Assistant</h3>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-gray-500">Online</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.action)}
              className="flex items-center space-x-2 p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <action.icon className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 ${
              message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.type === 'user' 
                ? 'bg-blue-600 text-white' 
                : message.type === 'error'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {message.type === 'user' ? (
                <User className="w-4 h-4" />
              ) : message.type === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div className={`max-w-xs lg:max-w-md ${
              message.type === 'user' ? 'text-right' : ''
            }`}>
              <div className={`inline-block p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(message.timestamp).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {message.model && ` • ${message.model}`}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-gray-600" />
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="ถาม AI เกี่ยวกับพลังงานของคุณ..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
