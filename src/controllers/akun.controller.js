import bcrypt from 'bcryptjs';
import { executeReadSP, executeWriteSP } from '../services/sp.service.js';

export const getDaftarAkun = async (req, res, next) => {
  try {
    const akunList = await executeReadSP('CALL sp_get_daftar_pengguna($1)', ['cur_pengguna']);
    res.json({
      success: true,
      total: akunList.length,
      data: akunList
    });
  } catch (error) {
    next(error);
  }
};

export const buatAkunKasir = async (req, res, next) => {
  try {
    const { username, password, nama_lengkap } = req.body;
    const manajer_id = req.user.id_pengguna;

    if (!username || !password || !nama_lengkap) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, dan nama_lengkap wajib diisi'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await executeWriteSP('CALL sp_buat_akun_kasir($1, $2, $3, $4)', [
      manajer_id,
      username,
      password_hash,
      nama_lengkap
    ]);

    res.status(201).json({
      success: true,
      message: `Akun kasir '${username}' dan PostgreSQL Role berhasil dibuat`
    });
  } catch (error) {
    next(error);
  }
};

