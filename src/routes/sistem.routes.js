import express from 'express';
import { toggleStatus } from '../controllers/sistem.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.patch('/status', verifyToken, requireRole('manajer'), toggleStatus);

export default router;
