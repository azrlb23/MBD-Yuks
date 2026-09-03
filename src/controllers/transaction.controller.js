import { executeWriteSP, executeReadSP } from '../services/sp.service.js';

export const checkout = async (req, res, next) => {
  try {
    const { items } = req.body;
    const idKasir = req.user.id_pengguna;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Daftar item pesanan (items) wajib diisi'
      });
    }

    const result = await executeWriteSP(
      'CALL sp_checkout_transaksi($1, $2, $3, $4)',
      [idKasir, JSON.stringify(items), null, null]
    );

    res.status(201).json({
      success: true,
      message: 'Transaksi pesanan berhasil diproses',
      data: {
        id_transaksi: result.p_id_transaksi,
        total_bayar: result.p_total_bayar
      }
    });
  } catch (error) {
    if (error.message.includes('stok tidak mencukupi')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

export const getSemuaTransaksi = async (req, res, next) => {
  try {
    const { id_pengguna, peran } = req.user;
    const result = await executeReadSP(
      'CALL sp_get_semua_transaksi($1, $2, $3)',
      [id_pengguna, peran, 'cur_semua_trx']
    );
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getDetailStruk = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_pengguna, peran } = req.user;
    
    const transId = id === 'latest' ? -1 : parseInt(id, 10);

    const result = await executeReadSP(
      'CALL sp_get_detail_struk($1, $2, $3, $4)',
      [id_pengguna, peran, transId, 'cur_struk']
    );

    if (!result || result.length === 0 || !result[0].struk_json) {
      return res.status(404).json({
        success: false,
        message: 'Struk transaksi tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: result[0].struk_json
    });
  } catch (error) {
    next(error);
  }
};
