import express from 'express';
import { getKategori, tambahKategori } from '../controllers/kategori.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, getKategori);
router.post('/', verifyToken, requireRole('manajer'), tambahKategori);

export default router;
