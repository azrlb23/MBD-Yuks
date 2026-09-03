# Project Summary — Sistem POS Kafe Jalur Langit
## Dokumentasi Komprehensif: Arsitektur, Basis Data, API, dan Klausa SQL/PL/pgSQL

---

## BAGIAN 1 — RINGKASAN EKSEKUTIF PROYEK

**POS Kafe Jalur Langit** adalah sistem Point of Sale (POS) berbasis REST API untuk operasional kafe kecil. Dibangun sebagai proyek akhir matakuliah **Manajemen Basis Data (MBD)** dengan tujuan membuktikan penguasaan fitur-fitur lanjutan PostgreSQL secara nyata dan terukur.

Sistem terdiri dari dua lapisan utama:
1. **Backend API** — server Node.js (Express.js) yang menerima HTTP request dari klien (Postman / frontend).
2. **Basis Data PostgreSQL** — engine database yang menyimpan seluruh data, logika bisnis, dan keamanan akses.

---

## BAGIAN 2 — ARSITEKTUR SISTEM

```
KLIEN (Postman)
  │ HTTP Request + JWT Token
  ▼
BACKEND — Node.js Express.js (Port 3000)
  │ JWT Middleware (verifyToken + requireRole)
  │ Controller → sp.service.js
  │ CALL sp_...() via pg.Pool
  ▼
BASIS DATA — PostgreSQL 17 (Docker, Port 5433)
  ┌─────────────┬──────────┬──────────┬────────────┐
  │  7 Tabel    │ 5 Views  │ 8 Fungsi │ 13 Stored  │
  │ (Relasional │(Abstraksi│(Read-Only│ Procedures │
  │  + JSONB)   │  Query)  │ & Logika)│ CALL+INOUT │
  └─────────────┴──────────┴──────────┴────────────┘
  ┌─────────────┬──────────────────────────────────┐
  │ 3 Triggers  │  Roles & RLS (Lapis 2 Keamanan)  │
  │(Otomatisasi)│  manajer_role / kasir_role + RLS  │
  └─────────────┴──────────────────────────────────┘
```

---

## BAGIAN 3 — STRUKTUR 7 TABEL DATABASE

### Diagram Relasi Tabel

```
pengguna --< transaksi --< detail_transaksi >-- barang >-- kategori
               |                                  |
               +-------- struk                    +--< restock
pengguna ------------------------------------------< restock
```

### Penjelasan Per Tabel

| No | Nama Tabel | Fungsi Bisnis | Tipe Kunci |
|---|---|---|---|
| 1 | `pengguna` | Akun kasir & manajer untuk login | PK, UK(username) |
| 2 | `kategori` | Pengelompokan jenis menu kafe | PK, UK(nama_kategori) |
| 3 | `barang` | Katalog menu kafe + varian JSONB | PK, FK(kategori), GIN Index |
| 4 | `transaksi` | Header/nota transaksi penjualan kasir | PK, FK(pengguna) |
| 5 | `detail_transaksi` | Rincian item per nota transaksi | PK, FK(transaksi, barang) |
| 6 | `struk` | Dokumen struk digital snapshot JSONB | PK, FK+UK(transaksi) |
| 7 | `restock` | Jurnal penyesuaian stok masuk/keluar | PK, FK(barang, pengguna) |

---

## BAGIAN 4 — INVENTARIS LENGKAP OBJEK DATABASE

### 4.1 — 13 Stored Procedures

| Nama SP | Tipe | Peran Yang Bisa Akses |
|---|---|---|
| `sp_login` | Write / Auth | Kasir, Manajer |
| `sp_checkout_transaksi` | Write | Kasir |
| `sp_restock_barang` | Write | Manajer |
| `sp_update_harga_spesifikasi` | Write | Manajer |
| `sp_buat_akun_kasir` | Write | Manajer |
| `sp_atur_privilege` | Write | Manajer |
| `sp_nonaktifkan_akun` | Write | Manajer |
| `sp_get_katalog_barang` | Read (REFCURSOR) | Kasir, Manajer |
| `sp_get_detail_barang` | Read (REFCURSOR) | Kasir, Manajer |
| `sp_get_transaksi_harian` | Read (REFCURSOR) | Kasir, Manajer |
| `sp_get_detail_struk` | Read (REFCURSOR) | Kasir, Manajer |
| `sp_get_laporan_restock` | Read (REFCURSOR) | Manajer |
| `sp_get_daftar_pengguna` | Read (REFCURSOR) | Manajer |

### 4.2 — 8 Fungsi Read-Only

| Nama Fungsi | Return Type | Digunakan Oleh |
|---|---|---|
| `fn_validasi_kredensial` | `BOOLEAN` | `sp_login` |
| `fn_validasi_ketersediaan` | `TABLE(valid, stok_saat_ini, harga, nama_barang)` | `sp_checkout_transaksi` |
| `fn_merge_spesifikasi` | `JSONB` | `sp_update_harga_spesifikasi` |
| `fn_get_detail_struk` | `JSONB` | `sp_get_detail_struk` |
| `fn_get_daftar_pengguna` | `SETOF vw_daftar_pengguna` | `sp_get_daftar_pengguna` |
| `fn_get_katalog_barang` | `SETOF vw_katalog_barang` | `sp_get_katalog_barang` |
| `fn_get_transaksi_harian` | `SETOF vw_transaksi_harian` | `sp_get_transaksi_harian` |
| `fn_get_laporan_restock` | `SETOF vw_laporan_restock` | `sp_get_laporan_restock` |

### 4.3 — 5 Views (Tabel Virtual)

| Nama View | Tabel yang Digabung | Kegunaan |
|---|---|---|
| `vw_daftar_pengguna` | `pengguna` | Tampilkan akun aktif saja (filter `is_active = TRUE`) |
| `vw_katalog_barang` | `barang JOIN kategori` | Katalog menu + nama kategori |
| `vw_transaksi_harian` | `transaksi JOIN pengguna LEFT JOIN detail_transaksi` | Rekap penjualan + nama kasir + jumlah item |
| `vw_laporan_restock` | `restock JOIN barang JOIN pengguna` | Laporan riwayat penyesuaian stok |
| `vw_barang_spesifikasi` | `barang JOIN kategori, LATERAL jsonb_each_text` | Varian JSONB diurai menjadi baris relasional |

### 4.4 — 3 Trigger Otomatis

| Nama Trigger | Event | Tabel Target | Fungsi Bisnis |
|---|---|---|---|
| `trg_kurang_stok` | `AFTER INSERT` | `detail_transaksi` | Potong stok porsi saat checkout; rollback otomatis jika stok < 0 |
| `trg_tambah_stok_restock` | `AFTER INSERT` | `restock` | Sesuaikan stok (bisa +tambah atau -kurang); rollback jika stok < 0 |
| `trg_validasi_harga_barang` | `BEFORE INSERT OR UPDATE` | `barang` | Tolak simpan jika harga <= 0 atau stok < 0 |

---

## BAGIAN 5 — ALUR KERJA SISTEM (FLOW)

### Alur 1 — Login dan Terima Token JWT

```
Klien: POST /api/v1/auth/login { username, password }
  -> auth.controller.login()
  -> CALL sp_login($1, $2, INOUT $3, INOUT $4, INOUT $5)
     -> fn_validasi_kredensial(username, password) -> BOOLEAN
     -> Jika valid: SELECT id_pengguna, nama_lengkap, peran INTO INOUT params
  -> Express.js: jwt.sign({ id_pengguna, peran, nama }, secret, { expiresIn: '8h' })
  -> Response: { token, peran, nama }
```

### Alur 2 — Checkout Kasir (dengan Trigger)

```
Klien: POST /api/v1/transaksi/checkout { items: [...] }
  -> verifyToken -> decode JWT -> req.user = { id_pengguna: 2, peran: 'kasir' }
  -> requireRole('kasir') -> lolos
  -> CALL sp_checkout_transaksi(id_kasir, items_jsonb, INOUT id_transaksi, INOUT total)
     -> SELECT kasir aktif, jika NULL -> RAISE EXCEPTION
     -> INSERT INTO transaksi RETURNING id_transaksi INTO p_id_transaksi [INOUT]
     -> FOR v_item IN SELECT * FROM jsonb_array_elements(items_jsonb) LOOP
          -> fn_validasi_ketersediaan(id_barang, jumlah)
          -> INSERT INTO detail_transaksi
             [TRIGGER trg_kurang_stok AFTER INSERT]
             -> UPDATE barang SET stok = stok - jumlah RETURNING stok
             -> IF stok < 0: RAISE EXCEPTION -> seluruh transaksi ROLLBACK
          -> v_items_struk || jsonb_build_object(...)
        END LOOP
     -> UPDATE transaksi SET total_bayar = total
     -> INSERT INTO struk (jsonb_build_object snapshot lengkap)
  -> Response: { id_transaksi, total_bayar }
```

### Alur 3 — Restock / Penyesuaian Stok

```
Klien: POST /api/v1/restock { id_barang, jumlah_tambah: +20 atau -5 }
  -> verifyToken -> requireRole('manajer') -> lolos
  -> CALL sp_restock_barang(id_manajer, id_barang, jumlah_tambah)
     -> IF NOT EXISTS (manajer aktif): RAISE EXCEPTION
     -> INSERT INTO restock (jumlah_tambah bisa positif ATAU negatif)
        [TRIGGER trg_tambah_stok_restock AFTER INSERT]
        -> UPDATE barang SET stok = stok + jumlah_tambah RETURNING stok
        -> IF stok < 0: RAISE EXCEPTION -> ROLLBACK otomatis
  -> Response: { success: true }
```

### Alur 4 — Membaca Data via REFCURSOR

```
Klien: GET /api/v1/barang
  -> verifyToken -> lolos
  -> sp.service.js -> executeReadSP('CALL sp_get_katalog_barang($1)', ['cur_katalog'])
     -> BEGIN;
     -> CALL sp_get_katalog_barang('cur_katalog')
          -> OPEN cur FOR SELECT * FROM fn_get_katalog_barang()
               -> RETURN QUERY SELECT * FROM vw_katalog_barang
                    (JOIN barang + kategori WHERE is_active = TRUE)
     -> FETCH ALL IN "cur_katalog"
     -> COMMIT;
  -> Response: [ array 10 barang ]
```

---

## BAGIAN 6 — 14 ENDPOINT API LENGKAP

| Method | Endpoint | Role Wajib | Fungsi |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Publik | Login dan terima token JWT |
| `POST` | `/api/v1/auth/logout` | Semua | Logout (hapus token di sisi klien) |
| `GET` | `/api/v1/akun` | Manajer | Lihat daftar semua akun pengguna |
| `POST` | `/api/v1/akun/kasir` | Manajer | Buat akun kasir baru |
| `PUT` | `/api/v1/akun/privilege` | Manajer | Konfigurasi privilege pengguna |
| `DELETE` | `/api/v1/akun/:id` | Manajer | Nonaktifkan akun pengguna |
| `GET` | `/api/v1/barang` | Semua | Lihat katalog 10 menu + JSONB spesifikasi |
| `GET` | `/api/v1/barang/:id` | Semua | Lihat detail dan stok 1 menu tertentu |
| `PUT` | `/api/v1/barang/:id` | Manajer | Ubah harga dan merge spesifikasi JSONB |
| `POST` | `/api/v1/transaksi/checkout` | Kasir | Proses pesanan + potong stok + terbitkan struk |
| `GET` | `/api/v1/transaksi` | Semua | Rekap daftar transaksi hari ini |
| `GET` | `/api/v1/transaksi/struk/:id` | Semua | Baca dokumen struk digital JSONB |
| `POST` | `/api/v1/restock` | Manajer | Sesuaikan stok (+tambah / -kurang) |
| `GET` | `/api/v1/restock/riwayat` | Semua | Laporan riwayat semua penyesuaian stok |

---

## BAGIAN 7 — AKUN PENGGUNA BAWAAN (SEED DATA)

| Username | Password | Nama Lengkap | Peran |
|---|---|---|---|
| `manajer1` | `manajer123` | Budi Manajer Utama | `manajer` |
| `kasir1` | `kasir123` | Siti Kasir Shift Pagi | `kasir` |
| `kasir2` | `kasir123` | Rian Kasir Shift Malam | `kasir` |

---

## BAGIAN 8 — 2 LAPIS KEAMANAN SISTEM

### Lapis 1 — Level Aplikasi (JWT Middleware)
- Setiap endpoint kecuali `/login` dilindungi `verifyToken` middleware.
- Token JWT berlaku **8 jam**, menyimpan: `id_pengguna`, `username`, `peran`, `nama`.
- `requireRole('manajer')` memblokir kasir mengakses endpoint manajer (403 Forbidden).

### Lapis 2 — Level Database PostgreSQL (Roles + RLS)
- `REVOKE ALL ON ALL TABLES` — tidak ada yang bisa SELECT langsung ke tabel mentah.
- `GRANT EXECUTE ON PROCEDURE` — kasir hanya boleh menjalankan 6 SP kasir; manajer semua.
- `ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY` — RLS aktif pada tabel transaksi.
- Policy `kasir_self_trx_policy` — kasir di level DB hanya bisa baca transaksi miliknya sendiri.
- Policy `manajer_all_trx_policy` — manajer bisa baca semua transaksi.

---

---

# BAGIAN 9 — KAMUS KLAUSA SQL DAN PL/pgSQL PROYEK INI
## (Akurat berdasarkan kode nyata di `sql/init.sql`)

---

## 9.1 — DDL (Data Definition Language) — Mendefinisikan Struktur

| Klausa / Keyword | Contoh di Proyek | Penjelasan |
|---|---|---|
| `CREATE TABLE` | `CREATE TABLE pengguna (...)` | Membuat tabel baru dengan kolom dan tipe datanya. |
| `DROP TABLE IF EXISTS ... CASCADE` | `DROP TABLE IF EXISTS struk CASCADE` | Hapus tabel jika ada. `CASCADE` ikut menghapus semua objek yang bergantung padanya (FK). |
| `SERIAL PRIMARY KEY` | `id_pengguna SERIAL PRIMARY KEY` | Kolom auto-increment integer, sekaligus menjadi identitas unik setiap baris tabel. |
| `UNIQUE` | `username VARCHAR(50) UNIQUE NOT NULL` | Memastikan tidak ada nilai kolom yang duplikat di seluruh tabel. |
| `NOT NULL` | `nama_lengkap VARCHAR(100) NOT NULL` | Melarang kolom menyimpan nilai NULL/kosong. |
| `DEFAULT` | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | Nilai yang otomatis diisi jika kolom tidak disertakan saat INSERT. |
| `CHECK (...)` | `CHECK (harga > 0)`, `CHECK (jumlah_tambah != 0)` | Konstrain validasi: INSERT/UPDATE ditolak jika kondisi tidak terpenuhi. |
| `REFERENCES ... ON DELETE RESTRICT` | `id_kategori INTEGER REFERENCES kategori(id_kategori) ON DELETE RESTRICT` | Foreign Key: menjaga integritas referensial. `RESTRICT` mencegah hapus induk jika masih ada anak. |
| `REFERENCES ... ON DELETE CASCADE` | `id_transaksi INTEGER REFERENCES transaksi(id_transaksi) ON DELETE CASCADE` | Foreign Key: jika baris induk dihapus, semua baris anak ikut terhapus otomatis. |
| `NUMERIC(p,s)` | `harga NUMERIC(12,2)` | Tipe angka presisi tinggi untuk nilai uang. `(12,2)` = 12 digit total, 2 di belakang koma. |
| `TIMESTAMPTZ` | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Timestamp dengan informasi zona waktu. `NOW()` mengisi waktu saat INSERT secara otomatis. |
| `JSONB` | `spesifikasi JSONB NULL`, `data_struk JSONB NOT NULL` | Dokumen JSON tersimpan dalam format binary terindeks — mendukung query dan operator JSON. |
| `VARCHAR(n)` | `username VARCHAR(50)` | Tipe teks variabel dengan panjang maksimum `n` karakter. |
| `BOOLEAN` | `is_active BOOLEAN` | Nilai `TRUE` atau `FALSE`. |
| `INTEGER` | `stok INTEGER NOT NULL DEFAULT 0` | Tipe bilangan bulat (tidak ada desimal). |
| `CREATE UNIQUE INDEX` | `CREATE UNIQUE INDEX idx_pengguna_username ON pengguna (username)` | Indeks unik: mempercepat pencarian sekaligus mencegah duplikasi pada kolom. |
| `CREATE INDEX` (B-Tree) | `CREATE INDEX idx_transaksi_kasir ON transaksi (id_kasir)` | Indeks B-Tree standar: mempercepat query WHERE, JOIN, ORDER BY pada kolom tersebut. |
| `CREATE INDEX USING GIN` | `CREATE INDEX idx_barang_spek_gin ON barang USING GIN (spesifikasi)` | GIN Index khusus untuk JSONB/array: memungkinkan pencarian elemen di dalam dokumen JSON dengan cepat. |
| `CREATE OR REPLACE VIEW` | `CREATE OR REPLACE VIEW vw_katalog_barang AS SELECT ...` | Tabel virtual. Tidak menyimpan data fisik sendiri — selalu membaca data terkini dari tabel asli. |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | `ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY` | Mengaktifkan Row Level Security: setiap baris yang diakses akan diperiksa oleh policy. |
| `CREATE POLICY ... FOR ... TO ... USING (...)` | `CREATE POLICY kasir_self_trx_policy ON transaksi FOR SELECT TO kasir_role USING (...)` | Mendefinisikan aturan baris mana yang boleh diakses oleh role tertentu. Kondisi `USING` otomatis ditambahkan ke setiap query. |
| `DROP POLICY IF EXISTS` | `DROP POLICY IF EXISTS kasir_self_trx_policy ON transaksi` | Menghapus policy yang sudah ada sebelum dibuat ulang agar tidak error. |

---

## 9.2 — DML (Data Manipulation Language) — Memanipulasi Data

| Klausa / Keyword | Contoh di Proyek | Penjelasan |
|---|---|---|
| `INSERT INTO ... VALUES` | `INSERT INTO pengguna (username, ...) VALUES ('kasir1', ...)` | Memasukkan satu atau lebih baris baru ke dalam tabel. |
| `INSERT INTO ... RETURNING ... INTO` | `INSERT INTO transaksi (...) RETURNING id_transaksi INTO p_id_transaksi` | INSERT sekaligus langsung mengambil nilai kolom hasil INSERT dan menyimpan ke variabel PL/pgSQL (mendapat ID auto-generated). |
| `UPDATE ... SET ... WHERE` | `UPDATE barang SET stok = stok - NEW.jumlah WHERE id_barang = NEW.id_barang` | Mengubah nilai baris yang sudah ada sesuai kondisi WHERE. |
| `UPDATE ... RETURNING ... INTO` | `UPDATE barang SET stok = ... RETURNING stok INTO v_stok_sisa` | UPDATE sekaligus mengambil nilai kolom setelah diubah — digunakan di trigger untuk cek stok negatif. |
| `SELECT ... FROM ... WHERE` | `SELECT id_pengguna, peran FROM pengguna WHERE username = p_username` | Membaca data dari tabel dengan filter kondisi. |
| `SELECT ... INTO (variabel)` | `SELECT nama_lengkap INTO v_nama_kasir FROM pengguna WHERE ...` | Membaca satu baris dan menyimpan hasilnya ke variabel lokal PL/pgSQL. |
| `SELECT ... AS (alias)` | `p.nama_lengkap AS nama_kasir` | Memberi nama alias pada kolom di hasil query. |
| `JOIN ... ON` | `JOIN kategori k ON b.id_kategori = k.id_kategori` | Inner Join: menggabungkan baris dua tabel yang memenuhi kondisi ON — hanya baris yang cocok yang muncul. |
| `LEFT JOIN ... ON` | `LEFT JOIN detail_transaksi dt ON t.id_transaksi = dt.id_transaksi` | Left Join: menampilkan semua baris kiri meskipun tidak ada pasangan di tabel kanan (kolom kanan menjadi NULL). |
| `LATERAL` | `LATERAL jsonb_each_text(b.spesifikasi) kv` | Klausa yang memungkinkan fungsi/subquery di FROM mengacu ke kolom tabel sebelumnya — digunakan untuk mengurai JSONB menjadi baris. |
| `GROUP BY` | `GROUP BY t.id_transaksi, p.nama_lengkap` | Mengelompokkan baris berdasarkan kolom untuk digunakan bersama fungsi agregasi. |
| `COUNT(...)` | `COUNT(dt.id_detail) AS total_item` | Fungsi agregasi: menghitung jumlah baris dalam setiap kelompok. |
| `COALESCE(...)` | `COALESCE(v_valid, FALSE)`, `COALESCE(p_spek_lama, '{}'::JSONB)` | Mengembalikan nilai pertama yang bukan NULL — digunakan sebagai nilai default pengganti NULL. |
| `IS NULL` | `IF v_nama_kasir IS NULL THEN ...` | Pengecekan apakah suatu nilai adalah NULL. |
| `NOT EXISTS (SELECT 1 FROM ...)` | `IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer')` | Cek apakah subquery tidak menghasilkan baris apapun — efisien karena berhenti saat baris pertama ditemukan. |
| `NOW()` | `DEFAULT NOW()`, `NOW() - INTERVAL '2 hours'` | Fungsi bawaan PostgreSQL: mengembalikan timestamp saat ini dengan zona waktu. |
| `INTERVAL` | `NOW() - INTERVAL '2 hours'` | Tipe data durasi waktu — digunakan di seed data untuk mensimulasikan transaksi di masa lalu. |
| `CURRENT_DATE` | `p_tanggal DATE DEFAULT CURRENT_DATE` | Nilai bawaan: tanggal hari ini (tanpa waktu). |

---

## 9.3 — PL/pgSQL — Logika Prosedural di Database

| Klausa / Keyword | Contoh di Proyek | Penjelasan |
|---|---|---|
| `CREATE OR REPLACE PROCEDURE` | `CREATE OR REPLACE PROCEDURE sp_login(...)` | Membuat atau mengganti Stored Procedure: bisa melakukan INSERT/UPDATE/DELETE dan tidak harus mengembalikan nilai. |
| `CREATE OR REPLACE FUNCTION` | `CREATE OR REPLACE FUNCTION fn_validasi_kredensial(...)` | Membuat atau mengganti fungsi: wajib mengembalikan nilai, tidak bisa COMMIT/ROLLBACK sendiri. |
| `LANGUAGE plpgsql` | `... LANGUAGE plpgsql AS $$ ... $$` | Memberitahu PostgreSQL bahwa kode ditulis dalam bahasa prosedural PL/pgSQL. |
| `DECLARE` | `DECLARE v_stok_sisa INT; v_nama_kasir VARCHAR(100);` | Mendeklarasikan variabel lokal yang akan digunakan di dalam blok BEGIN-END. |
| `BEGIN ... END;` | `BEGIN ... END; $$` | Blok eksekusi kode PL/pgSQL: semua perintah ditulis di antara BEGIN dan END. |
| `INOUT (parameter)` | `INOUT p_id_transaksi INT DEFAULT NULL` | Parameter dua arah: berfungsi sebagai input sekaligus "amplop" pengembalian nilai dari PROCEDURE ke Express.js. |
| `RETURNS TABLE(...)` | `RETURNS TABLE(valid BOOLEAN, stok_saat_ini INT, harga NUMERIC, nama_barang VARCHAR)` | Fungsi mengembalikan banyak kolom sekaligus (mirip tabel). |
| `RETURNS SETOF` | `RETURNS SETOF vw_katalog_barang` | Fungsi mengembalikan kumpulan baris dengan struktur persis sama seperti view/tabel tertentu. |
| `RETURNS BOOLEAN` | `fn_validasi_kredensial(...) RETURNS BOOLEAN` | Fungsi mengembalikan satu nilai TRUE/FALSE. |
| `RETURNS JSONB` | `fn_get_detail_struk(...) RETURNS JSONB` | Fungsi mengembalikan satu objek JSONB. |
| `RETURNS TRIGGER` | `trg_fn_kurang_stok() RETURNS TRIGGER` | Tipe return wajib untuk fungsi yang akan dipanggil oleh trigger — bukan tipe data biasa. |
| `RETURN QUERY` | `RETURN QUERY SELECT * FROM vw_katalog_barang` | Mengembalikan hasil query SELECT sebagai output fungsi `RETURNS SETOF`. |
| `RETURN` | `RETURN COALESCE(v_valid, FALSE)` | Mengembalikan satu nilai skalar dari fungsi. |
| `RETURN NEW` | `RETURN NEW` | Khusus trigger BEFORE: memberitahu PostgreSQL untuk melanjutkan operasi INSERT/UPDATE dengan data baris baru apa adanya. |
| `STABLE` | `FUNCTION fn_validasi_ketersediaan(...) STABLE` | Jaminan bahwa fungsi tidak mengubah data dan hasilnya konsisten dalam satu transaksi. Membantu query optimizer. |
| `IMMUTABLE` | `FUNCTION fn_merge_spesifikasi(...) IMMUTABLE` | Jaminan tertinggi: fungsi tidak membaca DB dan selalu menghasilkan output yang sama untuk input yang sama. Paling optimal. |
| `IF ... THEN ... END IF` | `IF v_stok_sisa < 0 THEN RAISE EXCEPTION ...; END IF;` | Percabangan kondisional dalam PL/pgSQL. |
| `IF NOT ... THEN` | `IF NOT v_is_valid THEN RAISE EXCEPTION ...; END IF;` | Percabangan jika kondisi bernilai false. |
| `FOR v IN SELECT ... LOOP ... END LOOP` | `FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_jsonb) LOOP ... END LOOP` | Perulangan yang mengiterasi setiap baris hasil query — digunakan untuk memproses tiap item pesanan di array JSON. |
| `RAISE EXCEPTION '...'` | `RAISE EXCEPTION 'Stok porsi menu tidak mencukupi.'` | Melempar error dan otomatis membatalkan (ROLLBACK) seluruh transaksi yang sedang berjalan. |
| `RAISE EXCEPTION ... USING ERRCODE` | `RAISE EXCEPTION '...' USING ERRCODE = '28P01'` | Melempar error dengan kode PostgreSQL spesifik agar bisa ditangkap secara selektif di sisi Express.js. |
| `REFCURSOR` | `INOUT cur REFCURSOR DEFAULT 'cur_katalog'` | Tipe kursor yang bisa diteruskan antara prosedur dan klien untuk membaca data hasil query. |
| `OPEN cur FOR SELECT ...` | `OPEN cur FOR SELECT * FROM fn_get_katalog_barang()` | Membuka/menginisialisasi cursor dengan query yang hasilnya akan dibaca via FETCH. |
| `FETCH ALL IN "..."` | `FETCH ALL IN "cur_katalog"` | Mengambil semua baris dari cursor yang sudah dibuka (dieksekusi dari Express.js setelah CALL). |
| `DO $$ ... $$` | `DO $$ BEGIN IF NOT EXISTS (...) THEN CREATE ROLE ...; END IF; END $$` | Blok kode anonim yang langsung dieksekusi — untuk logika kondisional saat inisialisasi tanpa perlu membuat fungsi. |

---

## 9.4 — Trigger

| Klausa / Keyword | Contoh di Proyek | Penjelasan |
|---|---|---|
| `CREATE TRIGGER` | `CREATE TRIGGER trg_kurang_stok AFTER INSERT ON detail_transaksi FOR EACH ROW ...` | Mendaftarkan trigger yang terhubung ke event tertentu pada tabel. |
| `DROP TRIGGER IF EXISTS` | `DROP TRIGGER IF EXISTS trg_kurang_stok ON detail_transaksi` | Menghapus trigger yang sudah ada sebelum dibuat ulang — mencegah error duplikat. |
| `AFTER INSERT ON` | `AFTER INSERT ON detail_transaksi` | Trigger reaktif: berjalan SETELAH baris berhasil di-INSERT ke tabel. |
| `BEFORE INSERT OR UPDATE ON` | `BEFORE INSERT OR UPDATE ON barang` | Trigger penjaga gerbang: berjalan SEBELUM data tersimpan — bisa membatalkan dengan RAISE EXCEPTION. |
| `FOR EACH ROW` | `FOR EACH ROW EXECUTE FUNCTION trg_fn_kurang_stok()` | Trigger dieksekusi satu kali untuk setiap baris yang terpengaruh (bukan satu kali per statement SQL). |
| `EXECUTE FUNCTION` | `EXECUTE FUNCTION trg_fn_kurang_stok()` | Menentukan fungsi trigger yang dipanggil saat event terjadi. |
| `NEW` | `NEW.jumlah`, `NEW.id_barang`, `NEW.jumlah_tambah` | Variabel record bawaan trigger yang berisi nilai baris baru yang sedang di-INSERT atau di-UPDATE. |

---

## 9.5 — Operator dan Fungsi JSONB

| Operator / Fungsi | Contoh di Proyek | Penjelasan |
|---|---|---|
| `->>'key'` | `v_item->>'id_barang'`, `v_item->>'jumlah'` | Mengambil nilai properti JSON sebagai tipe TEXT — harus di-cast ke tipe yang sesuai (contoh: `::INT`). |
| `\|\|` (Penggabungan) | `v_items_struk := v_items_struk \|\| jsonb_build_object(...)` | Operator penggabungan JSONB: menambahkan elemen baru ke array JSONB atau menggabungkan dua JSONB object. |
| `::jsonb` | `'{"suhu": ["dingin"]}'::jsonb` | Type Cast eksplisit: mengubah literal teks biasa menjadi tipe data JSONB PostgreSQL. |
| `::INT`, `::DATE`, `::JSONB` | `(v_item->>'id_barang')::INT`, `created_at::DATE` | Type Cast: mengubah tipe data secara eksplisit — umum saat mengekstrak nilai dari JSON (yang selalu bertipe TEXT). |
| `jsonb_build_object(...)` | `jsonb_build_object('id_transaksi', p_id_transaksi, 'kasir', v_nama_kasir, ...)` | Merakit JSONB Object `{...}` secara terprogram dari pasangan kunci-nilai. |
| `jsonb_array_elements(...)` | `SELECT * FROM jsonb_array_elements(p_items_jsonb)` | Memecah JSONB Array `[...]` menjadi baris-baris relasional — memungkinkan iterasi dengan FOR LOOP. |
| `jsonb_each_text(...)` | `LATERAL jsonb_each_text(b.spesifikasi) kv` | Mengurai setiap pasangan kunci-nilai dalam JSONB Object menjadi dua kolom: `key` dan `value` (bertipe TEXT). |
| `'[]'::JSONB` | `v_items_struk JSONB := '[]'::JSONB` | Inisialisasi variabel JSONB sebagai array kosong — akan diisi satu per satu di dalam LOOP dengan operator `||`. |

---

## 9.6 — DCL (Data Control Language) — Keamanan Akses

| Klausa / Keyword | Contoh di Proyek | Penjelasan |
|---|---|---|
| `CREATE ROLE ... NOLOGIN` | `CREATE ROLE manajer_role NOLOGIN` | Membuat role PostgreSQL yang tidak bisa digunakan untuk login langsung — hanya sebagai kelompok hak akses. |
| `GRANT USAGE ON SCHEMA` | `GRANT USAGE ON SCHEMA public TO manajer_role, kasir_role` | Mengizinkan role mengakses objek di dalam skema. Tanpa ini, role tidak bisa melihat apapun di skema `public`. |
| `GRANT USAGE, SELECT ON ALL SEQUENCES` | `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO manajer_role, kasir_role` | Mengizinkan role membaca nilai sequence — diperlukan agar SP yang melakukan INSERT dengan SERIAL tidak gagal. |
| `REVOKE ALL ON ALL TABLES` | `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM manajer_role, kasir_role` | Mencabut semua hak akses langsung ke tabel. Setelah ini tidak ada yang bisa SELECT langsung — wajib lewat Stored Procedure. |
| `GRANT EXECUTE ON ALL PROCEDURES` | `GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO manajer_role` | Mengizinkan manajer mengeksekusi semua Stored Procedure. |
| `GRANT EXECUTE ON ALL FUNCTIONS` | `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO manajer_role` | Mengizinkan manajer memanggil semua fungsi. |
| `GRANT EXECUTE ON PROCEDURE sp TO role` | `GRANT EXECUTE ON PROCEDURE sp_checkout_transaksi TO kasir_role` | Memberikan hak eksekusi procedure spesifik kepada role tertentu. Kasir hanya bisa menjalankan 6 SP yang relevan. |
| `CREATE POLICY ... USING (...)` | `CREATE POLICY kasir_self_trx_policy ON transaksi FOR SELECT TO kasir_role USING (id_kasir = (...))` | RLS Policy: kondisi `USING` otomatis ditambahkan ke setiap query SELECT dari role tersebut sebagai filter baris. |

---

## BAGIAN 10 — CARA MENJALANKAN PROYEK

### Prasyarat
- Docker Desktop (terinstal dan berjalan)
- Node.js v18+

### Langkah Menjalankan

```powershell
# 1. Masuk ke folder proyek
cd d:\MBD

# 2. Jalankan database (auto-init: skema, seed, SP, trigger, roles, RLS)
docker compose up -d

# 3. Jalankan backend API
npm run dev

# 4. Jalankan Pengujian Otomatis Seluruh Endpoint (18 Test Cases)
node test_all_endpoints.js

# 5. Import Postman: d:\MBD\postman_collection.json
# 6. Mulai dari request "Login Kasir" atau "Login Manajer"
```

### Koneksi Database (DBeaver / pgAdmin / TablePlus)

```
Host     : localhost
Port     : 5433
Database : pos_jalur_langit
User     : pos_admin
Password : pos_password
```

### Perintah psql Berguna

```powershell
# Masuk ke terminal database
docker exec -it pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# Query langsung tanpa masuk terminal
docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit -c "SELECT id_barang, nama_barang, harga, stok FROM barang;"
```
