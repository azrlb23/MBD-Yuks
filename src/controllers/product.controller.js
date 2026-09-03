import { executeReadSP, executeWriteSP } from '../services/sp.service.js';

export const getKatalog = async (req, res, next) => {
  try {
    const barangList = await executeReadSP('CALL sp_get_katalog_barang($1)', ['cur_katalog']);
    res.json({
      success: true,
      total: barangList.length,
      data: barangList
    });
  } catch (error) {
    next(error);
  }
};

export const getDetailBarang = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barang = await executeReadSP('CALL sp_get_detail_barang($1, $2)', [id, 'cur_detail']);
    
    if (!barang || barang.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Barang tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: barang[0]
    });
  } catch (error) {
    next(error);
  }
};

export const updateHargaSpesifikasi = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { harga, spesifikasi } = req.body;
    const idManajer = req.user.id_pengguna;

    await executeWriteSP(
      'CALL sp_update_harga_spesifikasi($1, $2, $3, $4)',
      [idManajer, id, harga || null, spesifikasi ? JSON.stringify(spesifikasi) : null]
    );

    res.json({
      success: true,
      message: 'Harga & spesifikasi barang berhasil diperbarui'
    });
  } catch (error) {
    next(error);
  }
};
