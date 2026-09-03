-- =============================================================================
-- POS Kafe Jalur Langit — Views (Bahasa Indonesia)
-- =============================================================================

-- 1. VIEW DAFTAR PENGGUNA AKTIF
CREATE OR REPLACE VIEW vw_daftar_pengguna AS
SELECT 
    id_pengguna,
    username,
    nama_lengkap,
    peran,
    is_active
FROM pengguna
WHERE is_active = TRUE;

-- 2. VIEW KATALOG BARANG KAFE
CREATE OR REPLACE VIEW vw_katalog_barang AS
SELECT 
    b.id_barang,
    b.nama_barang,
    k.nama_kategori,
    b.harga,
    b.stok,
    b.spesifikasi,
    b.is_active
FROM barang b
JOIN kategori k ON b.id_kategori = k.id_kategori
WHERE b.is_active = TRUE;

-- 3. VIEW TRANSAKSI HARIAN
CREATE OR REPLACE VIEW vw_transaksi_harian AS
SELECT 
    t.id_transaksi,
    t.id_kasir,
    p.nama_lengkap AS nama_kasir,
    COUNT(dt.id_detail) AS total_item,
    t.total_bayar,
    t.created_at
FROM transaksi t
JOIN pengguna p ON t.id_kasir = p.id_pengguna
LEFT JOIN detail_transaksi dt ON t.id_transaksi = dt.id_transaksi
GROUP BY t.id_transaksi, p.nama_lengkap;

-- 4. VIEW LAPORAN RESTOCK STOK
CREATE OR REPLACE VIEW vw_laporan_restock AS
SELECT 
    r.id_restock,
    r.id_barang,
    b.nama_barang,
    r.jumlah_tambah,
    r.id_manajer,
    p.nama_lengkap AS nama_manajer,
    r.nama_supplier,
    r.created_at
FROM restock r
JOIN barang b ON r.id_barang = b.id_barang
JOIN pengguna p ON r.id_manajer = p.id_pengguna;

-- 5. VIEW BARANG DENGAN SPESIFIKASI UNPACKED
CREATE OR REPLACE VIEW vw_barang_spesifikasi AS
SELECT 
    b.id_barang,
    b.nama_barang,
    k.nama_kategori,
    b.harga,
    b.stok,
    kv.key AS spek_kunci,
    kv.value AS spek_nilai
FROM barang b
JOIN kategori k ON b.id_kategori = k.id_kategori,
LATERAL jsonb_each_text(b.spesifikasi) kv
WHERE b.is_active = TRUE;
