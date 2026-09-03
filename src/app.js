import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'POS Jalur Langit API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 POS Jalur Langit Server running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api/v1`);
  console.log(`=======================================================`);
});

export default app;
