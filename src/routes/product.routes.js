import express from 'express';
import { getKatalog, getDetailBarang, updateHargaSpesifikasi } from '../controllers/product.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, getKatalog);
router.get('/:id', verifyToken, getDetailBarang);
router.put('/:id', verifyToken, requireRole('manajer'), updateHargaSpesifikasi);

export default router;
