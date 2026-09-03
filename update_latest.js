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
    DROP PROCEDURE IF EXISTS sp_get_detail_struk CASCADE;

    CREATE OR REPLACE PROCEDURE sp_get_detail_struk(p_id_pengguna INT, p_peran TEXT, p_id_transaksi INT, INOUT cur REFCURSOR DEFAULT 'cur_struk') 
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ 
    BEGIN 
        PERFORM set_config('pos.user_id', p_id_pengguna::text, true);
        PERFORM set_config('pos.peran', p_peran::text, true);
        
        -- Fitur "Latest": Jika -1, ambil ID transaksi terakhir milik Kasir ini (otomatis terfilter oleh RLS)
        IF p_id_transaksi = -1 THEN
            SELECT id_transaksi INTO p_id_transaksi FROM transaksi ORDER BY created_at DESC LIMIT 1;
        END IF;

        OPEN cur FOR SELECT fn_get_detail_struk(p_id_transaksi) AS struk_json; 
    END; $$;
    
    GRANT EXECUTE ON PROCEDURE sp_get_detail_struk(INT, TEXT, INT, REFCURSOR) TO kasir_role;
    GRANT EXECUTE ON PROCEDURE sp_get_detail_struk(INT, TEXT, INT, REFCURSOR) TO manajer_role;
    
    ALTER PROCEDURE sp_get_detail_struk(INT, TEXT, INT, REFCURSOR) OWNER TO pos_definer;
  `);

  console.log('SP get detail struk updated for latest feature.');
  await client.end();
}

main().catch(console.error);
