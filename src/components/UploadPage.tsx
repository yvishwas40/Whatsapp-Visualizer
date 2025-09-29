import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

interface UploadPageProps {
  onUploadSuccess: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess }) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    setFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const validateFiles = (fileList: FileList): { isValid: boolean; message: string } => {
    const filesArray = Array.from(fileList);
    const txtFiles = filesArray.filter(file => file.name.endsWith('.txt'));
    
    if (txtFiles.length === 0) {
      return { isValid: false, message: 'Please include at least one .txt chat file' };
    }
    
    if (txtFiles.length > 1) {
      return { isValid: false, message: 'Please include only one .txt chat file per upload' };
    }

    return { isValid: true, message: '' };
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;

    const validation = validateFiles(files);
    if (!validation.isValid) {
      setUploadStatus('error');
      setUploadMessage(validation.message);
      return;
    }

    setUploading(true);
    setUploadStatus('idle');

    try {
      const chatId = `chat_${Date.now()}`;
      const formData = new FormData();
      
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`http://localhost:3001/api/upload/${chatId}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setUploadStatus('success');
        setUploadMessage(`Successfully uploaded chat with ${result.messageCount} messages`);
        onUploadSuccess();
        
        // Redirect to the uploaded chat after a short delay
        setTimeout(() => {
          navigate(`/chat/${chatId}`);
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getFileList = () => {
    if (!files) return [];
    return Array.from(files).map(file => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: file.type || 'Unknown'
    }));
  };

  return (
    <div className="upload-page">
      <div className="upload-header">
        <button onClick={() => navigate('/chat')} className="back-button">
          <ArrowLeft size={20} />
          Back to Chats
        </button>
        <h1>Upload WhatsApp Chat</h1>
        <p>Upload your exported WhatsApp chat folder containing the .txt file and media files</p>
      </div>

      <div className="upload-container">
        <div 
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${files ? 'has-files' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={48} />
          <h3>Drop your chat files here</h3>
          <p>or click to browse and select files</p>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="file-input"
            accept=".txt,image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
        </div>

        {files && (
          <div className="file-list">
            <h4>Selected Files ({files.length})</h4>
            <div className="files">
              {getFileList().map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{file.size}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadStatus !== 'idle' && (
          <div className={`upload-status ${uploadStatus}`}>
            {uploadStatus === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{uploadMessage}</span>
          </div>
        )}

        <div className="upload-actions">
          {files && (
            <button onClick={() => setFiles(null)} className="clear-button">
              <X size={16} />
              Clear Files
            </button>
          )}
          <button 
            onClick={handleUpload}
            disabled={!files || uploading}
            className="upload-button"
          >
            {uploading ? (
              <>
                <div className="spinner"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Chat
              </>
            )}
          </button>
        </div>
      </div>

      <div className="upload-instructions">
        <h3>How to export WhatsApp chat:</h3>
        <ol>
          <li>Open WhatsApp on your phone</li>
          <li>Go to the chat you want to export</li>
          <li>Tap the menu (⋮) and select "More" → "Export chat"</li>
          <li>Choose "Include Media" to export with photos, videos, and documents</li>
          <li>Save the exported files and upload them here</li>
        </ol>
      </div>
    </div>
  );
};

export default UploadPage;