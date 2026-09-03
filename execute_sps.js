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
    CREATE OR REPLACE PROCEDURE sp_buat_akun_kasir(
        p_id_manajer INT,
        p_username TEXT,
        p_password_hash TEXT,
        p_nama_lengkap TEXT
    )
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak membuat akun kasir';
        END IF;

        INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, is_active)
        VALUES (p_username, p_password_hash, p_nama_lengkap, 'kasir', TRUE);
    END;
    $$;

    CREATE OR REPLACE PROCEDURE sp_atur_privilege(
        p_id_manajer INT,
        p_username TEXT,
        p_aksi TEXT,
        p_objek TEXT
    )
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak mengatur privilege';
        END IF;
    END;
    $$;

    CREATE OR REPLACE PROCEDURE sp_nonaktifkan_akun(
        p_id_manajer INT,
        p_id_target INT
    )
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya Manajer yang berhak menonaktifkan akun';
        END IF;

        UPDATE pengguna SET is_active = FALSE WHERE id_pengguna = p_id_target;
    END;
    $$;
  `);

  console.log('Account SPs executed successfully.');
  await client.end();
}

main().catch(console.error);
