import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

import authRouter from './routes/auth';
import familiesRouter from './routes/families';
import peopleRouter from './routes/people';
import sacramentsRouter from './routes/sacraments';
import certificatesRouter from './routes/certificates';
import adminRouter from './routes/admin';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter (disabled in development)
if (process.env.NODE_ENV === 'production') {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }));
}

// Public routes
app.use('/api/auth', authRouter);

// Public verification endpoint
app.get('/api/verify/:token', (req, res) => {
  res.redirect(`/api/certificates/verify/${req.params.token}`);
});
app.use('/api/certificates/verify', certificatesRouter);

// Protected routes
app.use('/api/families', familiesRouter);
app.use('/api/people', peopleRouter);
app.use('/api/sacraments', sacramentsRouter);
app.use('/api/sacrament-types', sacramentsRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/admin', adminRouter);

import donationsRouter from './routes/donations';
app.use('/api/donations', donationsRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Parish API server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
