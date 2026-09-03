import express from 'express';
import { restockBarang, getLaporanRestock } from '../controllers/restock.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', verifyToken, requireRole('manajer'), restockBarang);
router.get('/riwayat', verifyToken, getLaporanRestock);

export default router;
