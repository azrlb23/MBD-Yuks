import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi tidak ditemukan'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_jalur_langit_key_2026');
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
