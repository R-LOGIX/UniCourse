import express from 'express';
import dotenv from 'dotenv';
import cron from 'node-cron';
import * as line from '@line/bot-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Set up LINE configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const lineClient = config.channelAccessToken ? new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken }) : null;

// In-memory data store for prototype
const DB_FILE = path.join(__dirname, 'db.json');
let db = { users: {} }; // users: { [syncId]: { lineId: string, tasks: [], courses: [], notifications: [] } }

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    console.error('Failed to load DB');
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Simple link code cache for connecting LINE accounts
// linkCode -> syncId
const linkCodes = {};

// Handle LINE webhook using middleware
if (config.channelSecret && config.channelAccessToken) {
  app.post('/api/webhook', line.middleware(config), (req, res) => {
    Promise.all(req.body.events.map(handleEvent))
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).end();
      });
  });
}

// Parse JSON payload for other routes
app.use(express.json());

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text.trim();
  const userId = event.source.userId;

  // Check if they are sending a link code
  if (text.startsWith('連携 ') || text.length === 6) {
    const code = text.replace('連携 ', '').trim();
    if (linkCodes[code]) {
      const syncId = linkCodes[code];
      if (!db.users[syncId]) {
        db.users[syncId] = { lineId: userId, tasks: [], courses: [], notifications: [] };
      } else {
        db.users[syncId].lineId = userId;
      }
      saveDb();
      delete linkCodes[code];
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'アカウントの連携が完了しました！以降、期限が近づくとLINEに通知が届きます。' }]
      });
    } else {
      return lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '無効な連携コードです。アプリ側で表示されている6桁のコードを送信してください。' }]
      });
    }
  }

  // Help message
  return lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: '「連携 [6桁のコード]」と送信すると、アプリと連携できます。' }]
  });
}

// API for app to generate a link code
app.post('/api/link-code', (req, res) => {
  const { syncId } = req.body;
  if (!syncId) return res.status(400).json({ error: 'syncId required' });
  
  // Generate random 6 character code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  linkCodes[code] = syncId;
  
  res.json({ code });
});

// API for app to sync its state
app.post('/api/sync', (req, res) => {
  const { syncId, tasks, courses, notifications, titleTemplate, bodyTemplate } = req.body;
  if (!syncId) return res.status(400).json({ error: 'syncId required' });
  
  if (!db.users[syncId]) {
    db.users[syncId] = { lineId: null };
  }
  
  db.users[syncId].tasks = tasks || [];
  db.users[syncId].courses = courses || [];
  db.users[syncId].notifications = notifications || [];
  db.users[syncId].titleTemplate = titleTemplate || '{course} - {task}';
  db.users[syncId].bodyTemplate = bodyTemplate || '{label}の期限が迫っています ({date})';
  
  saveDb();
  res.json({ success: true, isLinked: !!db.users[syncId].lineId });
});

// Setup Vite in development or static files in production
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('/script.js', (req, res) => {
      res.sendFile(path.join(__dirname, 'script.js'));
    });
    app.get(/(.*)/, (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap();

// --- CRON JOB FOR NOTIFICATIONS ---
// Runs every minute
cron.schedule('* * * * *', async () => {
  if (!lineClient) return;

  const now = new Date();
  const formatTaskDate = (d) => {
    try {
      const dt = new Date(d);
      const isDateOnly = d.includes('T00:00:00');
      return isDateOnly ? 
         `${dt.getMonth()+1}/${dt.getDate()} 期限` : 
         `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    } catch(e) { return d; }
  };

  const typeLabels = { video: '講義動画', delivery: '配信', report: 'レポート/課題', test: '小テスト' };

  for (const [syncId, userData] of Object.entries(db.users)) {
    if (!userData.lineId) continue; // Not linked

    const userLineId = userData.lineId;
    const { tasks, courses, notifications, titleTemplate, bodyTemplate } = userData;

    for (const task of tasks) {
      if (task.completed) continue;
      if (task.date.includes('T00:00:00') && task.type === 'delivery') continue;

      for (const sched of notifications) {
         const notifiedKey = `line_notified_${task.id}_${sched.id}`;
         if (db.users[syncId][notifiedKey]) continue; // Already notified via LINE

         const taskDateObj = new Date(task.date);
         const targetDateObj = new Date(taskDateObj.getTime());
         targetDateObj.setDate(targetDateObj.getDate() - sched.daysBefore);
         
         const [hStr, mStr] = sched.time.split(':');
         targetDateObj.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

         const timeDiff = now.getTime() - targetDateObj.getTime();
         // If we are past the notification time, but not extremely old (e.g., within the last 10 minutes)
         if (timeDiff >= 0 && timeDiff <= 10 * 60 * 1000) {
             const course = courses.find(c => c.id === task.courseId);
             const cname = course ? course.name : '不明な科目';
             const tlabel = typeLabels[task.type] || 'タスク';

             let bodyStr = bodyTemplate || '{label}の期限が迫っています ({date})';
             bodyStr = bodyStr.replace('{course}', cname)
                         .replace('{task}', task.lectureName)
                         .replace('{label}', tlabel)
                         .replace('{date}', formatTaskDate(task.date));

             let titleStr = titleTemplate || '{course} - {task}';
             titleStr = titleStr.replace('{course}', cname)
                         .replace('{task}', task.lectureName)
                         .replace('{label}', tlabel)
                         .replace('{date}', formatTaskDate(task.date));

             const messageText = `【お知らせ】\n${titleStr}\n\n${bodyStr}`;

             try {
               await lineClient.pushMessage({
                 to: userLineId,
                 messages: [{ type: 'text', text: messageText }]
               });
               // Mark as notified
               db.users[syncId][notifiedKey] = true;
               saveDb();
               console.log(`Pushed to ${userLineId}`);
             } catch (err) {
               console.error('Failed pushing LINE message', err);
             }
         }
      }
    }
  }
});
