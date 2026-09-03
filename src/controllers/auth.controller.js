import jwt from 'jsonwebtoken';
import { executeWriteSP } from '../services/sp.service.js';

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi'
      });
    }

    const result = await executeWriteSP(
      'CALL sp_login($1, $2, $3, $4, $5)',
      [username, password, null, null, null]
    );

    const idPengguna = result?.p_id_pengguna;
    const namaPengguna = result?.p_nama;
    const peranPengguna = result?.p_peran;

    if (!idPengguna) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah / akun dinonaktifkan'
      });
    }

    const token = jwt.sign(
      {
        id_pengguna: idPengguna,
        username: username,
        peran: peranPengguna,
        nama: namaPengguna
      },
      process.env.JWT_SECRET || 'supersecret_jalur_langit_key_2026',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id_pengguna: idPengguna,
        nama: namaPengguna,
        peran: peranPengguna,
        token: token
      }
    });
  } catch (error) {
    if (error.code === '28P01' || error.message?.includes('Kredensial login salah')) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah / akun dinonaktifkan'
      });
    }
    next(error);
  }
};

export const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logout berhasil'
  });
};
