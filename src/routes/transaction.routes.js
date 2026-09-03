import express from 'express';
import { checkout, getTransaksiHarian, getDetailStruk } from '../controllers/transaction.controller.js';
import { verifyToken, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/checkout', verifyToken, requireRole('kasir'), checkout);
router.get('/', verifyToken, getTransaksiHarian);
router.get('/struk/:id', verifyToken, getDetailStruk);

export default router;
