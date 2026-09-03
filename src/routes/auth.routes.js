import express from 'express';
import { login, logout } from '../controllers/auth.controller.js';
import { verifyToken, requireGuest } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', requireGuest, login);
router.post('/logout', verifyToken, logout);

export default router;
