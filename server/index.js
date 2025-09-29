const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const chatId = req.params.chatId || `chat_${Date.now()}`;
    const chatDir = path.join(uploadsDir, chatId);
    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }
    cb(null, chatDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// --- Utility to clean hidden chars ---
function cleanLine(line) {
  return line
    .replace(/\u200e/g, '')  // LRM
    .replace(/\u202f/g, ' ') // narrow no-break space → normal space
    .trim();
}

// --- Unified WhatsApp regex ---
// Handles:
//   11/2/22, 4:30 PM - Abhilash: ...
//   11/14/22, 13:02 - Vishwa: ...
//   [16/04/23, 8:49:16 PM] Rida: ...
const messageRegex = /^[\[\(]?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)?[\]\)]?\s*[-–]?\s*([^:]+)?:?\s?(.*)$/;

// --- Parse WhatsApp chat file ---
function parseWhatsAppChat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const messages = [];
  let currentMessage = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = cleanLine(rawLine);
    if (!line) continue;

    const match = line.match(messageRegex);

    if (match) {
      if (currentMessage) messages.push(currentMessage);

      const [, date, time = '00:00', sender, content] = match;
      const timestampStr = `${date} ${time}`;
      const hasSender = sender && sender.trim().length > 0;

      currentMessage = {
        id: messages.length + 1,
        timestamp: parseDateTime(date, time) || new Date().toISOString(),
        sender: hasSender ? sender.trim() : 'System',
        content: content.trim(),
        type: hasSender ? 'text' : 'system',
        media: null,
        mediaType: null
      };

      // --- Media detection ---
      if (/^<media omitted>$/i.test(content) || /^<attached:/i.test(content) || content.includes('(file attached)')) {
        currentMessage.type = 'media';
        const attachedMatch = content.match(/^<attached:\s*(.+?)>$/i);
        if (attachedMatch) {
          currentMessage.media = attachedMatch[1].trim();
        }
        const fileAttachedMatch = content.match(/^(.+?)\s*\(file attached\)$/);
        if (fileAttachedMatch) {
          currentMessage.media = fileAttachedMatch[1].trim();
        }
      }

      // --- Deleted messages ---
      if (content.includes('This message was deleted') || content.includes('You deleted this message')) {
        currentMessage.type = 'deleted';
        currentMessage.content = 'This message was deleted';
      }

      // --- System messages ---
      if (!hasSender && content.includes('Messages and calls are end-to-end encrypted')) {
        currentMessage = null; // skip
      }

    } else if (currentMessage) {
      // Continuation or filename
      if (currentMessage.type === 'media' && !currentMessage.media) {
        const looksLikeFilename = /\.[a-zA-Z0-9]+$/.test(line);
        if (looksLikeFilename) {
          currentMessage.media = line.replace(/\.$/, '');
        } else {
          currentMessage.content += '\n' + line;
        }
      } else {
        currentMessage.content += '\n' + line;
      }
    }
  }

  if (currentMessage) messages.push(currentMessage);
  return messages;
}

// --- Format WhatsApp message content ---
function formatMessageContent(content) {
  content = content.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  content = content.replace(/_([^_]+)_/g, '<em>$1</em>');
  content = content.replace(/~([^~]+)~/g, '<del>$1</del>');
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  return content;
}

// --- Upload chat folder ---
app.post('/api/upload/:chatId', upload.array('files'), (req, res) => {
  try {
    const chatId = req.params.chatId;
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const txtFile = files.find(file => file.originalname.endsWith('.txt'));
    if (!txtFile) {
      return res.status(400).json({ error: 'No .txt chat file found' });
    }

    const messages = parseWhatsAppChat(txtFile.path);
    const mediaFiles = files.filter(file => !file.originalname.endsWith('.txt'));

    let mediaIndex = 0;
    const processedMessages = messages.map(message => {
      if (message.type === 'media') {
        if (message.media) {
          const mediaFile = mediaFiles.find(file => {
            const fn = file.originalname.toLowerCase();
            const mn = message.media.toLowerCase();
            return fn === mn ||
                   path.parse(fn).name === path.parse(mn).name ||
                   fn.includes(path.parse(mn).name);
          });
          if (mediaFile) {
            message.mediaPath = `/uploads/${chatId}/${mediaFile.filename}`;
            message.mediaType = getMediaType(mediaFile.filename);
            message.media = mediaFile.originalname;
          }
        } else if (mediaIndex < mediaFiles.length) {
          const file = mediaFiles[mediaIndex++];
          message.mediaPath = `/uploads/${chatId}/${file.filename}`;
          message.mediaType = getMediaType(file.filename);
          message.media = file.originalname;
        }
      }
      if (message.type === 'text') {
        message.content = formatMessageContent(message.content);
      }
      return message;
    });

    const chatData = {
      id: chatId,
      name: chatId.replace(/_/g, ' '),
      messages: processedMessages,
      participants: [...new Set(processedMessages.map(m => m.sender))],
      createdAt: new Date().toISOString()
    };

    const chatDataPath = path.join(uploadsDir, chatId, 'chat_data.json');
    fs.writeFileSync(chatDataPath, JSON.stringify(chatData, null, 2));

    res.json({ success: true, chatId, messageCount: processedMessages.length });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process chat upload' });
  }
});

// --- Media type detection ---
function getMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.avi'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg'].includes(ext)) return 'audio';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'document';
  if (['.xls', '.xlsx'].includes(ext)) return 'spreadsheet';
  return 'file';
}

function parseDateTime(dateStr, timeStr = "00:00") {
  try {
    // Normalize inputs
    dateStr = dateStr.replace(/\u200e|\u202f/g, '').trim();
    timeStr = (timeStr || "00:00").replace(/\u200e|\u202f/g, '').trim();

    // Split date
    const [d, m, y] = dateStr.split(/[\/\.\-]/);
    if (!d || !m || !y) return null;
    let year = y.length === 2 ? `20${y}` : y;

    // Split time
    let [time, modifier] = timeStr.split(/\s/);
    let [hh, mm, ss = "00"] = time.split(':');
    hh = parseInt(hh, 10);
    mm = parseInt(mm, 10);
    ss = parseInt(ss, 10);

    if (isNaN(hh) || isNaN(mm) || isNaN(ss)) return null;

    // Handle AM/PM
    if (modifier && /pm/i.test(modifier) && hh < 12) hh += 12;
    if (modifier && /am/i.test(modifier) && hh === 12) hh = 0;

    // Return ISO string
    return new Date(
      `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}Z`
    ).toISOString();
  } catch (err) {
    return null;
  }
}



// --- Get all chats ---
app.get('/api/chats', (req, res) => {
  try {
    const chats = [];
    const chatDirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const chatId of chatDirs) {
      const chatDataPath = path.join(uploadsDir, chatId, 'chat_data.json');
      if (fs.existsSync(chatDataPath)) {
        const chatData = JSON.parse(fs.readFileSync(chatDataPath, 'utf-8'));
        chats.push({
          id: chatData.id,
          name: chatData.name,
          participantCount: chatData.participants.length,
          messageCount: chatData.messages.length,
          lastMessage: chatData.messages[chatData.messages.length - 1],
          createdAt: chatData.createdAt
        });
      }
    }
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// --- Get specific chat ---
app.get('/api/chat/:chatId', (req, res) => {
  try {
    const chatId = req.params.chatId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';

    const chatDataPath = path.join(uploadsDir, chatId, 'chat_data.json');
    if (!fs.existsSync(chatDataPath)) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chatData = JSON.parse(fs.readFileSync(chatDataPath, 'utf-8'));
    let messages = chatData.messages;

    if (search) {
      messages = messages.filter(message =>
        message.content.toLowerCase().includes(search.toLowerCase()) ||
        message.sender.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = messages.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMessages = messages.slice(startIndex, endIndex);

    res.json({
      ...chatData,
      messages: paginatedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: endIndex < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// --- Delete chat ---
app.delete('/api/chat/:chatId', (req, res) => {
  try {
    const chatId = req.params.chatId;
    const chatDir = path.join(uploadsDir, chatId);
    if (fs.existsSync(chatDir)) {
      fs.rmSync(chatDir, { recursive: true, force: true });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Chat not found' });
    }
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
