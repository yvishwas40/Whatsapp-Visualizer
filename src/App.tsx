import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import UploadPage from './components/UploadPage';
import { Chat } from './types';
import './App.css';

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    // Apply dark mode class to body
    document.body.className = darkMode ? 'dark-mode' : '';
  }, [darkMode]);

  const fetchChats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/chats');
      if (response.ok) {
        const chatsData = await response.json();
        setChats(chatsData);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchChats();
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/chat/${chatId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setChats(chats.filter(chat => chat.id !== chatId));
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading chats...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className={`app ${darkMode ? 'dark' : ''}`}>
        <Routes>
          <Route path="/upload" element={
            <UploadPage onUploadSuccess={handleUploadSuccess} />
          } />
          <Route path="/chat/:chatId?" element={
            <div className="chat-container">
              <Sidebar 
                chats={chats}
                selectedChatId={selectedChatId}
                onSelectChat={setSelectedChatId}
                onDeleteChat={handleDeleteChat}
                darkMode={darkMode}
                onToggleDarkMode={toggleDarkMode}
              />
              <ChatWindow 
                chatId={selectedChatId}
                darkMode={darkMode}
              />
            </div>
          } />
          <Route path="/" element={<Navigate to="/chat" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;