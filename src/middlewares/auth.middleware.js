import jwt from 'jsonwebtoken';
import { executeWriteSP } from '../services/sp.service.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi tidak ditemukan'
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.jti) {
      const dbCheck = await executeWriteSP('SELECT fn_cek_sesi_aktif($1::INT, $2::VARCHAR) AS is_active', [decoded.id_pengguna, decoded.jti]);
      if (!dbCheck || !dbCheck.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Sesi telah berakhir atau Anda login di perangkat lain'
        });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak: Token tidak valid atau telah kadaluarsa'
    });
  }
};

export const requireRole = (allowedRole) => {
  return (req, res, next) => {
    if (!req.user || req.user.peran !== allowedRole) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Hanya pengguna dengan peran '${allowedRole}' yang diizinkan`
      });
    }
    next();
  };
};

export const requireGuest = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.jti) {
      const dbCheck = await executeWriteSP('SELECT fn_cek_sesi_aktif($1::INT, $2::VARCHAR) AS is_active', [decoded.id_pengguna, decoded.jti]);
      if (dbCheck && dbCheck.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Anda sudah login. Silakan logout terlebih dahulu'
        });
      }
    }
    next();
  } catch (error) {
    next();
  }
};
