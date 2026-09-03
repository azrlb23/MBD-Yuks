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
    DROP FUNCTION IF EXISTS fn_get_semua_transaksi(DATE) CASCADE;
    
    CREATE OR REPLACE FUNCTION fn_get_semua_transaksi() RETURNS SETOF vw_semua_transaksi LANGUAGE plpgsql STABLE AS $$ 
    BEGIN 
        RETURN QUERY SELECT * FROM vw_semua_transaksi; 
    END; $$;
  `);

  console.log('Fixed function uniqueness.');
  await client.end();
}

main().catch(console.error);
