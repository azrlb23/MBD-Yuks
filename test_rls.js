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
    -- Re-enable RLS
    ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
    
    -- Policy using session variables
    DROP POLICY IF EXISTS rls_trx_context ON transaksi;
    CREATE POLICY rls_trx_context ON transaksi FOR SELECT TO kasir_role USING (
        id_kasir = NULLIF(current_setting('pos.user_id', true), '')::INT
    );

    -- Grant SELECT so kasir_role can actually read the table
    GRANT SELECT ON transaksi TO kasir_role;
    GRANT SELECT ON vw_semua_transaksi TO kasir_role;
    GRANT SELECT ON pengguna TO kasir_role;
    GRANT SELECT ON detail_transaksi TO kasir_role;
    
    -- Modify SP to use SET LOCAL ROLE
    CREATE OR REPLACE PROCEDURE sp_test_rls(p_id_pengguna INT, p_peran TEXT, INOUT cur REFCURSOR DEFAULT 'cur') 
    LANGUAGE plpgsql SECURITY DEFINER AS $$ 
    BEGIN 
        PERFORM set_config('pos.user_id', p_id_pengguna::text, true);
        
        IF p_peran = 'kasir' THEN
            EXECUTE 'SET LOCAL ROLE kasir_role';
        END IF;

        OPEN cur FOR SELECT * FROM vw_semua_transaksi; 
        
        -- RESET ROLE is automatic at end of transaction
    END; $$;
  `);

  console.log('Test SP created. Running test...');
  
  await client.query('BEGIN');
  const res = await client.query(`CALL sp_test_rls(6, 'kasir', 'cur')`);
  const rows = await client.query('FETCH ALL IN cur');
  console.log('Result for Kasir (ID 6, should be empty):', rows.rows);
  await client.query('COMMIT');

  await client.end();
}

main().catch(console.error);
