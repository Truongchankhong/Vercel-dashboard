import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import dataRouter from './api/data.js';
import detailsRouter from './api/details.js';
import summaryRouter from './api/summary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// API routes
app.use('/api/data', dataRouter);
app.use('/api/details', detailsRouter);
app.use('/api/summary', summaryRouter);

// Trang chính
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please free it or try another port.`);
    process.exit(1);
  } else {
    throw err;
  }
});
