-- =============================================================================
-- POS Kafe Jalur Langit — Hak Akses PostgreSQL Roles & Row Level Security (RLS)
-- =============================================================================

-- 1. BUAT ROLE POSTGRESQL NOLOGIN
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'manajer_role') THEN
        CREATE ROLE manajer_role NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kasir_role') THEN
        CREATE ROLE kasir_role NOLOGIN;
    END IF;
END $$;

-- 2. HAK AKSES SKEMA & URUTAN SEQUENCES
GRANT USAGE ON SCHEMA public TO manajer_role, kasir_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO manajer_role, kasir_role;

-- 3. REVOKE AKSE TABEL MENTAH (KEAMANAN LAPIS 2 MEMENUHI REPO NOPAL/ASISTEN)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM manajer_role, kasir_role;

-- 4. GRANT HAK EKSKUSI STORED PROCEDURES KHUSUS MANAJER & KASIR
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO manajer_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO manajer_role;

-- Kasir hanya boleh mengeksekusi Stored Procedure yang relevan dengan tugas kasir
GRANT EXECUTE ON PROCEDURE sp_login TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_checkout_transaksi TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_katalog_barang TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_detail_barang TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_transaksi_harian TO kasir_role;
GRANT EXECUTE ON PROCEDURE sp_get_detail_struk TO kasir_role;

-- 5. ROW LEVEL SECURITY (RLS) PADA TABEL TRANSAKSI
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kasir_self_trx_policy ON transaksi;
CREATE POLICY kasir_self_trx_policy ON transaksi
    FOR SELECT TO kasir_role
    USING (id_kasir = (SELECT id_pengguna FROM pengguna WHERE username = CURRENT_USER));

DROP POLICY IF EXISTS manajer_all_trx_policy ON transaksi;
CREATE POLICY manajer_all_trx_policy ON transaksi
    FOR ALL TO manajer_role
    USING (TRUE);
