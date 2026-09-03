-- =============================================================================
-- POS Kafe Jalur Langit — Stored Procedures (Bahasa Indonesia)
-- =============================================================================

-- 1. PROCEDURE LOGIN PENGGUNA
CREATE OR REPLACE PROCEDURE sp_login(
    p_username TEXT,
    p_password TEXT,
    INOUT p_id_pengguna INT DEFAULT NULL,
    INOUT p_nama TEXT DEFAULT NULL,
    INOUT p_peran TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_is_valid BOOLEAN;
BEGIN
    v_is_valid := fn_validasi_kredensial(p_username, p_password);

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Kredensial login salah atau akun tidak aktif' USING ERRCODE = '28P01';
    END IF;

    SELECT id_pengguna, nama_lengkap, peran 
    INTO p_id_pengguna, p_nama, p_peran
    FROM pengguna 
    WHERE username = p_username;
END;
$$;

-- 2. PROCEDURE CHECKOUT TRANSAKSI
CREATE OR REPLACE PROCEDURE sp_checkout_transaksi(
    p_id_kasir INT,
    p_items_jsonb JSONB,
    INOUT p_id_transaksi INT DEFAULT NULL,
    INOUT p_total_bayar NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_item JSONB;
    v_id_barang INT;
    v_jumlah INT;
    v_nama_barang VARCHAR(100);
    v_harga_satuan NUMERIC(12,2);
    v_valid BOOLEAN;
    v_subtotal_item NUMERIC(14,2);
    v_total NUMERIC(14,2) := 0.00;
    v_items_struk JSONB := '[]'::JSONB;
    v_nama_kasir VARCHAR(100);
BEGIN
    SELECT nama_lengkap INTO v_nama_kasir
    FROM pengguna 
    WHERE id_pengguna = p_id_kasir AND is_active = TRUE;

    IF v_nama_kasir IS NULL THEN
        RAISE EXCEPTION 'Kasir tidak ditemukan atau akun tidak aktif';
    END IF;

    INSERT INTO transaksi (id_kasir, total_bayar) 
    VALUES (p_id_kasir, 0.00) 
    RETURNING id_transaksi INTO p_id_transaksi;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_jsonb) LOOP
        v_id_barang := (v_item->>'id_barang')::INT;
        v_jumlah := (v_item->>'jumlah')::INT;

        SELECT valid, harga, nama_barang 
        INTO v_valid, v_harga_satuan, v_nama_barang
        FROM fn_validasi_ketersediaan(v_id_barang, v_jumlah);

        IF NOT COALESCE(v_valid, FALSE) THEN
            RAISE EXCEPTION 'Barang ID % stok tidak mencukupi', v_id_barang;
        END IF;

        v_subtotal_item := v_harga_satuan * v_jumlah;
        v_total := v_total + v_subtotal_item;

        INSERT INTO detail_transaksi (id_transaksi, id_barang, nama_barang, harga_satuan, jumlah, subtotal)
        VALUES (p_id_transaksi, v_id_barang, v_nama_barang, v_harga_satuan, v_jumlah, v_subtotal_item);

        v_items_struk := v_items_struk || jsonb_build_object(
            'id_barang', v_id_barang,
            'nama_barang', v_nama_barang,
            'harga_satuan', v_harga_satuan,
            'jumlah', v_jumlah,
            'subtotal', v_subtotal_item
        );
    END LOOP;

    p_total_bayar := v_total;

    UPDATE transaksi 
    SET total_bayar = p_total_bayar 
    WHERE id_transaksi = p_id_transaksi;

    INSERT INTO struk (id_transaksi, data_struk)
    VALUES (
        p_id_transaksi,
        jsonb_build_object(
            'id_transaksi', p_id_transaksi,
            'kasir', v_nama_kasir,
            'tanggal', NOW(),
            'items', v_items_struk,
            'total_bayar', p_total_bayar
        )
    );
END;
$$;

-- 3. PROCEDURE RESTOCK BARANG
CREATE OR REPLACE PROCEDURE sp_restock_barang(
    p_id_manajer INT,
    p_id_barang INT,
    p_jumlah_tambah INT,
    p_nama_supplier VARCHAR(100) DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_stok_lama INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak melakukan restock';
    END IF;

    SELECT stok INTO v_stok_lama 
    FROM barang 
    WHERE id_barang = p_id_barang;

    IF v_stok_lama IS NULL THEN
        RAISE EXCEPTION 'Barang tidak ditemukan';
    END IF;

    -- Catat ke jurnal restock (Trigger trg_tambah_stok_restock akan otomatis meng-update stok di tabel barang)
    INSERT INTO restock (id_barang, jumlah_tambah, id_manajer, nama_supplier)
    VALUES (p_id_barang, p_jumlah_tambah, p_id_manajer, p_nama_supplier);
END;
$$;

-- 4. PROCEDURE UPDATE HARGA & SPESIFIKASI BARANG
CREATE OR REPLACE PROCEDURE sp_update_harga_spesifikasi(
    p_id_manajer INT,
    p_id_barang INT,
    p_harga_baru NUMERIC DEFAULT NULL,
    p_spek_baru JSONB DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_spek_lama JSONB;
    v_spek_merged JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak mengubah harga/spesifikasi';
    END IF;

    SELECT spesifikasi INTO v_spek_lama 
    FROM barang 
    WHERE id_barang = p_id_barang;

    v_spek_merged := fn_merge_spesifikasi(v_spek_lama, p_spek_baru);

    UPDATE barang 
    SET harga = COALESCE(p_harga_baru, harga),
        spesifikasi = v_spek_merged
    WHERE id_barang = p_id_barang;
END;
$$;

-- 5. READ WRAPPER STORED PROCEDURES (REFCURSOR)
CREATE OR REPLACE PROCEDURE sp_get_katalog_barang(INOUT cur REFCURSOR DEFAULT 'cur_katalog')
LANGUAGE plpgsql AS $$
BEGIN
    OPEN cur FOR SELECT * FROM fn_get_katalog_barang();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_get_detail_barang(
    p_id_barang INT,
    INOUT cur REFCURSOR DEFAULT 'cur_detail'
)
LANGUAGE plpgsql AS $$
BEGIN
    OPEN cur FOR SELECT * FROM barang WHERE id_barang = p_id_barang;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_get_transaksi_harian(
    p_tanggal DATE DEFAULT CURRENT_DATE,
    INOUT cur REFCURSOR DEFAULT 'cur_trx_harian'
)
LANGUAGE plpgsql AS $$
BEGIN
    OPEN cur FOR SELECT * FROM fn_get_transaksi_harian(p_tanggal);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_get_detail_struk(
    p_id_transaksi INT,
    INOUT cur REFCURSOR DEFAULT 'cur_struk'
)
LANGUAGE plpgsql AS $$
BEGIN
    OPEN cur FOR SELECT fn_get_detail_struk(p_id_transaksi) AS struk_json;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_get_laporan_restock(
    p_id_barang INT DEFAULT NULL,
    p_dari DATE DEFAULT NULL,
    p_sampai DATE DEFAULT NULL,
    INOUT cur REFCURSOR DEFAULT 'cur_restock'
)
LANGUAGE plpgsql AS $$
BEGIN
    OPEN cur FOR SELECT * FROM fn_get_laporan_restock(p_id_barang, p_dari, p_sampai);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_get_daftar_pengguna(INOUT cur REFCURSOR DEFAULT 'cur_pengguna')
LANGUAGE plpgsql AS $$
BEGIN
    OPEN cur FOR SELECT * FROM fn_get_daftar_pengguna();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_buat_akun_kasir(
    p_id_manajer INT,
    p_username TEXT,
    p_password_hash TEXT,
    p_nama_lengkap TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak membuat akun kasir';
    END IF;

    INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, is_active)
    VALUES (p_username, p_password_hash, p_nama_lengkap, 'kasir', TRUE);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_atur_privilege(
    p_id_manajer INT,
    p_username TEXT,
    p_aksi TEXT,
    p_objek TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak mengatur privilege';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_nonaktifkan_akun(
    p_id_manajer INT,
    p_id_target INT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak menonaktifkan akun';
    END IF;

    UPDATE pengguna SET is_active = FALSE WHERE id_pengguna = p_id_target;
END;
$$;

