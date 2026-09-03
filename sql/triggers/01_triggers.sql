-- =============================================================================
-- POS Kafe Jalur Langit — 3 Trigger Otomatis Basis Data (Tambah & Kurang Stok)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TRIGGER 1: POTONG STOK SAAT CHECKOUT PENJUALAN
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_kurang_stok()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_stok_sisa INT;
BEGIN
    UPDATE barang 
    SET stok = stok - NEW.jumlah 
    WHERE id_barang = NEW.id_barang
    RETURNING stok INTO v_stok_sisa;

    IF v_stok_sisa < 0 THEN
        RAISE EXCEPTION 'Stok porsi menu tidak mencukupi.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kurang_stok ON detail_transaksi;
CREATE TRIGGER trg_kurang_stok
AFTER INSERT ON detail_transaksi
FOR EACH ROW
EXECUTE FUNCTION trg_fn_kurang_stok();

-- -----------------------------------------------------------------------------
-- TRIGGER 2: PENYESUAIAN STOK OTOMATIS (TAMBAH DARI SUPPLIER / KURANG RETUR)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_tambah_stok_restock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_stok_sisa INT;
BEGIN
    UPDATE barang 
    SET stok = stok + NEW.jumlah_tambah 
    WHERE id_barang = NEW.id_barang
    RETURNING stok INTO v_stok_sisa;

    IF v_stok_sisa < 0 THEN
        RAISE EXCEPTION 'Stok barang tidak mencukupi untuk dikurangi/diretur.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tambah_stok_restock ON restock;
CREATE TRIGGER trg_tambah_stok_restock
AFTER INSERT ON restock
FOR EACH ROW
EXECUTE FUNCTION trg_fn_tambah_stok_restock();

-- -----------------------------------------------------------------------------
-- TRIGGER 3: PROTEKSI INTEGRITAS HARGA & STOK BARANG
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_validasi_harga_barang()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.harga <= 0 THEN
        RAISE EXCEPTION 'Harga barang harus lebih besar dari 0.';
    END IF;

    IF NEW.stok < 0 THEN
        RAISE EXCEPTION 'Stok barang tidak boleh negatif.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validasi_harga_barang ON barang;
CREATE TRIGGER trg_validasi_harga_barang
BEFORE INSERT OR UPDATE ON barang
FOR EACH ROW
EXECUTE FUNCTION trg_fn_validasi_harga_barang();
