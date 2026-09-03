-- =============================================================================
-- POS Kafe Jalur Langit — Read-Only Functions (Bahasa Indonesia)
-- =============================================================================

-- 1. FUNGSI VALIDASI KREDENSIAL LOGIN
CREATE OR REPLACE FUNCTION fn_validasi_kredensial(p_username TEXT, p_password TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_valid BOOLEAN := FALSE;
BEGIN
    SELECT (password_hash = p_password) INTO v_valid
    FROM pengguna 
    WHERE username = p_username AND is_active = TRUE;
    
    RETURN COALESCE(v_valid, FALSE);
END;
$$;

-- 2. FUNGSI CEK KETERSEDIAAN BARANG & STOK
CREATE OR REPLACE FUNCTION fn_validasi_ketersediaan(p_id_barang INT, p_jumlah INT)
RETURNS TABLE(
    valid BOOLEAN,
    stok_saat_ini INT,
    harga NUMERIC,
    nama_barang VARCHAR
) 
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        (b.stok >= p_jumlah AND b.is_active = TRUE) AS valid,
        b.stok AS stok_saat_ini,
        b.harga,
        b.nama_barang
    FROM barang b
    WHERE b.id_barang = p_id_barang;
END;
$$;

-- 3. FUNGSI MERGE SPESIFIKASI JSONB
CREATE OR REPLACE FUNCTION fn_merge_spesifikasi(p_spek_lama JSONB, p_spek_baru JSONB)
RETURNS JSONB 
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN COALESCE(p_spek_lama, '{}'::JSONB) || COALESCE(p_spek_baru, '{}'::JSONB);
END;
$$;

-- 4. FUNGSI READ-ONLY STRUK DIGITAL JSONB
CREATE OR REPLACE FUNCTION fn_get_detail_struk(p_id_transaksi INT)
RETURNS JSONB 
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_struk JSONB;
BEGIN
    SELECT s.data_struk INTO v_struk 
    FROM struk s 
    WHERE s.id_transaksi = p_id_transaksi;
    
    RETURN v_struk;
END;
$$;

-- 5. READ WRAPPER FUNCTION UNTUK DAFTAR PENGGUNA
CREATE OR REPLACE FUNCTION fn_get_daftar_pengguna()
RETURNS SETOF vw_daftar_pengguna 
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY SELECT * FROM vw_daftar_pengguna;
END;
$$;

-- 6. READ WRAPPER FUNCTION UNTUK KATALOG BARANG
CREATE OR REPLACE FUNCTION fn_get_katalog_barang()
RETURNS SETOF vw_katalog_barang 
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY SELECT * FROM vw_katalog_barang;
END;
$$;

-- 7. READ WRAPPER FUNCTION UNTUK TRANSAKSI HARIAN
CREATE OR REPLACE FUNCTION fn_get_transaksi_harian(p_tanggal DATE DEFAULT CURRENT_DATE)
RETURNS SETOF vw_transaksi_harian 
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM vw_transaksi_harian 
    WHERE (p_tanggal IS NULL OR created_at::DATE = p_tanggal);
END;
$$;

-- 8. READ WRAPPER FUNCTION UNTUK LAPORAN RESTOCK
CREATE OR REPLACE FUNCTION fn_get_laporan_restock(p_id_barang INT DEFAULT NULL, p_dari DATE DEFAULT NULL, p_sampai DATE DEFAULT NULL)
RETURNS SETOF vw_laporan_restock 
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM vw_laporan_restock r
    WHERE (p_id_barang IS NULL OR r.id_barang = p_id_barang)
      AND (p_dari IS NULL OR r.created_at::DATE >= p_dari)
      AND (p_sampai IS NULL OR r.created_at::DATE <= p_sampai);
END;
$$;
