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
    -- Drop old procedures
    DROP PROCEDURE IF EXISTS sp_nonaktifkan_akun CASCADE;
    DROP PROCEDURE IF EXISTS sp_nonaktifkan_barang CASCADE;
    
    -- Create new universal procedure
    CREATE OR REPLACE PROCEDURE sp_toggle_status(
        p_id_manajer INT, 
        p_entitas TEXT, 
        p_id_target INT, 
        p_status BOOLEAN
    ) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    BEGIN 
        -- Validasi Manajer
        IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN 
            RAISE EXCEPTION 'Akses ditolak: Hanya Manajer aktif yang berhak mengubah status'; 
        END IF;
        
        -- Toggle logika berdasarkan entitas
        IF p_entitas = 'akun' THEN
            UPDATE pengguna SET is_active = p_status WHERE id_pengguna = p_id_target;
        ELSIF p_entitas = 'barang' THEN
            UPDATE barang SET is_active = p_status WHERE id_barang = p_id_target;
        ELSIF p_entitas = 'kategori' THEN
            UPDATE kategori SET is_active = p_status WHERE id_kategori = p_id_target;
        ELSE
            RAISE EXCEPTION 'Jenis entitas tidak valid (hanya: akun, barang, kategori)';
        END IF;
    END; $$;
  `);

  console.log('Universal status toggle procedure created successfully.');
  await client.end();
}

main().catch(console.error);
