import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
      'CALL sp_login($1::TEXT, null::INT, null::VARCHAR, null::TEXT, null::TEXT, null::VARCHAR)',
      [username]
    );

    const idPengguna = result?.p_id_pengguna;
    const passwordHash = result?.p_password_hash;
    const namaPengguna = result?.p_nama;
    const peranPengguna = result?.p_peran;
    const tokenAktif = result?.p_token_aktif;

    if (!idPengguna || !passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah / akun dinonaktifkan'
      });
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah / akun dinonaktifkan'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const token = jwt.sign(
      {
        id_pengguna: idPengguna,
        username: username,
        peran: peranPengguna,
        nama: namaPengguna,
        jti: tokenAktif
      },
      process.env.JWT_SECRET,
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
    if (error.code === '28P01' || error.message?.includes('Username tidak ditemukan')) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah / akun dinonaktifkan'
      });
    }
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    if (req.user && req.user.id_pengguna) {
      await executeWriteSP('CALL sp_logout($1::INT)', [req.user.id_pengguna]);
    }
    res.json({
      success: true,
      message: 'Logout berhasil'
    });
  } catch (error) {
    next(error);
  }
};
