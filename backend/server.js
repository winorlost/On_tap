const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// SỬA DÒNG NÀY: Lấy PORT từ môi trường của Render, nếu không có mới dùng 3000
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Simple JSON DB
let db = {
  users: [],
  subjects: [
    { id: 1, name: 'Toán', name_en: 'Math' },
    { id: 2, name: 'Văn', name_en: 'Literature' },
    { id: 3, name: 'Anh', name_en: 'English' },
    { id: 4, name: 'Hóa', name_en: 'Chemistry' },
    { id: 5, name: 'Lý', name_en: 'Physics' }
  ],
  theory_lessons: [],
  practice_questions: [],
  scores: [],
  music: [],
  calendar: [],
  notifications: [],
  encouragements: [],
  sessions: []
};

// Load DB
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.encouragements) db.encouragements = [];
      if (!db.sessions) db.sessions = [];
      // Remove Programming subject (id: 6) if exists
      db.subjects = db.subjects.filter(s => s.id !== 6);
    }
  } catch (e) { console.log('Load DB error:', e.message); }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass + 'webontap_salt_2024').digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verifyToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  return db.users.find(u => u.token === token) || null;
}

loadDB();

// Ensure default admin
if (!db.users.find(u => u.username === 'admin')) {
  db.users.push({
    id: Date.now(),
    username: 'admin',
    password: hashPassword('admin123'),
    role: 'admin',
    token: '',
    avatar: '',
    created_at: new Date().toISOString()
  });
  saveDB();
}

// Ensure upload dirs
['images', 'music', 'avatars'].forEach(dir => {
  const p = path.join(UPLOADS_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

async function handleUpload(req) {
  return new Promise((resolve, reject) => {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      const boundary = ct.split('boundary=')[1];
      if (!boundary) {
        resolve({});
        return;
      }
      const parts = Buffer.concat(body).toString().split('--' + boundary);
      const result = {};

      parts.forEach(part => {
        const fileMatch = part.match(/name="([^"]+)"[\s\S]*?filename="([^"]*)"[\s\S]*?Content-Type:\s*([^\r\n]+)[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n|$)/);
        if (fileMatch) {
          const name = fileMatch[1];
          const fileName = fileMatch[2];
          const fileContent = fileMatch[4];
          const ext = path.extname(fileName).toLowerCase() || '.bin';
          const newFileName = Date.now() + '_' + Math.random().toString(36).substr(2, 6) + ext;
          
          let subfolder = 'images';
          if (name === 'music') subfolder = 'music';
          if (name === 'avatar') subfolder = 'avatars';
          
          const dir = path.join(UPLOADS_DIR, subfolder);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          
          const filePath = path.join(dir, newFileName);
          fs.writeFileSync(filePath, fileContent, 'binary');
          result[name] = '/uploads/' + subfolder + '/' + newFileName;
          return;
        }

        const textMatch = part.match(/name="([^"]+)"[\r\n]+([\s\S]*?)(?:\r\n--|--|$)/);
        if (textMatch) {
          const name = textMatch[1].trim();
          const value = textMatch[2].trim().replace(/\r$/, '');
          if (name && !result[name]) {
            result[name] = value;
          }
        }
      });

      resolve(result);
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Static files
  if (method === 'GET' && !pathname.startsWith('/api')) {
    let filePath;
    if (pathname === '/' || pathname === '/index.html') {
      filePath = path.join(__dirname, 'public', 'index.html');
    } else if (pathname === '/admin') {
      filePath = path.join(__dirname, 'public', 'admin.html');
    } else if (pathname.startsWith('/uploads/')) {
      filePath = path.join(__dirname, pathname.replace(/^\//, ''));
    } else {
      filePath = path.join(__dirname, 'public', pathname);
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }
    filePath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(filePath)) {
      sendFile(res, filePath);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // ==================== API ====================
  try {
    // AUTH
    if (pathname === '/api/login' && method === 'POST') {
      const body = await parseBody(req);
      const user = db.users.find(u => u.username === body.username && u.password === hashPassword(body.password));
      if (!user) return sendJSON(res, { error: 'Sai tên đăng nhập hoặc mật khẩu' }, 400);
      user.token = generateToken();
      saveDB();
      return sendJSON(res, { success: true, token: user.token, username: user.username, role: user.role, id: user.id, avatar: user.avatar || '' });
    }

    if (pathname === '/api/register' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.username || !body.password) return sendJSON(res, { error: 'Thiếu thông tin' }, 400);
      if (db.users.find(u => u.username === body.username)) {
        return sendJSON(res, { error: 'Tên đăng nhập đã tồn tại' }, 400);
      }
      const newUser = {
        id: Date.now(),
        username: body.username,
        password: hashPassword(body.password),
        role: 'user',
        token: '',
        avatar: '',
        created_at: new Date().toISOString()
      };
      db.users.push(newUser);
      saveDB();
      return sendJSON(res, { success: true, message: 'Đăng ký thành công' });
    }

    // AUTH MIDDLEWARE
    const user = verifyToken(req.headers['authorization']);

    if (pathname === '/api/me' && method === 'GET') {
      if (!user) return sendJSON(res, { error: 'Chưa đăng nhập' }, 401);
      return sendJSON(res, { id: user.id, username: user.username, role: user.role, avatar: user.avatar || '' });
    }

    if (!user) return sendJSON(res, { error: 'Chưa đăng nhập' }, 401);

    // Update avatar
    if (pathname === '/api/avatar' && method === 'POST') {
      const body = await parseBody(req);
      if (body.avatar_url) {
        user.avatar = body.avatar_url;
        saveDB();
        return sendJSON(res, { success: true, avatar: user.avatar });
      }
      return sendJSON(res, { error: 'Thiếu ảnh' }, 400);
    }

    // Logout
    if (pathname === '/api/logout' && method === 'POST') {
      user.token = '';
      saveDB();
      return sendJSON(res, { success: true });
    }

    // Session stats - track visits and study time
    if (pathname === '/api/sessions' && method === 'GET') {
      const userSessions = db.sessions.filter(s => s.user_id === user.id);
      const total_sessions = userSessions.length;
      const total_minutes = userSessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
      return sendJSON(res, {
        total_sessions,
        total_minutes,
        sessions: userSessions
      });
    }

    // Track a new visit
    if (pathname === '/api/sessions' && method === 'POST') {
      const session = {
        id: Date.now(),
        user_id: user.id,
        minutes: 0,
        created_at: new Date().toISOString()
      };
      db.sessions.push(session);
      saveDB();
      const userSessions = db.sessions.filter(s => s.user_id === user.id);
      const total_minutes = userSessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
      return sendJSON(res, { 
        success: true, 
        total_sessions: userSessions.length, 
        total_minutes 
      });
    }

    // SUBJECTS
    if (pathname === '/api/subjects' && method === 'GET') {
      return sendJSON(res, db.subjects);
    }

    // THEORY
    if (pathname === '/api/theory' && method === 'GET') {
      const subject_id = parsed.searchParams.get('subject_id');
      let lessons = db.theory_lessons.filter(l => l.user_id === user.id);
      if (subject_id) lessons = lessons.filter(l => l.subject_id == subject_id);
      return sendJSON(res, lessons.map(l => ({
        ...l,
        subject_name: db.subjects.find(s => s.id == l.subject_id)?.name || ''
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }

    if (pathname === '/api/theory' && method === 'POST') {
      const body = await parseBody(req);
      const lesson = {
        id: Date.now(),
        user_id: user.id,
        subject_id: parseInt(body.subject_id) || 1,
        title: body.title || 'Bài học mới',
        content: body.content || '',
        image_path: body.image_path || null,
        image_note: body.image_note || null,
        files: body.files || [],
        created_at: new Date().toISOString()
      };
      db.theory_lessons.push(lesson);
      saveDB();
      return sendJSON(res, { success: true, id: lesson.id });
    }

    if (pathname.startsWith('/api/theory/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/').pop());
      const idx = db.theory_lessons.findIndex(l => l.id === id && l.user_id === user.id);
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      db.theory_lessons.splice(idx, 1);
      saveDB();
      return sendJSON(res, { success: true });
    }

    // File upload
    if (pathname === '/api/upload' && method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        const files = await handleUpload(req);
        return sendJSON(res, { success: true, files });
      }
      const body = await parseBody(req);
      const base64Data = body.file;
      const fileName = body.name || 'file';
      if (base64Data) {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = body.ext || '.bin';
          let subfolder = 'images';
          if (body.type === 'avatar') subfolder = 'avatars';
          const newFileName = Date.now() + '_' + Math.random().toString(36).substr(2, 6) + ext;
          const dir = path.join(UPLOADS_DIR, subfolder);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, newFileName), matches[2], 'base64');
          return sendJSON(res, { success: true, url: '/uploads/' + subfolder + '/' + newFileName });
        }
      }
      return sendJSON(res, { error: 'Upload failed' }, 400);
    }

    // PRACTICE
    if (pathname === '/api/practice' && method === 'GET') {
      const subject_id = parsed.searchParams.get('subject_id');
      let questions = db.practice_questions.filter(q => q.user_id === user.id);
      if (subject_id) questions = questions.filter(q => q.subject_id == subject_id);
      return sendJSON(res, questions.map(q => ({
        ...q,
        correct_answer: undefined,
        subject_name: db.subjects.find(s => s.id == q.subject_id)?.name || ''
      })));
    }

    if (pathname === '/api/practice' && method === 'POST') {
      const body = await parseBody(req);
      const question = {
        id: Date.now(),
        user_id: user.id,
        subject_id: parseInt(body.subject_id) || 1,
        type: body.type || 'multiple',
        question_text: body.question_text || '',
        question_image: body.question_image || null,
        answer_a: body.answer_a || '',
        answer_b: body.answer_b || '',
        answer_c: body.answer_c || '',
        answer_d: body.answer_d || '',
        answer_correct: body.answer_correct || 'A',
        correct_answer: body.correct_answer || '',
        is_true: body.is_true !== undefined ? body.is_true : true,
        sub_question_1: body.sub_question_1 || '',
        sub_question_2: body.sub_question_2 || '',
        sub_question_3: body.sub_question_3 || '',
        sub_question_4: body.sub_question_4 || '',
        sub_correct_1: body.sub_correct_1 === true || body.sub_correct_1 === 'true',
        sub_correct_2: body.sub_correct_2 === true || body.sub_correct_2 === 'true',
        sub_correct_3: body.sub_correct_3 === true || body.sub_correct_3 === 'true',
        sub_correct_4: body.sub_correct_4 === true || body.sub_correct_4 === 'true',
        shuffle_options: [],
        created_at: new Date().toISOString()
      };
      db.practice_questions.push(question);
      saveDB();
      return sendJSON(res, { success: true, id: question.id });
    }

    if (pathname.startsWith('/api/practice/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/').pop());
      const idx = db.practice_questions.findIndex(q => q.id === id && q.user_id === user.id);
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      db.practice_questions.splice(idx, 1);
      saveDB();
      return sendJSON(res, { success: true });
    }

    // Check answers (exam mode) - FIXED shuffle for multiple choice
    if (pathname === '/api/check-exam' && method === 'POST') {
      const body = await parseBody(req);
      const { answers } = body;
      if (!answers || !Array.isArray(answers)) return sendJSON(res, { error: 'Invalid' }, 400);
      
      let correct = 0;
      let total = answers.length;
      const details = answers.map(a => {
        const q = db.practice_questions.find(q => q.id === a.id && q.user_id === user.id);
        if (!q) return { id: a.id, correct: false, correct_answer: '?' };
        
        let isCorrect = false;
        if (q.type === 'truefalse') {
          const userAnswers = a.answer || {};
          let allCorrect = true;
          let subCount = 0;
          for (let i = 1; i <= 4; i++) {
            const subQ = q[`sub_question_${i}`];
            if (!subQ || !subQ.trim()) continue;
            subCount++;
            const userVal = userAnswers[String(i)] === true || userAnswers[String(i)] === 'true';
            const correctVal = q[`sub_correct_${i}`] === true || q[`sub_correct_${i}`] === 'true';
            if (userVal !== correctVal) {
              allCorrect = false;
            }
          }
          isCorrect = subCount === 0 ? true : allCorrect;
        } else if (q.type === 'multiple') {
          // Check against original correct answer (before shuffle)
          isCorrect = a.answer === q.answer_correct;
        } else if (q.type === 'shortanswer') {
          // Compare user answer with correct_answer (case-insensitive, trimmed)
          const userAns = (a.answer || '').trim().toLowerCase();
          const correctAns = (q.correct_answer || '').trim().toLowerCase();
          isCorrect = userAns === correctAns;
        } else {
          isCorrect = a.answer && a.answer.trim().length > 0;
        }
        
        if (isCorrect) correct++;
        return { id: a.id, correct: isCorrect, correct_answer: q.answer_correct, your_answer: a.answer };
      });
      
      const score = total > 0 ? (correct / total) * 10 : 0;
      
      // Save score
      const subject_id = body.subject_id || 1;
      db.scores.push({
        id: Date.now(),
        user_id: user.id,
        subject_id: parseInt(subject_id),
        score: Math.round(score * 10) / 10,
        max_score: 10,
        created_at: new Date().toISOString()
      });
      saveDB();
      
      return sendJSON(res, { success: true, score: Math.round(score * 10) / 10, correct, total, details });
    }

    // SCORES
    if (pathname === '/api/scores' && method === 'GET') {
      const scores = db.scores.filter(s => s.user_id === user.id);
      return sendJSON(res, scores.map(s => ({
        ...s,
        subject_name: db.subjects.find(sub => sub.id == s.subject_id)?.name || ''
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }

    if (pathname === '/api/scores' && method === 'DELETE') {
      db.scores = db.scores.filter(s => s.user_id !== user.id);
      saveDB();
      return sendJSON(res, { success: true });
    }

    if (pathname.startsWith('/api/scores/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/').pop());
      const idx = db.scores.findIndex(s => s.id === id && s.user_id === user.id);
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      db.scores.splice(idx, 1);
      saveDB();
      return sendJSON(res, { success: true });
    }

    if (pathname === '/api/scores/best' && method === 'GET') {
      const best = db.subjects.map(s => {
        const subjScores = db.scores.filter(sc => sc.user_id === user.id && sc.subject_id === s.id);
        const maxScore = subjScores.length ? Math.max(...subjScores.map(sc => sc.score)) : 0;
        const lastScore = subjScores.length ? subjScores[subjScores.length - 1].score : 0;
        return {
          id: s.id,
          name: s.name,
          name_en: s.name_en,
          best_score: maxScore,
          last_score: lastScore,
          count: subjScores.length
        };
      });
      return sendJSON(res, best);
    }

    // MUSIC
    if (pathname === '/api/music' && method === 'GET') {
      return sendJSON(res, db.music.filter(m => m.user_id === user.id));
    }

    if (pathname === '/api/music' && method === 'POST') {
      const body = await parseBody(req);
      const music = {
        id: Date.now(),
        user_id: user.id,
        title: body.title || 'Bài hát không tên',
        artist: body.artist || 'Unknown',
        file_path: body.file_path || '',
        image: body.image || '',
        created_at: new Date().toISOString()
      };
      db.music.push(music);
      saveDB();
      return sendJSON(res, { success: true, id: music.id });
    }

    if (pathname.startsWith('/api/music/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/').pop());
      const idx = db.music.findIndex(m => m.id === id && m.user_id === user.id);
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      db.music.splice(idx, 1);
      saveDB();
      return sendJSON(res, { success: true });
    }

    if (pathname === '/api/music/upload' && method === 'POST') {
      const body = await parseBody(req);
      let fileUrl = body.file_path || '';
      if (body.file && !fileUrl) {
        const matches = body.file.match(/^data:audio\/([^;]+);base64,(.+)$/);
        if (matches) {
          const ext = '.' + matches[1].replace('mpeg', 'mp3');
          const newFileName = Date.now() + '_' + Math.random().toString(36).substr(2, 6) + ext;
          const dir = path.join(UPLOADS_DIR, 'music');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, newFileName), matches[2], 'base64');
          fileUrl = '/uploads/music/' + newFileName;
        }
      }
      const music = {
        id: Date.now(),
        user_id: user.id,
        title: body.title || 'Bài hát không tên',
        artist: body.artist || 'Unknown',
        file_path: fileUrl,
        image: body.image || '',
        created_at: new Date().toISOString()
      };
      db.music.push(music);
      saveDB();
      return sendJSON(res, { success: true, id: music.id, file_path: fileUrl });
    }

    // CALENDAR
    if (pathname === '/api/calendar' && method === 'GET') {
      return sendJSON(res, db.calendar.filter(c => c.user_id === user.id));
    }

    if (pathname === '/api/calendar' && method === 'POST') {
      const body = await parseBody(req);
      const event = {
        id: Date.now(),
        user_id: user.id,
        title: body.title || 'Sự kiện',
        start_date: body.start_date || '',
        end_date: body.end_date || '',
        notes: body.notes || '',
        color: body.color || '#4f46e5',
        created_at: new Date().toISOString()
      };
      db.calendar.push(event);
      saveDB();
      return sendJSON(res, { success: true, id: event.id });
    }

    if (pathname.startsWith('/api/calendar/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/').pop());
      const idx = db.calendar.findIndex(c => c.id === id && c.user_id === user.id);
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      db.calendar.splice(idx, 1);
      saveDB();
      return sendJSON(res, { success: true });
    }

    // NOTIFICATIONS
    if (pathname === '/api/notifications' && method === 'GET') {
      const notifications = db.notifications.filter(n => n.user_id === user.id);
      return sendJSON(res, notifications.map(n => ({
        ...n,
        from_username: db.users.find(u => u.id === n.from_user_id)?.username || 'System'
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }

    if (pathname === '/api/notifications' && method === 'POST') {
      const body = await parseBody(req);
      const notif = {
        id: Date.now(),
        user_id: user.id,
        from_user_id: body.from_user_id || user.id,
        message: body.message || '',
        type: body.type || 'reminder',
        is_read: 0,
        created_at: new Date().toISOString()
      };
      db.notifications.push(notif);
      saveDB();
      return sendJSON(res, { success: true, id: notif.id });
    }

    if (pathname.startsWith('/api/notifications/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/').pop());
      const idx = db.notifications.findIndex(n => n.id === id && n.user_id === user.id);
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      db.notifications.splice(idx, 1);
      saveDB();
      return sendJSON(res, { success: true });
    }

    if (pathname.endsWith('/read') && method === 'PUT') {
      const parts = pathname.split('/');
      const id = parseInt(parts[parts.length - 2]);
      const n = db.notifications.find(n => n.id === id && n.user_id === user.id);
      if (!n) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      n.is_read = 1;
      saveDB();
      return sendJSON(res, { success: true });
    }

    if (pathname === '/api/notifications/unread-count' && method === 'GET') {
      const count = db.notifications.filter(n => n.user_id === user.id && !n.is_read).length;
      return sendJSON(res, { count });
    }

    // ENCOURAGEMENTS
    if (pathname === '/api/encouragements' && method === 'GET') {
      const enc = db.encouragements.find(e => e.user_id === user.id);
      return sendJSON(res, enc || { 
        user_id: user.id, 
        message_up: '🔥 Xuất sắc! Cố gắng phát huy!', 
        message_down: '😤 Học hành kiểu gì vậy? Cố lên!',
        threshold: 7
      });
    }

    if (pathname === '/api/encouragements' && method === 'POST') {
      const body = await parseBody(req);
      let enc = db.encouragements.find(e => e.user_id === user.id);
      if (enc) {
        enc.message_up = body.message_up || enc.message_up;
        enc.message_down = body.message_down || enc.message_down;
        enc.threshold = body.threshold !== undefined ? parseInt(body.threshold) : (enc.threshold || 7);
      } else {
        enc = {
          user_id: user.id,
          message_up: body.message_up || '🔥 Xuất sắc!',
          message_down: body.message_down || '😤 Cố lên!',
          threshold: body.threshold !== undefined ? parseInt(body.threshold) : 7
        };
        db.encouragements.push(enc);
      }
      saveDB();
      return sendJSON(res, { success: true });
    }

    // FEEDBACK - send feedback to admin
    if (pathname === '/api/feedback' && method === 'POST') {
      const body = await parseBody(req);
      const message = body.message || '';
      if (!message.trim()) return sendJSON(res, { error: 'Vui lòng nhập nội dung phản hồi' }, 400);
      
      // Send notification to admin
      const adminUser = db.users.find(u => u.role === 'admin');
      if (adminUser) {
        const notif = {
          id: Date.now(),
          user_id: adminUser.id,
          from_user_id: user.id,
          message: '📩 Phản hồi từ ' + user.username + ': ' + message,
          type: 'admin',
          is_read: 0,
          created_at: new Date().toISOString()
        };
        db.notifications.push(notif);
        saveDB();
      }
      return sendJSON(res, { success: true, message: 'Đã gửi phản hồi đến admin!' });
    }

    // ADMIN
    if (pathname === '/api/admin/users' && method === 'GET') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      return sendJSON(res, db.users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        avatar: u.avatar || '',
        created_at: u.created_at
      })));
    }

    // Admin get user passwords (admin only)
    if (pathname === '/api/admin/users-passwords' && method === 'GET') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      return sendJSON(res, db.users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        avatar: u.avatar || '',
        created_at: u.created_at,
        password_hash: u.password
      })));
    }

    // Admin change user password (admin only)
    if (pathname === '/api/admin/change-password' && method === 'POST') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      const body = await parseBody(req);
      const targetUser = db.users.find(u => u.id == body.user_id);
      if (!targetUser) return sendJSON(res, { error: 'Không tìm thấy user' }, 404);
      targetUser.password = hashPassword(body.new_password);
      saveDB();
      return sendJSON(res, { success: true, message: 'Đã đổi mật khẩu' });
    }

    if (pathname === '/api/admin/notifications' && method === 'POST') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      const body = await parseBody(req);
      const targetUser = db.users.find(u => u.id == body.user_id);
      if (targetUser) {
        const notif = {
          id: Date.now(),
          user_id: targetUser.id,
          from_user_id: user.id,
          message: body.message || '',
          type: 'admin',
          is_read: 0,
          created_at: new Date().toISOString()
        };
        db.notifications.push(notif);
        saveDB();
      }
      return sendJSON(res, { success: true });
    }

    if (pathname.startsWith('/api/admin/users/') && method === 'DELETE') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      const id = parseInt(pathname.split('/').pop());
      const idx = db.users.findIndex(u => u.id === id && u.role !== 'admin');
      if (idx === -1) return sendJSON(res, { error: 'Không tìm thấy hoặc không thể xóa admin' }, 404);
      db.users.splice(idx, 1);
      db.scores = db.scores.filter(s => s.user_id !== id);
      db.theory_lessons = db.theory_lessons.filter(l => l.user_id !== id);
      db.practice_questions = db.practice_questions.filter(q => q.user_id !== id);
      db.notifications = db.notifications.filter(n => n.user_id !== id);
      db.sessions = db.sessions.filter(s => s.user_id !== id);
      saveDB();
      return sendJSON(res, { success: true });
    }

    // All subjects (admin only)
    if (pathname === '/api/all-theory' && method === 'GET') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      const subject_id = parsed.searchParams.get('subject_id');
      let lessons = db.theory_lessons;
      if (subject_id) lessons = lessons.filter(l => l.subject_id == subject_id);
      return sendJSON(res, lessons.map(l => ({
        ...l,
        username: db.users.find(u => u.id === l.user_id)?.username || 'Unknown',
        subject_name: db.subjects.find(s => s.id == l.subject_id)?.name || ''
      })));
    }

    // Single theory lesson (admin only)
    if (pathname.startsWith('/api/all-theory/') && method === 'GET') {
      if (user.role !== 'admin') return sendJSON(res, { error: 'Không có quyền' }, 403);
      const id = parseInt(pathname.split('/').pop());
      const lesson = db.theory_lessons.find(l => l.id === id);
      if (!lesson) return sendJSON(res, { error: 'Không tìm thấy' }, 404);
      return sendJSON(res, {
        ...lesson,
        username: db.users.find(u => u.id === lesson.user_id)?.username || 'Unknown',
        subject_name: db.subjects.find(s => s.id == lesson.subject_id)?.name || ''
      });
    }

    res.writeHead(404);
    res.end('API not found');
  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`✅ Server chạy tại cổng ${PORT}`);
  console.log(`📝 Tài khoản admin: admin / admin123`);
});