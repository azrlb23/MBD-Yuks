import express from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import transactionRoutes from './transaction.routes.js';
import restockRoutes from './restock.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/barang', productRoutes);
router.use('/transaksi', transactionRoutes);
router.use('/restock', restockRoutes);

export default router;
