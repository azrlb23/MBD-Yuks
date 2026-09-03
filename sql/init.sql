-- =============================================================================
-- POS Kafe Jalur Langit — Master Auto-Init Script for Docker Container (7 Tabel)
-- Location: /docker-entrypoint-initdb.d/01_init.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DDL SCHEMA (7 TABEL BAHASA INDONESIA)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS struk CASCADE;
DROP TABLE IF EXISTS detail_transaksi CASCADE;
DROP TABLE IF EXISTS transaksi CASCADE;
DROP TABLE IF EXISTS restock CASCADE;
DROP TABLE IF EXISTS barang CASCADE;
DROP TABLE IF EXISTS kategori CASCADE;
DROP TABLE IF EXISTS pengguna CASCADE;

CREATE TABLE pengguna (
    id_pengguna   SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap  VARCHAR(100) NOT NULL,
    peran         VARCHAR(20) NOT NULL CHECK (peran IN ('manajer', 'kasir')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX idx_pengguna_username ON pengguna (username);
CREATE INDEX idx_pengguna_is_active ON pengguna (is_active);

CREATE TABLE kategori (
    id_kategori   SERIAL PRIMARY KEY,
    nama_kategori VARCHAR(50) NOT NULL UNIQUE
);

CREATE INDEX idx_kategori_nama ON kategori (nama_kategori);

CREATE TABLE barang (
    id_barang   SERIAL PRIMARY KEY,
    nama_barang VARCHAR(100) NOT NULL,
    id_kategori INTEGER NOT NULL REFERENCES kategori(id_kategori) ON DELETE RESTRICT,
    harga       NUMERIC(12,2) NOT NULL CHECK (harga > 0),
    stok        INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
    spesifikasi JSONB NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_barang_kategori ON barang (id_kategori);
CREATE INDEX idx_barang_is_active ON barang (is_active);
CREATE INDEX idx_barang_spek_gin ON barang USING GIN (spesifikasi);

CREATE TABLE transaksi (
    id_transaksi SERIAL PRIMARY KEY,
    id_kasir     INTEGER NOT NULL REFERENCES pengguna(id_pengguna),
    total_bayar  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaksi_kasir ON transaksi (id_kasir);
CREATE INDEX idx_transaksi_created_at ON transaksi (created_at);

CREATE TABLE detail_transaksi (
    id_detail    SERIAL PRIMARY KEY,
    id_transaksi INTEGER NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
    id_barang    INTEGER NOT NULL REFERENCES barang(id_barang),
    nama_barang  VARCHAR(100) NOT NULL,
    harga_satuan NUMERIC(12,2) NOT NULL CHECK (harga_satuan > 0),
    jumlah       INTEGER NOT NULL CHECK (jumlah > 0),
    subtotal     NUMERIC(14,2) NOT NULL CHECK (subtotal > 0)
);

CREATE INDEX idx_detail_transaksi ON detail_transaksi (id_transaksi);
CREATE INDEX idx_detail_barang ON detail_transaksi (id_barang);

CREATE TABLE struk (
    id_struk     SERIAL PRIMARY KEY,
    id_transaksi INTEGER UNIQUE NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
    data_struk   JSONB NOT NULL,
    dicetak_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_struk_transaksi ON struk (id_transaksi);

CREATE TABLE restock (
    id_restock    SERIAL PRIMARY KEY,
    id_barang     INTEGER NOT NULL REFERENCES barang(id_barang),
    jumlah_tambah INTEGER NOT NULL CHECK (jumlah_tambah != 0),
    id_manajer    INTEGER NOT NULL REFERENCES pengguna(id_pengguna),
    nama_supplier VARCHAR(100) NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restock_barang ON restock (id_barang);
CREATE INDEX idx_restock_manajer ON restock (id_manajer);
CREATE INDEX idx_restock_created_at ON restock (created_at);

-- -----------------------------------------------------------------------------
-- 2. INITIAL SEED DATA
-- -----------------------------------------------------------------------------
INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, is_active) VALUES
('manajer1', 'manajer123', 'Budi Manajer Utama', 'manajer', TRUE),
('kasir1',   'kasir123',   'Siti Kasir Shift Pagi', 'kasir', TRUE),
('kasir2',   'kasir123',   'Rian Kasir Shift Malam', 'kasir', TRUE);

INSERT INTO kategori (nama_kategori) VALUES
('Minuman Kopi'), ('Minuman Non-Kopi'), ('Pastry & Dessert'), ('Makanan Berat'), ('Cemilan');

INSERT INTO barang (nama_barang, id_kategori, harga, stok, spesifikasi) VALUES
('Kopi Susu Gula Aren', 1, 22000.00, 45, '{"suhu": ["dingin", "panas"], "tingkat_gula": ["normal", "sedikit"]}'::jsonb),
('Americano Single Shot', 1, 18000.00, 50, '{"suhu": ["dingin", "panas"], "biji_kopi": "Arabika Gayo"}'::jsonb),
('Caramel Macchiato', 1, 28000.00, 30, '{"suhu": ["dingin", "panas"], "caramel_drizzle": true}'::jsonb),
('Matcha Latte Ice', 2, 26000.00, 35, '{"jenis_susu": ["susu_sapi", "susu_oat"]}'::jsonb),
('Chocolate Signature Cold', 2, 25000.00, 40, '{"whipped_cream": true}'::jsonb),
('Croissant Butter Classic', 3, 25000.00, 15, '{"dihangatkan": true}'::jsonb),
('Choco Lava Cake', 3, 28000.00, 12, '{"dihangatkan": true}'::jsonb),
('Nasi Goreng Kafe Spesial', 4, 32000.00, 25, '{"level_pedas": [1, 2, 3]}'::jsonb),
('Spaghetti Carbonara', 4, 35000.00, 20, '{"ekstra_keju": true}'::jsonb),
('French Fries Sea Salt', 5, 18000.00, 60, '{"saus": ["sambal", "mayones"]}'::jsonb);

INSERT INTO restock (id_barang, jumlah_tambah, id_manajer, nama_supplier) VALUES
(1, 50, 1, 'PT Biji Kopi Nusantara'), (3, 35, 1, 'CV Sirup Caramel Indo'), (6, 20, 1, 'Bakery Supplier Utama');

INSERT INTO transaksi (id_kasir, total_bayar, created_at) VALUES
(2, 47000.00, NOW() - INTERVAL '2 hours'), (3, 50000.00, NOW() - INTERVAL '30 minutes');

INSERT INTO detail_transaksi (id_transaksi, id_barang, nama_barang, harga_satuan, jumlah, subtotal) VALUES
(1, 1, 'Kopi Susu Gula Aren', 22000.00, 1, 22000.00), (1, 6, 'Croissant Butter Classic', 25000.00, 1, 25000.00),
(2, 5, 'Chocolate Signature Cold', 25000.00, 2, 50000.00);

INSERT INTO struk (id_transaksi, data_struk, dicetak_at) VALUES
(1, jsonb_build_object('id_transaksi', 1, 'kasir', 'Siti Kasir Shift Pagi', 'tanggal', NOW() - INTERVAL '2 hours', 'items', '[{"nama_barang":"Kopi Susu Gula Aren","harga_satuan":22000,"jumlah":1,"subtotal":22000},{"nama_barang":"Croissant Butter Classic","harga_satuan":25000,"jumlah":1,"subtotal":25000}]'::jsonb, 'total_bayar', 47000.00), NOW() - INTERVAL '2 hours'),
(2, jsonb_build_object('id_transaksi', 2, 'kasir', 'Rian Kasir Shift Malam', 'tanggal', NOW() - INTERVAL '30 minutes', 'items', '[{"nama_barang":"Chocolate Signature Cold","harga_satuan":25000,"jumlah":2,"subtotal":50000}]'::jsonb, 'total_bayar', 50000.00), NOW() - INTERVAL '30 minutes');

-- -----------------------------------------------------------------------------
-- 3. VIEWS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_daftar_pengguna AS SELECT id_pengguna, username, nama_lengkap, peran, is_active FROM pengguna WHERE is_active = TRUE;
CREATE OR REPLACE VIEW vw_katalog_barang AS SELECT b.id_barang, b.nama_barang, k.nama_kategori, b.harga, b.stok, b.spesifikasi, b.is_active FROM barang b JOIN kategori k ON b.id_kategori = k.id_kategori WHERE b.is_active = TRUE;
CREATE OR REPLACE VIEW vw_transaksi_harian AS SELECT t.id_transaksi, t.id_kasir, p.nama_lengkap AS nama_kasir, COUNT(dt.id_detail) AS total_item, t.total_bayar, t.created_at FROM transaksi t JOIN pengguna p ON t.id_kasir = p.id_pengguna LEFT JOIN detail_transaksi dt ON t.id_transaksi = dt.id_transaksi GROUP BY t.id_transaksi, p.nama_lengkap;
CREATE OR REPLACE VIEW vw_laporan_restock AS SELECT r.id_restock, r.id_barang, b.nama_barang, r.jumlah_tambah, r.id_manajer, p.nama_lengkap AS nama_manajer, r.nama_supplier, r.created_at FROM restock r JOIN barang b ON r.id_barang = b.id_barang JOIN pengguna p ON r.id_manajer = p.id_pengguna;
CREATE OR REPLACE VIEW vw_barang_spesifikasi AS SELECT b.id_barang, b.nama_barang, k.nama_kategori, b.harga, b.stok, kv.key AS spek_kunci, kv.value AS spek_nilai FROM barang b JOIN kategori k ON b.id_kategori = k.id_kategori, LATERAL jsonb_each_text(b.spesifikasi) kv WHERE b.is_active = TRUE;

-- -----------------------------------------------------------------------------
-- 4. READ-ONLY FUNCTIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validasi_kredensial(p_username TEXT, p_password TEXT) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$ DECLARE v_valid BOOLEAN := FALSE; BEGIN SELECT (password_hash = p_password) INTO v_valid FROM pengguna WHERE username = p_username AND is_active = TRUE; RETURN COALESCE(v_valid, FALSE); END; $$;
CREATE OR REPLACE FUNCTION fn_validasi_ketersediaan(p_id_barang INT, p_jumlah INT) RETURNS TABLE(valid BOOLEAN, stok_saat_ini INT, harga NUMERIC, nama_barang VARCHAR) LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY SELECT (b.stok >= p_jumlah AND b.is_active = TRUE) AS valid, b.stok AS stok_saat_ini, b.harga, b.nama_barang FROM barang b WHERE b.id_barang = p_id_barang; END; $$;
CREATE OR REPLACE FUNCTION fn_merge_spesifikasi(p_spek_lama JSONB, p_spek_baru JSONB) RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN COALESCE(p_spek_lama, '{}'::JSONB) || COALESCE(p_spek_baru, '{}'::JSONB); END; $$;
CREATE OR REPLACE FUNCTION fn_get_detail_struk(p_id_transaksi INT) RETURNS JSONB LANGUAGE plpgsql STABLE AS $$ DECLARE v_struk JSONB; BEGIN SELECT s.data_struk INTO v_struk FROM struk s WHERE s.id_transaksi = p_id_transaksi; RETURN v_struk; END; $$;
CREATE OR REPLACE FUNCTION fn_get_daftar_pengguna() RETURNS SETOF vw_daftar_pengguna LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY SELECT * FROM vw_daftar_pengguna; END; $$;
CREATE OR REPLACE FUNCTION fn_get_katalog_barang() RETURNS SETOF vw_katalog_barang LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY SELECT * FROM vw_katalog_barang; END; $$;
CREATE OR REPLACE FUNCTION fn_get_transaksi_harian(p_tanggal DATE DEFAULT CURRENT_DATE) RETURNS SETOF vw_transaksi_harian LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY SELECT * FROM vw_transaksi_harian WHERE (p_tanggal IS NULL OR created_at::DATE = p_tanggal); END; $$;
CREATE OR REPLACE FUNCTION fn_get_laporan_restock(p_id_barang INT DEFAULT NULL, p_dari DATE DEFAULT NULL, p_sampai DATE DEFAULT NULL) RETURNS SETOF vw_laporan_restock LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN QUERY SELECT * FROM vw_laporan_restock r WHERE (p_id_barang IS NULL OR r.id_barang = p_id_barang) AND (p_dari IS NULL OR r.created_at::DATE >= p_dari) AND (p_sampai IS NULL OR r.created_at::DATE <= p_sampai); END; $$;

-- -----------------------------------------------------------------------------
-- 5. 3 AUTOMATIC TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_kurang_stok() RETURNS TRIGGER LANGUAGE plpgsql AS $$ DECLARE v_stok_sisa INT; BEGIN UPDATE barang SET stok = stok - NEW.jumlah WHERE id_barang = NEW.id_barang RETURNING stok INTO v_stok_sisa; IF v_stok_sisa < 0 THEN RAISE EXCEPTION 'Stok porsi menu tidak mencukupi.'; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_kurang_stok ON detail_transaksi;
CREATE TRIGGER trg_kurang_stok AFTER INSERT ON detail_transaksi FOR EACH ROW EXECUTE FUNCTION trg_fn_kurang_stok();

CREATE OR REPLACE FUNCTION trg_fn_tambah_stok_restock() RETURNS TRIGGER LANGUAGE plpgsql AS $$ DECLARE v_stok_sisa INT; BEGIN UPDATE barang SET stok = stok + NEW.jumlah_tambah WHERE id_barang = NEW.id_barang RETURNING stok INTO v_stok_sisa; IF v_stok_sisa < 0 THEN RAISE EXCEPTION 'Stok barang tidak mencukupi untuk dikurangi/diretur.'; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_tambah_stok_restock ON restock;
CREATE TRIGGER trg_tambah_stok_restock AFTER INSERT ON restock FOR EACH ROW EXECUTE FUNCTION trg_fn_tambah_stok_restock();

CREATE OR REPLACE FUNCTION trg_fn_validasi_harga_barang() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.harga <= 0 THEN RAISE EXCEPTION 'Harga barang harus lebih besar dari 0.'; END IF; IF NEW.stok < 0 THEN RAISE EXCEPTION 'Stok barang tidak boleh negatif.'; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_validasi_harga_barang ON barang;
CREATE TRIGGER trg_validasi_harga_barang BEFORE INSERT OR UPDATE ON barang FOR EACH ROW EXECUTE FUNCTION trg_fn_validasi_harga_barang();

-- -----------------------------------------------------------------------------
-- 6. STORED PROCEDURES
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_login(p_username TEXT, p_password TEXT, INOUT p_id_pengguna INT DEFAULT NULL, INOUT p_nama TEXT DEFAULT NULL, INOUT p_peran TEXT DEFAULT NULL) LANGUAGE plpgsql AS $$
DECLARE v_is_valid BOOLEAN; BEGIN v_is_valid := fn_validasi_kredensial(p_username, p_password); IF NOT v_is_valid THEN RAISE EXCEPTION 'Kredensial login salah atau akun tidak aktif' USING ERRCODE = '28P01'; END IF; SELECT id_pengguna, nama_lengkap, peran INTO p_id_pengguna, p_nama, p_peran FROM pengguna WHERE username = p_username; END; $$;

CREATE OR REPLACE PROCEDURE sp_checkout_transaksi(p_id_kasir INT, p_items_jsonb JSONB, INOUT p_id_transaksi INT DEFAULT NULL, INOUT p_total_bayar NUMERIC DEFAULT NULL) LANGUAGE plpgsql AS $$
DECLARE v_item JSONB; v_id_barang INT; v_jumlah INT; v_nama_barang VARCHAR(100); v_harga_satuan NUMERIC(12,2); v_valid BOOLEAN; v_subtotal_item NUMERIC(14,2); v_total NUMERIC(14,2) := 0.00; v_items_struk JSONB := '[]'::JSONB; v_nama_kasir VARCHAR(100);
BEGIN
    SELECT nama_lengkap INTO v_nama_kasir FROM pengguna WHERE id_pengguna = p_id_kasir AND is_active = TRUE;
    IF v_nama_kasir IS NULL THEN RAISE EXCEPTION 'Kasir tidak ditemukan atau akun tidak aktif'; END IF;
    INSERT INTO transaksi (id_kasir, total_bayar) VALUES (p_id_kasir, 0.00) RETURNING id_transaksi INTO p_id_transaksi;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_jsonb) LOOP
        v_id_barang := (v_item->>'id_barang')::INT; v_jumlah := (v_item->>'jumlah')::INT;
        SELECT valid, harga, nama_barang INTO v_valid, v_harga_satuan, v_nama_barang FROM fn_validasi_ketersediaan(v_id_barang, v_jumlah);
        IF NOT COALESCE(v_valid, FALSE) THEN RAISE EXCEPTION 'Barang ID % stok tidak mencukupi', v_id_barang; END IF;
        v_subtotal_item := v_harga_satuan * v_jumlah; v_total := v_total + v_subtotal_item;
        INSERT INTO detail_transaksi (id_transaksi, id_barang, nama_barang, harga_satuan, jumlah, subtotal) VALUES (p_id_transaksi, v_id_barang, v_nama_barang, v_harga_satuan, v_jumlah, v_subtotal_item);
        v_items_struk := v_items_struk || jsonb_build_object('id_barang', v_id_barang, 'nama_barang', v_nama_barang, 'harga_satuan', v_harga_satuan, 'jumlah', v_jumlah, 'subtotal', v_subtotal_item);
    END LOOP;
    p_total_bayar := v_total;
    UPDATE transaksi SET total_bayar = p_total_bayar WHERE id_transaksi = p_id_transaksi;
    INSERT INTO struk (id_transaksi, data_struk) VALUES (p_id_transaksi, jsonb_build_object('id_transaksi', p_id_transaksi, 'kasir', v_nama_kasir, 'tanggal', NOW(), 'items', v_items_struk, 'total_bayar', p_total_bayar));
END; $$;

CREATE OR REPLACE PROCEDURE sp_restock_barang(p_id_manajer INT, p_id_barang INT, p_jumlah_tambah INT, p_nama_supplier VARCHAR(100) DEFAULT NULL) LANGUAGE plpgsql AS $$
DECLARE v_stok_lama INT; BEGIN IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak melakukan restock/penyesuaian stok'; END IF; SELECT stok INTO v_stok_lama FROM barang WHERE id_barang = p_id_barang; IF v_stok_lama IS NULL THEN RAISE EXCEPTION 'Barang tidak ditemukan'; END IF; INSERT INTO restock (id_barang, jumlah_tambah, id_manajer, nama_supplier) VALUES (p_id_barang, p_jumlah_tambah, p_id_manajer, p_nama_supplier); END; $$;

CREATE OR REPLACE PROCEDURE sp_update_harga_spesifikasi(p_id_manajer INT, p_id_barang INT, p_harga_baru NUMERIC DEFAULT NULL, p_spek_baru JSONB DEFAULT NULL) LANGUAGE plpgsql AS $$
DECLARE v_spek_lama JSONB; v_spek_merged JSONB; BEGIN IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak mengubah harga/spesifikasi'; END IF; SELECT spesifikasi INTO v_spek_lama FROM barang WHERE id_barang = p_id_barang; v_spek_merged := fn_merge_spesifikasi(v_spek_lama, p_spek_baru); UPDATE barang SET harga = COALESCE(p_harga_baru, harga), spesifikasi = v_spek_merged WHERE id_barang = p_id_barang; END; $$;

CREATE OR REPLACE PROCEDURE sp_get_katalog_barang(INOUT cur REFCURSOR DEFAULT 'cur_katalog') LANGUAGE plpgsql AS $$ BEGIN OPEN cur FOR SELECT * FROM fn_get_katalog_barang(); END; $$;
CREATE OR REPLACE PROCEDURE sp_get_detail_barang(p_id_barang INT, INOUT cur REFCURSOR DEFAULT 'cur_detail') LANGUAGE plpgsql AS $$ BEGIN OPEN cur FOR SELECT * FROM barang WHERE id_barang = p_id_barang; END; $$;
CREATE OR REPLACE PROCEDURE sp_get_transaksi_harian(p_tanggal DATE DEFAULT CURRENT_DATE, INOUT cur REFCURSOR DEFAULT 'cur_trx_harian') LANGUAGE plpgsql AS $$ BEGIN OPEN cur FOR SELECT * FROM fn_get_transaksi_harian(p_tanggal); END; $$;
CREATE OR REPLACE PROCEDURE sp_get_detail_struk(p_id_transaksi INT, INOUT cur REFCURSOR DEFAULT 'cur_struk') LANGUAGE plpgsql AS $$ BEGIN OPEN cur FOR SELECT fn_get_detail_struk(p_id_transaksi) AS struk_json; END; $$;
CREATE OR REPLACE PROCEDURE sp_get_laporan_restock(p_id_barang INT DEFAULT NULL, p_dari DATE DEFAULT NULL, p_sampai DATE DEFAULT NULL, INOUT cur REFCURSOR DEFAULT 'cur_restock') LANGUAGE plpgsql AS $$ BEGIN OPEN cur FOR SELECT * FROM fn_get_laporan_restock(p_id_barang, p_dari, p_sampai); END; $$;
CREATE OR REPLACE PROCEDURE sp_get_daftar_pengguna(INOUT cur REFCURSOR DEFAULT 'cur_pengguna') LANGUAGE plpgsql AS $$ BEGIN OPEN cur FOR SELECT * FROM fn_get_daftar_pengguna(); END; $$;

-- -----------------------------------------------------------------------------
-- 7. ROLES & RLS SECURITY
-- -----------------------------------------------------------------------------
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manajer_role') THEN CREATE ROLE manajer_role NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kasir_role') THEN CREATE ROLE kasir_role NOLOGIN; END IF; END $$;

GRANT USAGE ON SCHEMA public TO manajer_role, kasir_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO manajer_role, kasir_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM manajer_role, kasir_role;

GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO manajer_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO manajer_role;

GRANT EXECUTE ON PROCEDURE sp_login TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_checkout_transaksi TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_katalog_barang TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_detail_barang TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_transaksi_harian TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_detail_struk TO kasir_role;

ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kasir_self_trx_policy ON transaksi;
CREATE POLICY kasir_self_trx_policy ON transaksi FOR SELECT TO kasir_role USING (id_kasir = (SELECT id_pengguna FROM pengguna WHERE username = CURRENT_USER));

DROP POLICY IF EXISTS manajer_all_trx_policy ON transaksi;
CREATE POLICY manajer_all_trx_policy ON transaksi FOR ALL TO manajer_role USING (TRUE);
