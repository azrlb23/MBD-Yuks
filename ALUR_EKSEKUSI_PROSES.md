# Panduan Alur Eksekusi Kode Dari Awal Hingga Akhir (End-to-End Execution Flow)

Dokumen ini menjelaskan alur perjalanan data dan eksekusi kode dari awal (*HTTP Request masuk dari Client*) hingga akhir (*HTTP Response JSON dikirimkan balik*). 

Setiap alur dilengkapi dengan daftar file yang terlibat, lokasi pasti fungsi yang dieksekusi, serta hubungan antara file JavaScript di backend Node.js dan objek SQL di database PostgreSQL.

---

## 📋 Contoh Kasus 1: Penambahan Barang Baru oleh Manajer

### 1. HTTP Request Syntax
```http
POST /api/v1/barang
Host: localhost:3000
Authorization: Bearer <token_jwt_manajer>
Content-Type: application/json

{
  "nama_barang": "Espresso Single Shot",
  "id_kategori": 1,
  "harga": 15000,
  "stok": 40,
  "spesifikasi": {
    "biji_kopi": "Arabika Toraja",
    "suhu": ["panas"]
  }
}
```

---

### 2. Berkas yang Terlibat dalam Pemrosesan
1. [src/app.js](file:///d:/MBD/src/app.js) — Entry Point Aplikasi Express.js
2. [src/routes/product.routes.js](file:///d:/MBD/src/routes/product.routes.js) — Pengarah Rute Endpoints Produk
3. [src/middlewares/auth.middleware.js](file:///d:/MBD/src/middlewares/auth.middleware.js) — Middleware Autentikasi & Otorisasi
4. [src/controllers/product.controller.js](file:///d:/MBD/src/controllers/product.controller.js) — Controller Logika Produk
5. [src/services/sp.service.js](file:///d:/MBD/src/services/sp.service.js) — Jembatan Eksekusi Database (`pg.Pool`)
6. [sql/init.sql](file:///d:/MBD/sql/init.sql) — Stored Procedure `sp_tambah_barang` & Trigger `trg_validasi_harga_barang`

---

### 3. Diagram Alur Eksekusi (Step-by-Step)

```
[ Client (Postman) ]
        │
        │ 1. POST /api/v1/barang (Header Token + Body JSON)
        ▼
[ src/app.js ] ───────────────────> Mounting Router ke /api/v1/barang
        │
        ▼
[ src/routes/product.routes.js ] ───> Router cocokkan METHOD=POST dan PATH=/
        │
        ├──► 2. Middleware verifyToken (src/middlewares/auth.middleware.js)
        │       ├─ Cek keberadaan Token JWT di header
        │       ├─ Verifikasi rahasia JWT (jwt.verify)
        │       └─ Kueri DB: SELECT fn_cek_sesi_aktif(id, jti) == TRUE
        │
        ├──► 3. Middleware requireRole('manajer') (src/middlewares/auth.middleware.js)
        │       └─ Cek req.user.peran === 'manajer' ✅
        │
        ▼
[ src/controllers/product.controller.js ] ───> 4. Fungsi tambahBarang()
        │       ├─ Ekstrak nama_barang, id_kategori, harga, stok, spesifikasi
        │       └─ Konversi spesifikasi ke JSON string
        │
        ▼
[ src/services/sp.service.js ] ─────────────────> 5. Fungsi executeWriteSP()
        │       ├─ Pinjam koneksi dari pg.Pool
        │       ├─ Jalankan: BEGIN
        │       ├─ Jalankan: CALL sp_tambah_barang($1, $2, $3, $4, $5, $6)
        │       └─ Jalankan: COMMIT (Lalu rilis koneksi)
        │
        ========================================================================
        ▼ [ PERSISTENSI KE POSTGRESQL ENGINE ]
[ sql/init.sql ] ───────────────────────────────> 6. PROCEDURE sp_tambah_barang
        │       ├─ Cek Otorisasi DB: Pengguna $1 adalah Manajer aktif?
        │       ├─ Eksekusi: INSERT INTO barang (...) VALUES (...)
        │       │      │
        │       │      └──> 7. TRIGGER trg_validasi_harga_barang (BEFORE INSERT)
        │       │             └─ Cek harga > 0 dan stok >= 0 ✅
        │       └─ Simpan baris fisik ke dalam Tabel `barang`
        ========================================================================
        │
        ▼
[ src/controllers/product.controller.js ] ───> 8. Terima balasan sukses dari DB
        │
        ▼
[ Client (Postman) ] <────────────────────────── 9. HTTP Response 201 Created
                                                  {
                                                    "success": true,
                                                    "message": "Barang 'Espresso Single Shot' berhasil ditambahkan"
                                                  }
```

---

### 4. Rincian Penjelasan Tiap Langkah Kode

1. **Routing ([src/routes/product.routes.js](file:///d:/MBD/src/routes/product.routes.js#L14))**:
   Request `POST /api/v1/barang` ditangkap oleh router yang mendefinisikan:
   ```javascript
   router.post('/', verifyToken, requireRole('manajer'), tambahBarang);
   ```

2. **Verifikasi Token & Sesi ([src/middlewares/auth.middleware.js](file:///d:/MBD/src/middlewares/auth.middleware.js#L4))**:
   * Token JWT diekstrak dari header `Authorization: Bearer <token>`.
   * Node.js memverifikasi signature JWT.
   * `verifyToken` memanggil `fn_cek_sesi_aktif` di PostgreSQL untuk memastikan token UUID `jti` di JWT cocok dengan kolom `pengguna.token_aktif` di database. Jika cocok, data decoded disisipkan ke `req.user`.

3. **Verifikasi Peran ([src/middlewares/auth.middleware.js](file:///d:/MBD/src/middlewares/auth.middleware.js#L45))**:
   * `requireRole('manajer')` memeriksa apakah `req.user.peran === 'manajer'`. Jika bukan manajer, request langsung ditolak dengan HTTP 403.

4. **Eksekusi Controller ([src/controllers/product.controller.js](file:///d:/MBD/src/controllers/product.controller.js#L37))**:
   * Fungsi `tambahBarang` mengambil data dari `req.body`.
   * Melakukan validasi awal: `nama_barang`, `id_kategori`, dan `harga` tidak boleh kosong.

5. **Pemanggilan Service Database ([src/services/sp.service.js](file:///d:/MBD/src/services/sp.service.js#L19))**:
   * Service `executeWriteSP` meminjam koneksi dari `pg.Pool`, membuka transaksi `BEGIN`, dan mengeksekusi Stored Procedure:
     ```javascript
     await executeWriteSP('CALL sp_tambah_barang($1, $2, $3, $4, $5, $6)', [
       manajer_id, nama_barang, id_kategori, harga, stok, spesifikasiJson
     ]);
     ```

6. **Eksekusi Stored Procedure ([sql/init.sql](file:///d:/MBD/sql/init.sql#L282))**:
   * Engine PostgreSQL menjalankan `sp_tambah_barang`:
     ```sql
     IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN 
         RAISE EXCEPTION 'Akses ditolak: Hanya Manajer'; 
     END IF;
     INSERT INTO barang (nama_barang, id_kategori, harga, stok, spesifikasi, is_active) 
     VALUES (p_nama_barang, p_id_kategori, p_harga, p_stok_awal, p_spesifikasi, TRUE);
     ```

7. **Evaluasi Trigger ([sql/init.sql](file:///d:/MBD/sql/init.sql#L166))**:
   * Sebelum baris ditulis ke disk, Trigger `trg_validasi_harga_barang` terpicu otomatis (`BEFORE INSERT ON barang`) untuk mengecek `harga > 0` dan `stok >= 0`.

8. **Pengiriman Respon**:
   * Setelah `COMMIT` berhasil di DB, controller mengirimkan response JSON 201 ke client.

---

## 📋 Contoh Kasus 2: Menonaktifkan Barang oleh Manajer

### 1. HTTP Request Syntax
```http
PATCH /api/v1/sistem/status
Host: localhost:3000
Authorization: Bearer <token_jwt_manajer>
Content-Type: application/json

{
  "entitas": "barang",
  "id": 3,
  "is_active": false
}
```

---

### 2. Berkas yang Terlibat dalam Pemrosesan
1. [src/app.js](file:///d:/MBD/src/app.js) — Entry Point Aplikasi Express.js
2. [src/routes/sistem.routes.js](file:///d:/MBD/src/routes/sistem.routes.js) — Pengarah Rute Endpoints Sistem
3. [src/middlewares/auth.middleware.js](file:///d:/MBD/src/middlewares/auth.middleware.js) — Middleware Autentikasi & Otorisasi
4. [src/controllers/sistem.controller.js](file:///d:/MBD/src/controllers/sistem.controller.js) — Controller Logika Sistem / Admin
5. [src/services/sp.service.js](file:///d:/MBD/src/services/sp.service.js) — Jembatan Eksekusi Database (`pg.Pool`)
6. [sql/init.sql](file:///d:/MBD/sql/init.sql) — Stored Procedure `sp_toggle_status`

---

### 3. Diagram Alur Eksekusi (Step-by-Step)

```
[ Client (Postman) ]
        │
        │ 1. PATCH /api/v1/sistem/status (Header Token + Body JSON)
        ▼
[ src/app.js ] ───────────────────> Mounting Router ke /api/v1/sistem
        │
        ▼
[ src/routes/sistem.routes.js ] ───> Router cocokkan METHOD=PATCH dan PATH=/status
        │
        ├──► 2. Middleware verifyToken (src/middlewares/auth.middleware.js)
        │       ├─ Verifikasi JWT Token
        │       └─ Cek Sesi Aktif di DB (fn_cek_sesi_aktif) ✅
        │
        ├──► 3. Middleware requireRole('manajer') (src/middlewares/auth.middleware.js)
        │       └─ Cek req.user.peran === 'manajer' ✅
        │
        ▼
[ src/controllers/sistem.controller.js ] ─> 4. Fungsi toggleStatus()
        │       ├─ Ekstrak entitas="barang", id=3, is_active=false
        │       └─ Validasi entitas ada di ['akun', 'barang', 'kategori'] ✅
        │
        ▼
[ src/services/sp.service.js ] ─────────────> 5. Fungsi executeWriteSP()
        │       ├─ Pinjam koneksi dari pg.Pool
        │       ├─ Jalankan: BEGIN
        │       ├─ Jalankan: CALL sp_toggle_status($1, $2, $3, $4)
        │       └─ Jalankan: COMMIT (Lalu rilis koneksi)
        │
        ========================================================================
        ▼ [ PERSISTENSI KE POSTGRESQL ENGINE ]
[ sql/init.sql ] ───────────────────────────> 6. PROCEDURE sp_toggle_status
        │       ├─ Cek Otorisasi DB: Pengguna $1 adalah Manajer aktif?
        │       ├─ Evaluasi cabang p_entitas = 'barang'
        │       └─ Eksekusi: UPDATE barang SET is_active = FALSE WHERE id_barang = 3;
        ========================================================================
        │
        ▼
[ src/controllers/sistem.controller.js ] ─> 7. Terima balasan sukses dari DB
        │
        ▼
[ Client (Postman) ] <────────────────────── 8. HTTP Response 200 OK
                                              {
                                                "success": true,
                                                "message": "Status barang dengan ID 3 berhasil diubah menjadi non-aktif"
                                              }
```

---

### 4. Rincian Penjelasan Tiap Langkah Kode

1. **Routing ([src/routes/sistem.routes.js](file:///d:/MBD/src/routes/sistem.routes.js#L7))**:
   Request `PATCH /api/v1/sistem/status` diterima oleh router:
   ```javascript
   router.patch('/status', verifyToken, requireRole('manajer'), toggleStatus);
   ```

2. **Verifikasi Keamanan ([src/middlewares/auth.middleware.js](file:///d:/MBD/src/middlewares/auth.middleware.js))**:
   * `verifyToken` memastikan token JWT sah dan pemanggil memiliki `token_aktif` yang valid di PostgreSQL.
   * `requireRole('manajer')` memastikan hanya Manajer yang berhak mengubah status entitas sistem.

3. **Controller Input Validation ([src/controllers/sistem.controller.js](file:///d:/MBD/src/controllers/sistem.controller.js#L4))**:
   * Controller `toggleStatus` memeriksa masukan:
     ```javascript
     if (!['akun', 'barang', 'kategori'].includes(entitas)) {
       return res.status(400).json({ success: false, message: 'Entitas tidak valid' });
     }
     ```

4. **Eksekusi Stored Procedure Database ([sql/init.sql](file:///d:/MBD/sql/init.sql#L288))**:
   * Controller memanggil `executeWriteSP` untuk menjalankan `sp_toggle_status`:
     ```sql
     CREATE OR REPLACE PROCEDURE sp_toggle_status(
         p_id_manajer INT, p_entitas TEXT, p_id_target INT, p_status BOOLEAN
     ) ... AS $$
     BEGIN
         IF NOT EXISTS (SELECT 1 FROM pengguna WHERE id_pengguna = p_id_manajer AND peran = 'manajer' AND is_active = TRUE) THEN
             RAISE EXCEPTION 'Akses ditolak: Hanya Manajer aktif...';
         END IF;

         IF p_entitas = 'barang' THEN
             UPDATE barang SET is_active = p_status WHERE id_barang = p_id_target;
         ...
     END; $$;
     ```

5. **Dampak Langsung di Sistem**:
   * Setelah `is_active` barang di-set ke `FALSE`:
     * Barang otomatis **hilang dari katalog** yang diakses Kasir karena view `vw_katalog_barang` memiliki kondisi `WHERE b.is_active = TRUE`.
     * Jika Kasir mencoba men-checkout barang non-aktif tersebut melalui ID-nya, fungsi `fn_validasi_ketersediaan` akan mengembalikan `valid = FALSE`, dan transaksi akan otomatis dibatalkan (*rollback*).

6. **Pengiriman Respon**:
   * Server Node.js mengirimkan response HTTP 200 OK dengan pesan sukses.

---

## 📌 Ringkasan Pola Arsitektur End-to-End

```
HTTP Request ──> Router ──> Middlewares (JWT & Role) ──> Controller ──> SP Service (pg.Pool)
                                                                               │
HTTP Response <── Controller <── SP Service <── PostgreSQL Engine (SP + Trigger + Table)
```
