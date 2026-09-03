import { executeWriteSP } from '../services/sp.service.js';

export const toggleStatus = async (req, res, next) => {
  try {
    const { entitas, id, is_active } = req.body;
    const id_manajer = req.user.id_pengguna;
    const validEntities = ['akun', 'barang', 'kategori'];
    if (!validEntities.includes(entitas)) {
      return res.status(400).json({ success: false, message: 'Jenis entitas tidak valid (hanya: akun, barang, kategori)' });
    }
    if (typeof id !== 'number' || typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'ID harus berupa angka dan is_active harus boolean' });
    }

    await executeWriteSP('CALL sp_toggle_status($1, $2, $3, $4)', [
      id_manajer,
      entitas,
      id,
      is_active
    ]);

    res.json({
      success: true,
      message: `Status ${entitas} dengan ID ${id} berhasil diubah menjadi ${is_active ? 'aktif' : 'non-aktif'}`
    });
  } catch (error) {
    next(error);
  }
};
