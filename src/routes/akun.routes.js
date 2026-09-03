import express from 'express';
import { getDaftarAkun, buatAkunKasir, aturPrivilege, nonaktifkanAkun } from '../controllers/akun.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, requireRole('manajer'), getDaftarAkun);
router.post('/kasir', verifyToken, requireRole('manajer'), buatAkunKasir);
router.put('/privilege', verifyToken, requireRole('manajer'), aturPrivilege);
router.delete('/:id', verifyToken, requireRole('manajer'), nonaktifkanAkun);

export default router;
