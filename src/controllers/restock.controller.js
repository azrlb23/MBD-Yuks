import { executeWriteSP, executeReadSP } from '../services/sp.service.js';

export const restockBarang = async (req, res, next) => {
  try {
    const { id_barang, jumlah_tambah, nama_supplier } = req.body;
    const idManajer = req.user.id_pengguna;

    if (!id_barang || !jumlah_tambah) {
      return res.status(400).json({
        success: false,
        message: 'id_barang dan jumlah_tambah wajib diisi'
      });
    }

    await executeWriteSP(
      'CALL sp_restock_barang($1, $2, $3, $4)',
      [idManajer, id_barang, jumlah_tambah, nama_supplier || null]
    );

    res.json({
      success: true,
      message: 'Restock barang berhasil ditambahkan'
    });
  } catch (error) {
    next(error);
  }
};

export const getLaporanRestock = async (req, res, next) => {
  try {
    const { id_barang, dari, sampai } = req.query;
    const result = await executeReadSP(
      'CALL sp_get_laporan_restock($1, $2, $3, $4)',
      [id_barang || null, dari || null, sampai || null, 'cur_restock']
    );

    res.json({
      success: true,
      total: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
