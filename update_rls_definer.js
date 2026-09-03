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
    -- 1. Create Middleman Definer Role (if not exists)
    DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pos_definer') THEN CREATE ROLE pos_definer NOLOGIN; END IF; END $$;
    
    -- 2. Grant permissions to Middleman
    GRANT ALL ON ALL TABLES IN SCHEMA public TO pos_definer;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO pos_definer;

    -- 3. Modify fn_get_semua_transaksi to remove manual filter (let RLS do it)
    CREATE OR REPLACE FUNCTION fn_get_semua_transaksi() RETURNS SETOF vw_semua_transaksi LANGUAGE plpgsql STABLE AS $$ 
    BEGIN 
        RETURN QUERY SELECT * FROM vw_semua_transaksi; 
    END; $$;

    -- 4. Change Ownership of Views and Functions to pos_definer
    ALTER VIEW vw_semua_transaksi OWNER TO pos_definer;
    ALTER FUNCTION fn_get_semua_transaksi() OWNER TO pos_definer;
    
    -- We must drop and recreate procedures if we want to change signature, 
    -- but sp_get_semua_transaksi already has correct signature.
    ALTER PROCEDURE sp_get_semua_transaksi(INT, TEXT, REFCURSOR) OWNER TO pos_definer;

    -- Update sp_get_detail_struk to accept context parameters
    DROP PROCEDURE IF EXISTS sp_get_detail_struk CASCADE;
    CREATE OR REPLACE PROCEDURE sp_get_detail_struk(p_id_pengguna INT, p_peran TEXT, p_id_transaksi INT, INOUT cur REFCURSOR DEFAULT 'cur_struk') 
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ 
    BEGIN 
        PERFORM set_config('pos.user_id', p_id_pengguna::text, true);
        PERFORM set_config('pos.peran', p_peran::text, true);
        OPEN cur FOR SELECT fn_get_detail_struk(p_id_transaksi) AS struk_json; 
    END; $$;
    
    -- Grant execute back since we dropped it
    GRANT EXECUTE ON PROCEDURE sp_get_detail_struk(INT, TEXT, INT, REFCURSOR) TO kasir_role;
    GRANT EXECUTE ON PROCEDURE sp_get_detail_struk(INT, TEXT, INT, REFCURSOR) TO manajer_role;
    
    ALTER PROCEDURE sp_get_detail_struk(INT, TEXT, INT, REFCURSOR) OWNER TO pos_definer;

    -- Update fn_get_detail_struk owner too just in case
    ALTER FUNCTION fn_get_detail_struk(INT) OWNER TO pos_definer;

    -- 5. Enable RLS and Create Policies
    ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
    ALTER TABLE struk ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rls_trx_context ON transaksi;
    CREATE POLICY rls_trx_context ON transaksi FOR SELECT TO pos_definer USING (
        current_setting('pos.peran', true) = 'manajer' 
        OR (current_setting('pos.peran', true) = 'kasir' AND id_kasir = NULLIF(current_setting('pos.user_id', true), '')::INT)
        OR current_setting('pos.peran', true) IS NULL -- Fallback if accessed by admin directly
    );

    DROP POLICY IF EXISTS rls_struk_context ON struk;
    CREATE POLICY rls_struk_context ON struk FOR SELECT TO pos_definer USING (
        current_setting('pos.peran', true) = 'manajer' 
        OR (
            current_setting('pos.peran', true) = 'kasir' 
            AND (SELECT id_kasir FROM transaksi WHERE id_transaksi = struk.id_transaksi) = NULLIF(current_setting('pos.user_id', true), '')::INT
        )
        OR current_setting('pos.peran', true) IS NULL
    );
  `);

  console.log('Definer Role Architecture successfully applied to DB.');
  await client.end();
}

main().catch(console.error);
