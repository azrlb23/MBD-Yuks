# Panduan Serah Terima Proyek — POS Kafe Jalur Langit
## Checklist Lengkap: Semua Komponen yang Harus Ada di Project Ini

> Dokumen ini dibuat agar teman yang menerima project ini dapat memahami **apa saja yang ada**, **di mana letaknya**, dan **bagaimana cara menjalankannya** dari nol.

---

## BAGIAN 1 — STRUKTUR FOLDER LENGKAP

Pastikan seluruh folder dan file berikut ada di direktori project:

```
d:\MBD\
│
├── .env                          <- Konfigurasi variabel lingkungan (DB, JWT)
├── .gitignore                     <- File yang dikecualikan dari Git
├── compose.yaml                   <- Konfigurasi Docker Compose (PostgreSQL 17)
├── package.json                   <- Dependensi Node.js & script npm
├── README.md                      <- Panduan teknis singkat
├── PROJECT_SUMMARY.md             <- Dokumentasi komprehensif sistem
├── context1.md                    <- Ringkasan arsitektur & inventaris DB
├── database_dictionary.md         <- Kamus data 7 tabel
├── erd_and_usecase.md             <- ERD & spesifikasi 5 Use Case
├── ex.md                          <- File ini (panduan serah terima)
├── postman_collection.json        <- Koleksi test API siap import ke Postman
│
├── sql/                           <- SEMUA SKRIP SQL POSTGRESQL
│   ├── 01_schema.sql              <- DDL: 7 Tabel + Constraints + 17 Index
│   ├── 02_seed.sql                <- Data awal (3 user + 10 menu + transaksi)
│   ├── 07_roles_rls.sql           <- Hak akses Roles & Row Level Security (RLS)
│   ├── functions/
│   │   └── 01_functions.sql       <- 8 Fungsi Read-Only (fn_...)
│   ├── procedures/
│   │   └── 01_procedures.sql      <- 10 Stored Procedures (sp_...)
│   ├── triggers/
│   │   └── 01_triggers.sql        <- 3 Trigger + 3 Trigger Functions
│   └── views/
│       └── 01_views.sql           <- 5 Views (vw_...)
│
└── src/                           <- SOURCE CODE BACKEND NODE.JS
    ├── app.js                     <- Entry point server Express.js
    ├── database/
    │   └── db.js                  <- Koneksi pool PostgreSQL (pg.Pool)
    ├── middlewares/
    │   ├── auth.middleware.js      <- JWT verification & requireRole()
    │   └── error.middleware.js     <- Global error handler
    ├── services/
    │   └── sp.service.js          <- Eksekusi Stored Procedure ke DB
    ├── controllers/               <- Handler logika setiap endpoint
    └── routes/                    <- Definisi rute API (/api/v1/...)
```

---

## BAGIAN 2 — KOMPONEN BASIS DATA POSTGRESQL

### 2.1 — 7 Tabel Utama (sql/01_schema.sql)

Ini adalah tulang punggung seluruh sistem. Pastikan semua tabel berikut terbuat:

| No | Nama Tabel | Fungsi |
|---|---|---|
| 1 | `pengguna` | Akun kasir & manajer untuk login dan autentikasi |
| 2 | `kategori` | Pengelompokan jenis menu kafe (Minuman, Makanan, dll) |
| 3 | `barang` | Katalog menu kafe + stok porsi + varian dinamis JSONB |
| 4 | `transaksi` | Header/nota transaksi penjualan per kasir |
| 5 | `detail_transaksi` | Rincian item menu per nota transaksi |
| 6 | `struk` | Dokumen struk digital snapshot berformat JSONB |
| 7 | `restock` | Jurnal riwayat penyesuaian stok masuk/keluar |

**Constraints penting yang harus ada:**
- CHECK (harga > 0) pada tabel barang
- CHECK (stok >= 0) pada tabel barang
- CHECK (jumlah > 0) pada tabel detail_transaksi
- CHECK (jumlah_tambah != 0) pada tabel restock
- UNIQUE (username) pada tabel pengguna
- CHECK (peran IN ('manajer', 'kasir')) pada tabel pengguna

---

### 2.2 — 14 Index (sql/01_schema.sql)

Index mempercepat performa query. Pastikan semua index berikut terbuat:

| Nama Index | Tipe | Tabel | Kolom |
|---|---|---|---|
| `idx_pengguna_username` | B-Tree UNIQUE | `pengguna` | `username` |
| `idx_pengguna_is_active` | B-Tree | `pengguna` | `is_active` |
| `idx_kategori_nama` | B-Tree | `kategori` | `nama_kategori` |
| `idx_barang_kategori` | B-Tree | `barang` | `id_kategori` |
| `idx_barang_is_active` | B-Tree | `barang` | `is_active` |
| `idx_barang_spek_gin` | **GIN (JSONB)** | `barang` | `spesifikasi` |
| `idx_transaksi_kasir` | B-Tree | `transaksi` | `id_kasir` |
| `idx_transaksi_created_at` | B-Tree | `transaksi` | `created_at` |
| `idx_detail_transaksi` | B-Tree | `detail_transaksi` | `id_transaksi` |
| `idx_detail_barang` | B-Tree | `detail_transaksi` | `id_barang` |
| `idx_struk_transaksi` | B-Tree | `struk` | `id_transaksi` |
| `idx_restock_barang` | B-Tree | `restock` | `id_barang` |
| `idx_restock_manajer` | B-Tree | `restock` | `id_manajer` |
| `idx_restock_created_at` | B-Tree | `restock` | `created_at` |

> PENTING: idx_barang_spek_gin menggunakan GIN Index (bukan B-Tree). Ini khusus untuk kolom bertipe JSONB agar query ke dalam dokumen JSON bisa cepat.

---

### 2.3 — 5 Views (sql/views/01_views.sql)

View adalah tabel virtual yang menyederhanakan query kompleks:

| Nama View | Tabel yang Digabung | Kegunaan |
|---|---|---|
| `vw_daftar_pengguna` | `pengguna` | Menampilkan akun aktif saja (filter is_active = TRUE) |
| `vw_katalog_barang` | `barang JOIN kategori` | Katalog menu lengkap dengan nama kategori |
| `vw_transaksi_harian` | `transaksi JOIN pengguna LEFT JOIN detail_transaksi` | Rekap penjualan + nama kasir + jumlah item |
| `vw_laporan_restock` | `restock JOIN barang JOIN pengguna` | Laporan riwayat semua penyesuaian stok |
| `vw_barang_spesifikasi` | `barang JOIN kategori, LATERAL jsonb_each_text` | Varian JSONB diurai menjadi baris relasional |

---

### 2.4 — 8 Fungsi Read-Only (sql/functions/01_functions.sql)

Fungsi ini tidak mengubah data — hanya membaca dan mengembalikan nilai:

| Nama Fungsi | Return Type | Dipanggil Oleh |
|---|---|---|
| `fn_validasi_kredensial(username, password)` | `BOOLEAN` | `sp_login` |
| `fn_validasi_ketersediaan(id_barang, jumlah)` | `TABLE(valid, stok_saat_ini, harga, nama_barang)` | `sp_checkout_transaksi` |
| `fn_merge_spesifikasi(spek_lama, spek_baru)` | `JSONB` | `sp_update_harga_spesifikasi` |
| `fn_get_detail_struk(id_transaksi)` | `JSONB` | `sp_get_detail_struk` |
| `fn_get_daftar_pengguna()` | `SETOF vw_daftar_pengguna` | `sp_get_daftar_pengguna` |
| `fn_get_katalog_barang()` | `SETOF vw_katalog_barang` | `sp_get_katalog_barang` |
| `fn_get_transaksi_harian(tanggal)` | `SETOF vw_transaksi_harian` | `sp_get_transaksi_harian` |
| `fn_get_laporan_restock(id_barang, dari, sampai)` | `SETOF vw_laporan_restock` | `sp_get_laporan_restock` |

---

### 2.5 — 10 Stored Procedures (sql/procedures/01_procedures.sql)

Stored Procedure adalah "pintu masuk" satu-satunya ke database dari backend:

**Write Procedures (mengubah data):**

| Nama SP | Parameter Utama | Fungsi |
|---|---|---|
| `sp_login` | username, password -> INOUT id, nama, peran | Autentikasi login pengguna |
| `sp_checkout_transaksi` | id_kasir, items_jsonb -> INOUT id_transaksi, total_bayar | Proses transaksi penjualan end-to-end |
| `sp_restock_barang` | id_manajer, id_barang, jumlah_tambah, nama_supplier | Catat penyesuaian stok barang |
| `sp_update_harga_spesifikasi` | id_manajer, id_barang, harga_baru, spek_baru | Ubah harga & merge spesifikasi JSONB |

**Read Procedures - REFCURSOR (baca data):**

| Nama SP | Fungsi |
|---|---|
| `sp_get_katalog_barang` | Ambil semua menu aktif |
| `sp_get_detail_barang` | Ambil detail 1 menu |
| `sp_get_transaksi_harian` | Rekap transaksi per hari |
| `sp_get_detail_struk` | Baca dokumen struk JSONB |
| `sp_get_laporan_restock` | Laporan riwayat restock |
| `sp_get_daftar_pengguna` | Daftar akun pengguna aktif |

---

### 2.6 — 3 Trigger Otomatis (sql/triggers/01_triggers.sql)

Trigger bekerja otomatis di level database tanpa dipanggil manual. Wajib ada:

| Nama Trigger | Event | Tabel | Fungsi Bisnis |
|---|---|---|---|
| `trg_kurang_stok` | AFTER INSERT | `detail_transaksi` | Otomatis potong stok di tabel barang setiap ada item checkout. Jika stok jadi < 0, seluruh transaksi ROLLBACK otomatis. |
| `trg_tambah_stok_restock` | AFTER INSERT | `restock` | Otomatis tambah/kurangi stok di barang saat manajer mencatat restock. ROLLBACK jika stok jadi negatif. |
| `trg_validasi_harga_barang` | BEFORE INSERT OR UPDATE | `barang` | Penjaga gerbang: tolak simpan jika harga <= 0 atau stok < 0. |

> Setiap trigger memiliki Trigger Function pendamping:
> - trg_fn_kurang_stok
> - trg_fn_tambah_stok_restock
> - trg_fn_validasi_harga_barang

---

### 2.7 — Roles & Row Level Security (sql/07_roles_rls.sql)

Ini adalah Lapis 2 Keamanan di level database (di luar JWT di backend):

| Objek Keamanan | Keterangan |
|---|---|
| `manajer_role` | PostgreSQL Role untuk manajer. Bisa eksekusi semua SP dan fungsi. |
| `kasir_role` | PostgreSQL Role untuk kasir. Hanya bisa eksekusi 6 SP kasir yang relevan. |
| `REVOKE ALL ON ALL TABLES` | Tidak ada yang bisa query langsung ke tabel — wajib lewat Stored Procedure. |
| `GRANT EXECUTE ON PROCEDURE` | Hak akses spesifik per SP per role. |
| `ENABLE ROW LEVEL SECURITY` | RLS aktif pada tabel transaksi. |
| `kasir_self_trx_policy` | Kasir hanya bisa baca transaksi miliknya sendiri. |
| `manajer_all_trx_policy` | Manajer bisa baca semua transaksi. |

---

### 2.8 — Data Awal / Seed (sql/02_seed.sql)

**Akun Pengguna:**

| Username | Password | Nama | Peran |
|---|---|---|---|
| `manajer1` | `manajer123` | Budi Manajer Utama | manajer |
| `kasir1` | `kasir123` | Siti Kasir Shift Pagi | kasir |
| `kasir2` | `kasir123` | Rian Kasir Shift Malam | kasir |

**Menu (Barang):** 10 menu kafe dengan stok, harga, kategori, dan spesifikasi JSONB.
**Transaksi Sampel:** Beberapa transaksi demo untuk keperluan testing.

---

## BAGIAN 3 — KOMPONEN BACKEND NODE.JS

### 3.1 — Tech Stack Backend
- Runtime: Node.js v18+
- Framework: Express.js (ES Modules)
- Driver DB: pg (node-postgres Connection Pool)
- Autentikasi: JWT (jsonwebtoken)

### 3.2 — File Backend Wajib Ada

| File | Fungsi |
|---|---|
| `src/app.js` | Entry point server, mount semua router |
| `src/database/db.js` | Inisialisasi pg.Pool, koneksi ke PostgreSQL |
| `src/middlewares/auth.middleware.js` | verifyToken() & requireRole() |
| `src/middlewares/error.middleware.js` | Global error handler |
| `src/services/sp.service.js` | Layer eksekusi CALL sp_...(), termasuk REFCURSOR |
| `src/controllers/*.js` | Handler logic untuk setiap endpoint |
| `src/routes/*.js` | Definisi rute API |

### 3.3 — File .env (Wajib Diisi)

```
DB_HOST=localhost
DB_PORT=5433
DB_NAME=pos_jalur_langit
DB_USER=pos_admin
DB_PASSWORD=pos_password
JWT_SECRET=<kunci_rahasia_jwt_anda>
PORT=3000
```

---

## BAGIAN 4 — 10 ENDPOINT API LENGKAP

| Method | Endpoint | Role | Fungsi |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Publik | Login -> JWT Token |
| POST | `/api/v1/auth/logout` | Semua | Logout session |
| GET | `/api/v1/barang` | Semua | Lihat katalog 10 menu + JSONB spesifikasi |
| GET | `/api/v1/barang/:id` | Semua | Lihat detail & stok 1 menu |
| PUT | `/api/v1/barang/:id` | Manajer | Ubah harga & merge spesifikasi JSONB |
| POST | `/api/v1/transaksi/checkout` | Kasir | Proses pesanan + potong stok + terbitkan struk |
| GET | `/api/v1/transaksi` | Semua | Rekap transaksi hari ini |
| GET | `/api/v1/transaksi/struk/:id` | Semua | Baca dokumen struk digital JSONB |
| POST | `/api/v1/restock` | Manajer | Sesuaikan stok (+tambah / -kurang) |
| GET | `/api/v1/restock/riwayat` | Semua | Laporan riwayat penyesuaian stok |

---

## BAGIAN 5 — 2 LAPIS KEAMANAN SISTEM

```
LAPIS 1 — Backend (JWT Middleware)
  - verifyToken: wajib ada header Authorization: Bearer <token>
  - requireRole: blokir akses lintas role (403 Forbidden)
  - Token berlaku 8 jam

LAPIS 2 — Database (Roles + RLS)
  - REVOKE ALL: tidak ada query langsung ke tabel mentah
  - GRANT EXECUTE: kasir hanya bisa jalankan 6 SP kasir
  - RLS Policy: kasir hanya baca transaksi sendiri
```

---

## BAGIAN 6 — CARA MENJALANKAN PROJECT (DARI NOL)

### Prasyarat yang Harus Terinstall:
- [ ] Docker Desktop (aktif dan berjalan)
- [ ] Node.js versi 18 ke atas
- [ ] Postman (untuk testing API)

### Langkah 1 — Jalankan Database PostgreSQL di Docker
```powershell
cd d:\MBD
docker compose up -d
```
Tunggu hingga container pos_jalur_langit_db berstatus Running.

### Langkah 2 — Install Dependensi Node.js
```powershell
npm install
```

### Langkah 3 — Eksekusi Skrip SQL (WAJIB BERURUTAN!)
```powershell
# 1. Buat struktur 7 tabel + constraints + index
Get-Content sql/01_schema.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# 2. Isi data awal (user, menu, transaksi demo)
Get-Content sql/02_seed.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# 3. Buat 5 views
Get-Content sql/views/01_views.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# 4. Buat 8 fungsi (HARUS sebelum procedures)
Get-Content sql/functions/01_functions.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# 5. Buat 3 trigger
Get-Content sql/triggers/01_triggers.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# 6. Buat 10 stored procedures
Get-Content sql/procedures/01_procedures.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# 7. Setup roles & RLS (HARUS TERAKHIR)
Get-Content sql/07_roles_rls.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
```

> URUTAN SQL SANGAT PENTING! Functions harus dibuat sebelum Procedures. Roles harus dibuat terakhir karena perlu GRANT EXECUTE ke semua SP yang sudah ada.

### Langkah 4 — Jalankan Backend API
```powershell
npm run dev
```
Server aktif di: http://localhost:3000/api/v1

### Langkah 5 — Testing dengan Postman
1. Buka Postman -> Import -> pilih file postman_collection.json
2. Mulai dari request "Login Kasir" atau "Login Manajer"
3. Salin token JWT dari response login
4. Paste ke header: Authorization: Bearer <token>

---

## BAGIAN 7 — KONEKSI DATABASE (DBeaver / pgAdmin / TablePlus)

```
Host     : localhost
Port     : 5433
Database : pos_jalur_langit
User     : pos_admin
Password : pos_password
```

**Perintah psql berguna:**
```powershell
# Masuk ke terminal interaktif database
docker exec -it pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit

# Verifikasi tabel sudah ada
docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit -c "\dt"

# Verifikasi stored procedures sudah ada
docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit -c "\df sp_*"

# Verifikasi triggers sudah ada
docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit -c "SELECT trigger_name, event_object_table FROM information_schema.triggers;"

# Lihat semua barang
docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit -c "SELECT id_barang, nama_barang, harga, stok FROM barang;"
```

---

## BAGIAN 8 — CHECKLIST VERIFIKASI (Setelah Setup Selesai)

**Database:**
- [ ] Container Docker pos_jalur_langit_db berstatus Running
- [ ] 7 tabel terbuat (\dt di psql)
- [ ] 5 views terbuat (\dv di psql)
- [ ] 8 fungsi terbuat (\df fn_* di psql)
- [ ] 10 stored procedures terbuat (\df sp_* di psql)
- [ ] 3 trigger terbuat (query information_schema.triggers)
- [ ] 2 roles terbuat: manajer_role, kasir_role (\du di psql)
- [ ] RLS aktif pada tabel transaksi
- [ ] Data seed ada: 3 user, 10 barang

**Backend:**
- [ ] npm install berhasil tanpa error
- [ ] npm run dev server aktif di port 3000
- [ ] File .env sudah diisi dengan nilai yang benar

**Testing API (via Postman):**
- [ ] POST /auth/login dengan kasir1/kasir123 -> mendapat JWT token
- [ ] POST /auth/login dengan manajer1/manajer123 -> mendapat JWT token
- [ ] GET /barang dengan token -> menampilkan 10 menu
- [ ] POST /transaksi/checkout dengan token kasir -> transaksi berhasil & stok berkurang
- [ ] PUT /barang/:id dengan token kasir -> HARUS gagal (403 Forbidden)
- [ ] PUT /barang/:id dengan token manajer -> berhasil update harga

---

## BAGIAN 9 — DOKUMEN REFERENSI TAMBAHAN

Semua dokumen berikut ada di folder d:\MBD\:

| File | Isi |
|---|---|
| README.md | Panduan teknis singkat & struktur direktori |
| PROJECT_SUMMARY.md | Dokumentasi komprehensif lengkap termasuk kamus SQL |
| database_dictionary.md | Kamus data: spesifikasi tiap kolom di 7 tabel |
| erd_and_usecase.md | ERD Mermaid + 5 spesifikasi Use Case lengkap |
| context1.md | Ringkasan arsitektur & inventaris semua objek DB |
| postman_collection.json | Koleksi siap pakai untuk testing semua 10 endpoint |

---

Dokumen ini dibuat berdasarkan kode aktual di repository d:\MBD — POS Kafe Jalur Langit, proyek akhir mata kuliah Manajemen Basis Data (MBD).
