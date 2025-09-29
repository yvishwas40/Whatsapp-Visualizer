import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, FileText, Image, File, Trash2, ArrowDown } from 'lucide-react';
import { Chat, Message } from '../types';

interface ChatWindowProps {
  chatId: string | null;
  darkMode: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, darkMode }) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatId) {
      fetchChat(1, true);
    } else {
      setChat(null);
      setMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    if (searchTerm) {
      setCurrentPage(1);
      fetchChat(1, true, searchTerm);
    } else if (chatId) {
      setCurrentPage(1);
      fetchChat(1, true);
    }
  }, [searchTerm]);

  const fetchChat = async (page: number = 1, reset: boolean = false, search: string = '') => {
    if (!chatId || loading) return;

    setLoading(true);
    try {
      const url = new URL(`http://localhost:3001/api/chat/${chatId}`);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', '50');
      if (search) url.searchParams.set('search', search);

      const response = await fetch(url);
      if (response.ok) {
        const chatData = await response.json();
        setChat(chatData);
        
        if (reset) {
          setMessages(chatData.messages);
        } else {
          setMessages(prev => [...prev, ...chatData.messages]);
        }
        
        setHasMore(chatData.pagination.hasNext);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchChat(currentPage + 1, false, searchTerm);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const renderMediaContent = (message: Message) => {
    // If we have a mediaPath, try to load the actual media
    if (message.mediaPath) {
      const mediaUrl = `http://localhost:3001${message.mediaPath}`;

      switch (message.mediaType) {
        case 'image':
          return (
            <div className="media-content">
              <img 
                src={mediaUrl} 
                alt={message.media || 'Shared image'} 
                className="message-image"
                loading="lazy"
                onError={(e) => {
                  // If image fails to load, show fallback with download
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                  }
                }}
              />
              <div className="media-fallback" style={{ display: 'none' }}>
                <div className="file-attachment">
                  <div className="file-icon">
                    <Image size={20} color="#25d366" />
                  </div>
                  <div className="file-info">
                    <span className="file-name">{message.media}</span>
                    <a 
                      href={mediaUrl} 
                      download 
                      className="download-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={16} />
                      Download Image
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        case 'video':
          return (
            <div className="media-content">
              <video controls className="message-video">
                <source src={mediaUrl} />
                Your browser does not support the video tag.
              </video>
              <div className="media-info">
                <small>{message.media}</small>
                <a 
                  href={mediaUrl} 
                  download 
                  className="download-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={16} />
                  Download Video
                </a>
              </div>
            </div>
          );
        case 'audio':
          return (
            <div className="media-content">
              <audio controls className="message-audio">
                <source src={mediaUrl} />
                Your browser does not support the audio tag.
              </audio>
              <div className="media-info">
                <small>{message.media}</small>
                <a 
                  href={mediaUrl} 
                  download 
                  className="download-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={16} />
                  Download Audio
                </a>
              </div>
            </div>
          );
        default:
          const getFileIcon = () => {
            switch (message.mediaType) {
              case 'pdf': return <FileText size={20} color="#e74c3c" />;
              case 'document': return <FileText size={20} color="#3498db" />;
              case 'spreadsheet': return <FileText size={20} color="#27ae60" />;
              default: return <File size={20} />;
            }
          };

          return (
            <div className="file-attachment">
              <div className="file-icon">
                {getFileIcon()}
              </div>
              <div className="file-info">
                <span className="file-name">{message.media}</span>
                <a 
                  href={mediaUrl} 
                  download 
                  className="download-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={16} />
                  Download
                </a>
              </div>
            </div>
          );
      }
    }

    // Fallback when no mediaPath is available
    return (
      <div className="media-fallback">
        <div className="file-attachment">
          <div className="file-icon">
            <File size={20} />
          </div>
          <div className="file-info">
            <span className="file-name">{message.media || 'Media file'}</span>
            <em className="unavailable-text">File not found</em>
          </div>
        </div>
      </div>
    );
  };

  const renderMessage = (message: Message, index: number) => {
    const prevMessage = messages[index - 1];
    const showDate = !prevMessage || 
      new Date(message.timestamp).toDateString() !== new Date(prevMessage.timestamp).toDateString();
    const showSender = !prevMessage || prevMessage.sender !== message.sender;

    return (
      <React.Fragment key={message.id}>
        {showDate && (
          <div className="date-separator">
            <span>{formatDate(message.timestamp)}</span>
          </div>
        )}
        <div className={`message ${message.sender === 'You' ? 'own' : 'other'}`}>
          {showSender && message.sender !== 'You' && (
            <div className="sender-name">{message.sender}</div>
          )}
          <div className="message-content">
            {message.type === 'deleted' ? (
              <div className="deleted-message">
                <Trash2 size={16} />
                <em>{message.content}</em>
              </div>
            ) : message.type === 'media' ? (
              renderMediaContent(message)
            ) : (
              <div 
                dangerouslySetInnerHTML={{ __html: message.content }}
                className="text-content"
              />
            )}
            <div className="message-time">
              {formatTime(message.timestamp)}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  if (!chatId) {
    return (
      <div className="chat-window-empty">
        <div className="empty-chat-state">
          <Image size={64} />
          <h3>Welcome to WhatsApp Viewer</h3>
          <p>Select a chat from the sidebar to view your conversations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {chat && (
        <div className="chat-header">
          <div className="chat-info">
            <h3>{chat.name}</h3>
            <span>{chat.participantCount} participants • {chat.messageCount} messages</span>
          </div>
          <div className="chat-actions">
            <div className="search-container">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search in chat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="messages-container" ref={chatContainerRef}>
        <div className="messages">
          {messages.map((message, index) => renderMessage(message, index))}
          <div ref={messagesEndRef} />
        </div>
        
        {hasMore && (
          <button 
            className="load-more-button"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load older messages'}
          </button>
        )}
      </div>

      <button 
        className="scroll-to-bottom"
        onClick={scrollToBottom}
        title="Scroll to bottom"
      >
        <ArrowDown size={20} />
      </button>
    </div>
  );
};

export default ChatWindow;