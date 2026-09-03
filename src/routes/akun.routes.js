import express from 'express';
import { getDaftarAkun, buatAkunKasir } from '../controllers/akun.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, requireRole('manajer'), getDaftarAkun);
router.post('/kasir', verifyToken, requireRole('manajer'), buatAkunKasir);

export default router;
