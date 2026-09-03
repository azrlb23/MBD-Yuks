-- =============================================================================
-- POS Kafe Jalur Langit — DDL Schema (7 Tabel Bahasa Indonesia + Restock Adjust)
-- =============================================================================

DROP TABLE IF EXISTS struk CASCADE;
DROP TABLE IF EXISTS detail_transaksi CASCADE;
DROP TABLE IF EXISTS transaksi CASCADE;
DROP TABLE IF EXISTS restock CASCADE;
DROP TABLE IF EXISTS barang CASCADE;
DROP TABLE IF EXISTS kategori CASCADE;
DROP TABLE IF EXISTS pengguna CASCADE;

-- 1. TABEL PENGGUNA (USER ACCESS & AUTH)
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

-- 2. TABEL KATEGORI
CREATE TABLE kategori (
    id_kategori   SERIAL PRIMARY KEY,
    nama_kategori VARCHAR(50) NOT NULL UNIQUE
);

CREATE INDEX idx_kategori_nama ON kategori (nama_kategori);

-- 3. TABEL BARANG (MENU KAFE)
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

-- 4. TABEL TRANSAKSI (HEADER PENJUALAN)
CREATE TABLE transaksi (
    id_transaksi SERIAL PRIMARY KEY,
    id_kasir     INTEGER NOT NULL REFERENCES pengguna(id_pengguna),
    total_bayar  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaksi_kasir ON transaksi (id_kasir);
CREATE INDEX idx_transaksi_created_at ON transaksi (created_at);

-- 5. TABEL DETAIL TRANSAKSI (ITEM PENJUALAN)
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

-- 6. TABEL STRUK (STRUK DIGITAL JSONB)
CREATE TABLE struk (
    id_struk     SERIAL PRIMARY KEY,
    id_transaksi INTEGER UNIQUE NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
    data_struk   JSONB NOT NULL,
    dicetak_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_struk_transaksi ON struk (id_transaksi);

-- 7. TABEL RESTOCK (RIWAYAT PENYESUAIAN STOK MASUK/KELUAR)
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
