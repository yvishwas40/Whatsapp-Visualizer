import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MessageCircle, 
  Upload, 
  Moon, 
  Sun, 
  Search, 
  Trash2,
  Users,
  MessageSquare
} from 'lucide-react';
import { Chat } from '../types';

interface SidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onDeleteChat,
  darkMode,
  onToggleDarkMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateMessage = (content: string, maxLength: number = 50) => {
    const stripped = content.replace(/<[^>]*>/g, '');
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  };

  const handleChatSelect = (chatId: string) => {
    onSelectChat(chatId);
    navigate(`/chat/${chatId}`);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <MessageCircle size={24} />
          <h2>WhatsApp Viewer</h2>
        </div>
        <div className="sidebar-actions">
          <button 
            onClick={onToggleDarkMode}
            className="icon-button"
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/upload" className="icon-button" title="Upload chat">
            <Upload size={20} />
          </Link>
        </div>
      </div>

      <div className="search-container">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search chats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="chat-list">
        {filteredChats.length === 0 ? (
          <div className="empty-state">
            {chats.length === 0 ? (
              <>
                <MessageSquare size={48} />
                <h3>No chats uploaded</h3>
                <p>Upload your first WhatsApp chat to get started</p>
                <Link to="/upload" className="upload-button">
                  <Upload size={16} />
                  Upload Chat
                </Link>
              </>
            ) : (
              <>
                <Search size={48} />
                <h3>No chats found</h3>
                <p>Try a different search term</p>
              </>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}
              onClick={() => handleChatSelect(chat.id)}
            >
              <div className="chat-avatar">
                <Users size={20} />
              </div>
              <div className="chat-info">
                <div className="chat-header">
                  <h3 className="chat-name">{chat.name}</h3>
                  <span className="chat-time">
                    {chat.lastMessage && formatTime(chat.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="chat-preview">
                  <p className="last-message">
                    {chat.lastMessage ? (
                      <>
                        <span className="sender-name">{chat.lastMessage.sender}: </span>
                        {chat.lastMessage.type === 'deleted' ? (
                          <em>This message was deleted</em>
                        ) : chat.lastMessage.type === 'media' ? (
                          <em>📎 Media</em>
                        ) : (
                          truncateMessage(chat.lastMessage.content)
                        )}
                      </>
                    ) : (
                      'No messages'
                    )}
                  </p>
                  <div className="chat-stats">
                    <span>{chat.messageCount} messages</span>
                    <span>•</span>
                    <span>{chat.participantCount} participants</span>
                  </div>
                </div>
              </div>
              <button
                className="delete-chat"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this chat?')) {
                    onDeleteChat(chat.id);
                  }
                }}
                title="Delete chat"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;