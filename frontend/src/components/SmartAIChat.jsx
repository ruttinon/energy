import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Lightbulb, TrendingUp, ThumbsUp, ThumbsDown, Brain, RefreshCw } from 'lucide-react';

const SmartAIChat = ({ projectId, apiBase }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAIAvailable, setIsAIAvailable] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [learningInsights, setLearningInsights] = useState(null);
  const [showLearningPanel, setShowLearningPanel] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    checkAIStatus();
    if (projectId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      setMessages([{
        type: 'system',
        content: `🤖 EnergyLink AI Assistant พร้อมช่วยเหลือ! โปรเจค: ${projectId}\n\nฉันจะเรียนรู้จากการสนทนาของเราเพื่อให้คำตอบที่ดีขึ้นครับ`,
        timestamp: new Date().toISOString()
      }]);
      loadLearningInsights();
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

  const loadLearningInsights = async () => {
    try {
      const response = await fetch(`${apiBase}/api/ai/learning/${projectId}`);
      const data = await response.json();
      setLearningInsights(data);
    } catch (error) {
      console.error('Failed to load learning insights:', error);
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
          project_id: projectId,
          session_id: sessionId
        })
      });

      const data = await response.json();

      const aiMessage = {
        type: 'ai',
        content: data.response,
        timestamp: data.timestamp,
        model: data.model,
        messageId: data.session_id
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Trigger learning cycle periodically
      if (Math.random() < 0.1) { // 10% chance
        triggerLearning();
      }
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

  const handleFeedback = async (messageIndex, feedback) => {
    try {
      await fetch(`${apiBase}/api/ai/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interaction_id: messageIndex,
          feedback: feedback
        })
      });

      // Update message to show feedback
      setMessages(prev => prev.map((msg, idx) => 
        idx === messageIndex ? { ...msg, userFeedback: feedback } : msg
      ));

      // Reload learning insights
      loadLearningInsights();
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  };

  const triggerLearning = async () => {
    try {
      await fetch(`${apiBase}/api/ai/learn/${projectId}`, {
        method: 'POST'
      });
      console.log('Learning cycle triggered');
    } catch (error) {
      console.error('Failed to trigger learning:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  const smartSuggestions = [
    "วิเคราะห์การใช้พลังงานช่วงนี้ให้ดูหน่อย",
    "พยากรณ์พลังงานวันพรุ่งนี้",
    "มีการใช้พลังงานผิดปกติหรือไม่",
    "แนะนำวิธีประหยัดพลังงานสำหรับระบบของฉัน",
    "สรุปสถานะอุปกรณ์ทั้งหมด"
  ];

  if (!isAIAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Bot className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Service ไม่พร้อมใช้งาน</h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          กรุณาติดตั้งและเริ่มต้น Ollama ก่อนใช้งานฟีเจอร์ AI
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header with Learning Status */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Smart AI Assistant</h3>
          {learningInsights && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500">Learning Active</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowLearningPanel(!showLearningPanel)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Learning Insights"
          >
            <Brain className="w-4 h-4" />
          </button>
          <button
            onClick={triggerLearning}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Trigger Learning"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-gray-500">Online</span>
          </div>
        </div>
      </div>

      {/* Learning Insights Panel */}
      {showLearningPanel && learningInsights && (
        <div className="p-4 bg-purple-50 border-b border-purple-200">
          <h4 className="font-medium text-purple-900 mb-2">AI Learning Insights</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-purple-700 font-medium">Interactions</div>
              <div className="text-purple-900">{learningInsights.total_interactions || 0}</div>
            </div>
            <div>
              <div className="text-purple-700 font-medium">Avg Feedback</div>
              <div className="text-purple-900">
                {learningInsights.average_feedback ? 
                  `${(learningInsights.average_feedback * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-purple-700 font-medium">Sessions</div>
              <div className="text-purple-900">{learningInsights.total_sessions || 0}</div>
            </div>
            <div>
              <div className="text-purple-700 font-medium">Preferences</div>
              <div className="text-purple-900 text-xs">
                {learningInsights.learned_preferences?.preferred_analysis || 'Learning...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-2">คำถามสุภาษิต:</div>
        <div className="flex flex-wrap gap-2">
          {smartSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSendMessage(suggestion)}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
            >
              {suggestion}
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
                : 'bg-purple-100 text-purple-600'
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
                  : 'bg-purple-50 text-purple-900 border border-purple-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              
              {/* Feedback buttons for AI messages */}
              {message.type === 'ai' && !message.userFeedback && (
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-gray-500">คำตอบนี้มีประโยชน์หรือไม่?</span>
                  <button
                    onClick={() => handleFeedback(index, 1)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="ดี"
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleFeedback(index, -1)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="ไม่ดี"
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              {message.userFeedback && (
                <div className={`text-xs mt-1 ${
                  message.userFeedback === 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {message.userFeedback === 1 ? '👍 ขอบคุณสำหรับ feedback' : '👍 ขอบคุณที่ชี้แจง'}
                </div>
              )}
              
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
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-purple-700">กำลังเรียนรู้และตอบ...</span>
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
            placeholder="ถาม AI เกี่ยวกับพลังงานของคุณ... AI จะเรียนรู้จากคุณ"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2 text-center">
          🤖 AI จะเรียนรู้จากการสนทนาของคุณเพื่อให้คำตอบที่เข้าใจคุณมากขึ้น
        </div>
      </div>
    </div>
  );
};

export default SmartAIChat;
