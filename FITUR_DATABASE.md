# Dokumen Pemahaman & Implementasi 11 Fitur Database PostgreSQL

Dokumen ini berisi panduan komprehensif mengenai **11 Fitur Utama Database PostgreSQL** yang diterapkan dalam proyek **POS Kafe Jalur Langit (MBD)**. Setiap fitur dilengkapi dengan pemahaman konsep dasar, alasan penggunaan, serta potongan kode asli (*codebase*) dari `sql/init.sql` dan aplikasi Node.js.

---

## Daftar Isi
1. [Constraints Data (Integritas Data)](#1-constraints-data-integritas-data)
2. [Pengindeksan Data (B-Tree & GIN Index)](#2-pengindeksan-data-b-tree--gin-index)
3. [Virtual Tables / Views (`vw_*`)](#3-virtual-tables--views-vw_)
4. [Stored Procedures (`sp_*`)](#4-stored-procedures-sp_)
5. [Triggers & Trigger Functions (`trg_*` & `trg_fn_*`)](#5-triggers--trigger-functions-trg_-amp-trg_fn_)
6. [Row-Level Security (RLS) & Security Policies](#6-row-level-security-rls--security-policies)
7. [Database Roles & Privilege Management (`GRANT`, `REVOKE`, `SECURITY DEFINER`)](#7-database-roles--privilege-management)
8. [Variabel Sesi Dinamis (GUC / `set_config`)](#8-variabel-sesi-dinamis-guc--set_config)
9. [Concurrency Control & Pessimistic Locking (`FOR UPDATE`)](#9-concurrency-control--pessimistic-locking-for-update)
10. [Tipe Data Modern (`JSONB` & `SERIAL/IDENTITY`)](#10-tipe-data-modern-jsonb--serialidentity)
11. [Manajemen Transaksi ACID (`BEGIN`, `COMMIT`, `ROLLBACK`)](#11-manajemen-transaksi-acid)

---

## 1. Constraints Data (Integritas Data)

### Pemahaman Konsep
*Data Constraints* (Batasan Integritas) adalah aturan-aturan yang diterapkan pada tingkat kolom atau tabel untuk menjamin bahwa data yang masuk ke database selalu valid, konsisten, dan memenuhi aturan bisnis (*Business Rules*).

### Jenis Constraint di Codebase:
*   **`PRIMARY KEY`**: Menjamin setiap baris memiliki identitas unik dan tidak boleh `NULL`.
*   **`FOREIGN KEY`**: Menjamin hubungan antar tabel (*referential integrity*).
    *   `ON DELETE RESTRICT`: Mencegah penghapusan induk jika data anak masih ada (misal: kategori tidak boleh dihapus jika masih ada barang yang menggunakannya).
    *   `ON DELETE CASCADE`: Menghapus data anak secara otomatis jika data induk dihapus (misal: menghapus transaksi akan menghapus detail transaksinya).
*   **`CHECK`**: Memvalidasi ekspresi logika data sebelum disimpan (misal: harga harus positif).
*   **`UNIQUE`**: Menjamin tidak ada dua baris yang memiliki nilai kolom sama (misal: `username`).
*   **`NOT NULL` & `DEFAULT`**: Menjamin kolom harus terisi atau diberi nilai bawaan jika tidak diisi.

### Contoh Kode (`sql/init.sql`):
```sql
CREATE TABLE barang (
    id_barang   SERIAL PRIMARY KEY,
    nama_barang VARCHAR(100) NOT NULL,
    id_kategori INTEGER NOT NULL REFERENCES kategori(id_kategori) ON DELETE RESTRICT,
    harga       NUMERIC(12,2) NOT NULL CHECK (harga > 0),
    stok        INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
    spesifikasi JSONB NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);
```

---

## 2. Pengindeksan Data (B-Tree & GIN Index)

### Pemahaman Konsep
Index adalah struktur data tambahan di database yang berfungsi mempercepat proses pencarian data (`SELECT`) tanpa harus memindai seluruh isi tabel (*Sequential Scan*).

### Perbedaan B-Tree dan GIN di Codebase:
1.  **B-Tree (Balanced Tree)**:
    *   Index bawaan PostgreSQL.
    *   Digunakan untuk nilai skalar tunggal, pencarian persis (`=`), perbandingan rentang (`>`, `<`, `BETWEEN`), dan pengurutan (`ORDER BY`).
2.  **GIN (Generalized Inverted Index)**:
    *   Digunakan untuk data bertingkat/majemuk seperti `JSONB` atau `ARRAY`.
    *   Memecah elemen di dalam JSONB sehingga kueri pencarian kunci/nilai di dalam JSONB berjalan sangat cepat.

### Contoh Kode (`sql/init.sql`):
```sql
    -- B-Tree Index untuk Foreign Key dan Kolom Skalar
    CREATE UNIQUE INDEX idx_pengguna_username ON pengguna (username);
    CREATE INDEX idx_transaksi_kasir ON transaksi (id_kasir);
    CREATE INDEX idx_transaksi_created_at ON transaksi (created_at);

    -- GIN Index khusus untuk kolom bertipe JSONB (Spesifikasi Barang)
    CREATE INDEX idx_barang_spek_gin ON barang USING GIN (spesifikasi);
```
*Penggunaan Kueri GIN:*
```sql
-- Mencari barang yang memiliki spesifikasi suhu dingin dengan efisien:
SELECT * FROM barang WHERE spesifikasi @> '{"suhu": ["dingin"]}';
```

---

## 3. Virtual Tables / Views (`vw_*`)

### Pemahaman Konsep
View adalah tabel virtual yang terbentuk dari kueri `SELECT` yang tersimpan di database. View tidak menyimpan data fisik (kecuali Materialized View), melainkan menyajikan representasi data yang terorganisir dari satu atau beberapa tabel.

### Alasan Penggunaan:
*   **Abstraksi & Penyederhanaan**: Menyembunyikan kueri `JOIN` yang kompleks dari aplikasi.
*   **Keamanan Data**: Menyembunyikan kolom sensitif (seperti `password_hash` dan `token_aktif`) agar tidak pernah terekspos ke aplikasi client.

### Contoh Kode (`sql/init.sql`):
```sql
-- View untuk katalog barang aktif (JOIN dengan Kategori)
CREATE OR REPLACE VIEW vw_katalog_barang AS
SELECT b.id_barang, b.nama_barang, b.id_kategori, k.nama_kategori,
       b.harga, b.stok, b.spesifikasi
FROM barang b
JOIN kategori k ON b.id_kategori = k.id_kategori
WHERE b.is_active = TRUE;

-- View untuk daftar pengguna (menyembunyikan password_hash)
CREATE OR REPLACE VIEW vw_daftar_pengguna AS
SELECT id_pengguna, username, nama_lengkap, peran, is_active
FROM pengguna;
```

---

## 4. Stored Procedures (`sp_*`)

### Pemahaman Konsep
Stored Procedure adalah kumpulan blok kode SQL/PL-pgSQL yang tersimpan di server database dan dapat dipanggil menggunakan perintah `CALL`. Berbeda dengan Function standar, Stored Procedure dapat mengontrol transaksi secara eksplisit (`COMMIT` / `ROLLBACK`).

### Alasan Penggunaan:
*   **Enkapsulasi Logika Bisnis**: Seluruh proses transaksi kasir dan restock dijalankan langsung di dalam database.
*   **Performa**: Mengurangi *network round-trip* antara server Node.js dan database PostgreSQL.
*   **Keamanan**: Aplikasi Node.js tidak perlu menjalankan kueri `INSERT` atau `UPDATE` mentah secara langsung.

### Contoh Kode (`sql/init.sql`):
```sql
CREATE OR REPLACE PROCEDURE sp_buat_transaksi(
    p_id_kasir    INT,
    p_items       JSONB,
    INOUT p_id_trx INT DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_harga NUMERIC;
    v_stok INT;
    v_nama VARCHAR;
    v_total NUMERIC := 0;
BEGIN
    INSERT INTO transaksi (id_kasir, total_bayar)
    VALUES (p_id_kasir, 0) RETURNING id_transaksi INTO p_id_trx;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id_barang INT, jumlah INT) LOOP
        -- Logika pemeriksaan stok & perhitungan subtotal
        ...
    END LOOP;
END;
$$;
```

---

## 5. Triggers & Trigger Functions (`trg_*` & `trg_fn_*`)

### Pemahaman Konsep
Trigger adalah pengait otomatis di database yang akan mengeksekusi suatu fungsi (*Trigger Function*) ketika terjadi peristiwa tertentu (`INSERT`, `UPDATE`, atau `DELETE`) pada sebuah tabel.

### Jenis Trigger di Codebase:
1.  **`BEFORE` Trigger**: Berjalan *sebelum* baris data ditulis/diubah. Digunakan untuk validasi ketat.
2.  **`AFTER` Trigger**: Berjalan *setelah* baris data berhasil ditulis. Digunakan untuk efek samping atau otomatisasi pencatatan (audit log).

### Contoh Kode (`sql/init.sql`):
```sql
-- 1. Trigger Function untuk validasi (BEFORE)
CREATE OR REPLACE FUNCTION trg_fn_validasi_barang()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.harga <= 0 THEN
        RAISE EXCEPTION 'Harga barang harus lebih besar dari 0!';
    END IF;
    IF NEW.stok < 0 THEN
        RAISE EXCEPTION 'Stok barang tidak boleh negatif!';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validasi_harga_barang
BEFORE INSERT OR UPDATE ON barang
FOR EACH ROW EXECUTE FUNCTION trg_fn_validasi_barang();

-- 2. Trigger Function untuk otomatisasi restock (AFTER)
CREATE OR REPLACE FUNCTION trg_fn_tambah_stok_restock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE barang SET stok = stok + NEW.jumlah_tambah
    WHERE id_barang = NEW.id_barang;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_tambah_stok
AFTER INSERT ON restock
FOR EACH ROW EXECUTE FUNCTION trg_fn_tambah_stok_restock();
```

---

## 6. Row-Level Security (RLS) & Security Policies

### Pemahaman Konsep
Row-Level Security (RLS) adalah fitur keamanan PostgreSQL yang membatasi baris mana saja di dalam tabel yang boleh dilihat atau dimodifikasi oleh kueri `SELECT`, `INSERT`, `UPDATE`, atau `DELETE` berdasarkan atribut peran atau ID pengguna yang sedang aktif.

### Alasan Penggunaan:
Mencegah kasir mengakses data transaksi kasir lain pada tingkat database (Isolasi Data Multitenant/Multi-user).

### Contoh Kode (`sql/init.sql`):
```sql
-- Mengaktifkan RLS pada tabel transaksi
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS: Kasir hanya bisa melihat transaksinya sendiri, Manajer bisa lihat semua
CREATE POLICY policy_kasir_transaksi ON transaksi
FOR SELECT
TO PUBLIC
USING (
    id_kasir = NULLIF(current_setting('pos.user_id', true), '')::INT
    OR 
    EXISTS (
        SELECT 1 FROM pengguna 
        WHERE id_pengguna = NULLIF(current_setting('pos.user_id', true), '')::INT 
          AND peran = 'manajer'
    )
);
```

---

## 7. Database Roles & Privilege Management

### Pemahaman Konsep
PostgreSQL menggunakan sistem perizinan berbasis Role (Peran). Dalam proyek ini, kita memisahkan peran pengguna aplikasi database menjadi beberapa role terpisah dengan tingkat hak akses yang berbeda (*Principle of Least Privilege*).

### Konsep `SECURITY DEFINER`:
Fungsi atau Stored Procedure dengan klausul `SECURITY DEFINER` akan dieksekusi menggunakan hak akses milik **pembuat prosedur (owner/admin)**, bukan pengguna yang memanggilnya. Ini memungkinkan role `pos_kasir` menjalankan `sp_buat_transaksi` tanpa memberikan hak `UPDATE` langsung pada tabel `barang`.

### Contoh Kode (`sql/init.sql`):
```sql
-- Membuat Role Khusus Aplikasi
CREATE ROLE pos_app WITH LOGIN PASSWORD 'pos_app_password';
CREATE ROLE pos_manajer;
CREATE ROLE pos_kasir;

-- Memberikan Izin Terbatas
GRANT SELECT ON vw_katalog_barang TO pos_kasir;
GRANT EXECUTE ON PROCEDURE sp_buat_transaksi TO pos_kasir;

-- Menarik izin langsung modifikasi tabel
REVOKE ALL ON barang FROM pos_kasir;
```

---

## 8. Variabel Sesi Dinamis (GUC / `set_config`)

### Pemahaman Konsep
GUC (*Grand Unified Configuration*) adalah fitur PostgreSQL yang memungkinkan aplikasi menyimpan variabel sementara di tingkat sesi koneksi (*Connection Session*). Variabel ini dapat diset melalui aplikasi backend (Express.js) dan dibaca oleh RLS Policy di dalam PostgreSQL.

### Alasan Penggunaan:
Menghubungkan konteks pengguna aplikasi (yang diverifikasi lewat JWT) ke dalam sesi database PostgreSQL.

### Contoh Kode:
*Di Middleware Node.js (`src/middlewares/auth.middleware.js`):*
```javascript
// Mengirim ID pengguna aktif ke sesi PostgreSQL sebelum menjalankan kueri
await pool.query("SELECT set_config('pos.user_id', $1, false)", [user.id]);
```

*Di SQL Policy (`sql/init.sql`):*
```sql
-- Membaca variabel sesi yang telah diset oleh Node.js
SELECT current_setting('pos.user_id', true);
```

---

## 9. Concurrency Control & Pessimistic Locking (`FOR UPDATE`)

### Pemahaman Konsep
Pessimistic Locking menggunakan klausul `SELECT ... FOR UPDATE` untuk mengunci baris data yang sedang dibaca agar tidak bisa diubah oleh transaksi/koneksi lain sampai transaksi yang berjalan selesai (`COMMIT` atau `ROLLBACK`).

### Alasan Penggunaan:
Mencegah terjadinya masalah *Race Condition* atau *Double-Spending* pada stok barang ketika beberapa kasir melakukan transaksi secara bersamaan di detik yang sama.

### Contoh Kode (`sql/init.sql`):
```sql
-- Di dalam Stored Procedure sp_buat_transaksi:
SELECT harga, stok, nama_barang 
INTO v_harga, v_stok, v_nama
FROM barang 
WHERE id_barang = v_item.id_barang 
FOR UPDATE; -- Mengunci baris barang ini sampai transaksi selesai

IF v_stok < v_item.jumlah THEN
    RAISE EXCEPTION 'Stok barang % tidak mencukupi (sisa: %)', v_nama, v_stok;
END IF;
```

---

## 10. Tipe Data Modern (`JSONB` & `SERIAL/IDENTITY`)

### Pemahaman Konsep
PostgreSQL mendukung tipe data kaya melampaui SQL tradisional:
1.  **`JSONB` (Binary JSON)**: Menyimpan dokumen JSON terurai secara biner. Mendukung pengindeksan GIN dan manipulasi kueri tingkat tinggi secara efisien.
2.  **`SERIAL` / `GENERATED ALWAYS AS IDENTITY`**: Kolom auto-increment otomatis yang mengelola nilai urutan (*Sequence*) secara aman.

### Contoh Kode (`sql/init.sql`):
```sql
-- Kolom spesifikasi dinamis barang & struktur cetak struk
CREATE TABLE barang (
    ...
    spesifikasi JSONB NULL
);

CREATE TABLE struk (
    id_struk   SERIAL PRIMARY KEY,
    data_struk JSONB NOT NULL
);
```

---

## 11. Manajemen Transaksi ACID (`BEGIN`, `COMMIT`, `ROLLBACK`)

### Pemahaman Konsep
Prinsip **ACID** (Atomicity, Consistency, Isolation, Durability) menjamin keandalan pemrosesan transaksi data.
*   **Atomicity (Semua atau Tidak Sama Sekali)**: Jika satu langkah di dalam transaksi gagal, seluruh langkah sebelumnya diikutsertakan dalam `ROLLBACK`.

### Contoh Kode:
*Di Stored Procedure (`sql/init.sql`):*
```sql
-- Stored Procedure secara otomatis mengeksekusi semua operasi DML dalam 1 atomik blok.
-- Jika terjadi RAISE EXCEPTION, seluruh INSERT transaksi & detail transaksi otomatis di-ROLLBACK oleh PostgreSQL.
```

*Di Aplikasi Backend Node.js (`src/controllers/...`):*
```javascript
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('pos.user_id', $1, false)", [req.user.id]);
    await client.query('CALL sp_buat_transaksi($1, $2, $3)', [kasirId, itemsJson, null]);
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}
```

---

### Summary Matriks Fitur
| No | Fitur Database | Berkas Utama di Proyek | Manfaat Utama |
| --- | --- | --- | --- |
| 1 | **Constraints** | `sql/init.sql` | Mencegah data minus/invalid masuk DB |
| 2 | **Index (B-Tree & GIN)** | `sql/init.sql` | Mempercepat kueri pencarian & JSONB |
| 3 | **Views** | `sql/init.sql` | Proteksi kolom password & abstraksi JOIN |
| 4 | **Stored Procedures** | `sql/init.sql` | Enkapsulasi logika transaksi POS |
| 5 | **Triggers & Functions** | `sql/init.sql` | Validasi & otomatisasi penambahan stok |
| 6 | **Row-Level Security** | `sql/init.sql` | Kasir hanya bisa lihat transaksi sendiri |
| 7 | **Roles & Privilege** | `sql/init.sql` | Hak akses terbatas (Least Privilege) |
| 8 | **Session Variables** | `auth.middleware.js` | Mengirim konteks JWT ke PostgreSQL |
| 9 | **Pessimistic Locking** | `sql/init.sql` (`sp_*`) | Mencegah stok minus saat diproses bersamaan |
| 10 | **JSONB & Identity** | `sql/init.sql` | Menyimpan spesifikasi dinamis & struk |
| 11 | **Manajemen Transaksi** | `src/controllers/` | Menggaransi prinsip ACID transaksi |
