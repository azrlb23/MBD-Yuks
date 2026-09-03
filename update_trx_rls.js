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
    -- 1. Cabut RLS lama dan buat Context-Driven RLS
    DROP POLICY IF EXISTS kasir_self_trx_policy ON transaksi;
    DROP POLICY IF EXISTS manajer_all_trx_policy ON transaksi;
    
    ALTER TABLE transaksi DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rls_trx_context ON transaksi;

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
    CREATE OR REPLACE FUNCTION fn_get_semua_transaksi() RETURNS SETOF vw_semua_transaksi LANGUAGE plpgsql STABLE AS $$ 
    BEGIN 
        RETURN QUERY SELECT * FROM vw_semua_transaksi
        WHERE current_setting('pos.peran', true) = 'manajer' 
           OR (current_setting('pos.peran', true) = 'kasir' AND id_kasir = NULLIF(current_setting('pos.user_id', true), '')::INT)
           OR current_setting('pos.peran', true) IS NULL; 
    END; $$;

    DROP PROCEDURE IF EXISTS sp_get_transaksi_harian CASCADE;
    CREATE OR REPLACE PROCEDURE sp_get_semua_transaksi(p_id_pengguna INT, p_peran TEXT, INOUT cur REFCURSOR DEFAULT 'cur_semua_trx') 
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ 
    BEGIN 
        -- Set context variables for RLS to read
        PERFORM set_config('pos.user_id', p_id_pengguna::text, true);
        PERFORM set_config('pos.peran', p_peran::text, true);

        OPEN cur FOR SELECT * FROM fn_get_semua_transaksi(); 
    END; $$;

    GRANT EXECUTE ON PROCEDURE sp_get_semua_transaksi(INT, TEXT, REFCURSOR) TO kasir_role;
    GRANT EXECUTE ON PROCEDURE sp_get_semua_transaksi(INT, TEXT, REFCURSOR) TO manajer_role;
  `);

  console.log('Context-Driven RLS and transaction changes applied successfully to DB.');
  await client.end();
}

main().catch(console.error);
