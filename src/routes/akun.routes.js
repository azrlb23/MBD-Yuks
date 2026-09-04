import express from 'express';
import { getDaftarAkun, tambahPengguna } from '../controllers/akun.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, requireRole('manajer'), getDaftarAkun);
router.post('/', verifyToken, requireRole('manajer'), tambahPengguna);
router.post('/kasir', verifyToken, requireRole('manajer'), tambahPengguna);

export default router;
