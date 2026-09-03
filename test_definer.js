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
    -- 1. Create middleman role
    DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pos_definer') THEN CREATE ROLE pos_definer NOLOGIN; END IF; END $$;
    
    -- 2. Grant permissions
    GRANT ALL ON ALL TABLES IN SCHEMA public TO pos_definer;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO pos_definer;

    -- 3. Change ownership of view and function
    ALTER VIEW vw_semua_transaksi OWNER TO pos_definer;
    ALTER FUNCTION fn_get_semua_transaksi() OWNER TO pos_definer;
    
    -- Strip the hardcoded filter from fn_get_semua_transaksi to let RLS do the work!
    CREATE OR REPLACE FUNCTION fn_get_semua_transaksi() RETURNS SETOF vw_semua_transaksi LANGUAGE plpgsql STABLE AS $$ 
    BEGIN 
        RETURN QUERY SELECT * FROM vw_semua_transaksi; 
    END; $$;
    ALTER FUNCTION fn_get_semua_transaksi() OWNER TO pos_definer;

    -- 4. Enable RLS
    ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
    
    -- Since pos_definer is NOT the table owner (pos_admin is), we don't need FORCE ROW LEVEL SECURITY for pos_definer!
    -- RLS naturally applies to them!
    DROP POLICY IF EXISTS rls_trx_context ON transaksi;
    CREATE POLICY rls_trx_context ON transaksi FOR SELECT TO pos_definer USING (
        current_setting('pos.peran', true) = 'manajer' 
        OR (current_setting('pos.peran', true) = 'kasir' AND id_kasir = NULLIF(current_setting('pos.user_id', true), '')::INT)
    );

    -- 5. Create SP and change owner
    CREATE OR REPLACE PROCEDURE sp_test_definer(p_id_pengguna INT, p_peran TEXT, INOUT cur REFCURSOR DEFAULT 'cur') 
    LANGUAGE plpgsql SECURITY DEFINER AS $$ 
    BEGIN 
        PERFORM set_config('pos.user_id', p_id_pengguna::text, true);
        PERFORM set_config('pos.peran', p_peran::text, true);
        OPEN cur FOR SELECT * FROM fn_get_semua_transaksi(); 
    END; $$;
    
    ALTER PROCEDURE sp_test_definer(INT, TEXT, REFCURSOR) OWNER TO pos_definer;
  `);

  console.log('Test SP created. Running test as Kasir 6...');
  
  await client.query('BEGIN');
  const res = await client.query("CALL sp_test_definer(6, 'kasir', 'cur')");
  const rows = await client.query('FETCH ALL IN cur');
  console.log('Result for Kasir (ID 6, should be empty):', rows.rows);
  await client.query('COMMIT');

  console.log('Running test as Manajer 1...');
  await client.query('BEGIN');
  await client.query("CALL sp_test_definer(1, 'manajer', 'cur')");
  const rows2 = await client.query('FETCH ALL IN cur');
  console.log('Result for Manajer (ID 1, should have 3 rows):', rows2.rows.length);
  await client.query('COMMIT');

  await client.end();
}

main().catch(console.error);
