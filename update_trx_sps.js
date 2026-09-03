import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  user: process.env.DB_USER || 'pos_admin',
  password: process.env.DB_PASSWORD || 'pos_admin_password',
  database: process.env.DB_NAME || 'pos_jalur_langit'
});

async function main() {
  await client.connect();
  
  await client.query(`
    -- 1. Cabut RLS per-kasir dan berikan akses penuh
    DROP POLICY IF EXISTS kasir_self_trx_policy ON transaksi;
    DROP POLICY IF EXISTS manajer_all_trx_policy ON transaksi;
    
    CREATE POLICY all_trx_policy ON transaksi FOR SELECT TO kasir_role, manajer_role USING (TRUE);

    -- 2. Ganti nama View
    DROP VIEW IF EXISTS vw_transaksi_harian CASCADE;
    CREATE OR REPLACE VIEW vw_semua_transaksi AS 
    SELECT t.id_transaksi, t.id_kasir, p.nama_lengkap AS nama_kasir, COUNT(dt.id_detail) AS total_item, t.total_bayar, t.created_at 
    FROM transaksi t 
    JOIN pengguna p ON t.id_kasir = p.id_pengguna 
    LEFT JOIN detail_transaksi dt ON t.id_transaksi = dt.id_transaksi 
    GROUP BY t.id_transaksi, p.nama_lengkap;

    -- 3. Ganti nama Function & Procedure
    DROP FUNCTION IF EXISTS fn_get_transaksi_harian CASCADE;
    CREATE OR REPLACE FUNCTION fn_get_semua_transaksi(p_tanggal DATE DEFAULT NULL) RETURNS SETOF vw_semua_transaksi LANGUAGE plpgsql STABLE AS $$ 
    BEGIN 
        RETURN QUERY SELECT * FROM vw_semua_transaksi WHERE (p_tanggal IS NULL OR created_at::DATE = p_tanggal); 
    END; $$;

    DROP PROCEDURE IF EXISTS sp_get_transaksi_harian CASCADE;
    CREATE OR REPLACE PROCEDURE sp_get_semua_transaksi(p_tanggal DATE DEFAULT NULL, INOUT cur REFCURSOR DEFAULT 'cur_semua_trx') LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ 
    BEGIN 
        OPEN cur FOR SELECT * FROM fn_get_semua_transaksi(p_tanggal); 
    END; $$;

    GRANT EXECUTE ON PROCEDURE sp_get_semua_transaksi TO kasir_role;
    GRANT EXECUTE ON PROCEDURE sp_get_semua_transaksi TO manajer_role;
  `);

  console.log('Transaction changes applied successfully to DB.');
  await client.end();
}

main().catch(console.error);
