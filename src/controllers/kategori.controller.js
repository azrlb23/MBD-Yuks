import { executeReadSP, executeWriteSP } from '../services/sp.service.js';

export const getKategori = async (req, res, next) => {
  try {
    const data = await executeReadSP('CALL sp_get_kategori($1)', ['cur_kategori']);
    res.json({
      success: true,
      message: 'Berhasil mengambil data kategori',
      data
    });
  } catch (error) {
    next(error);
  }
};

export const tambahKategori = async (req, res, next) => {
  try {
    const { nama_kategori } = req.body;
    const { id_pengguna } = req.user;

    if (!nama_kategori) {
      return res.status(400).json({
        success: false,
        message: 'Nama kategori wajib diisi'
      });
    }

    await executeWriteSP('CALL sp_tambah_kategori($1, $2)', [id_pengguna, nama_kategori]);
    
    res.status(201).json({
      success: true,
      message: 'Kategori berhasil ditambahkan'
    });
  } catch (error) {
    if (error.code === '23505') { // unique violation
      return res.status(400).json({
        success: false,
        message: 'Nama kategori sudah ada'
      });
    }
    next(error);
  }
};
