# Alur Fungsionalitas Endpoint — POS Kafe Jalur Langit

Dokumen ini menjelaskan langkah-langkah eksekusi secara berurutan untuk setiap
endpoint API, mulai dari request HTTP masuk hingga response JSON dikirimkan
kembali ke client. Setiap langkah mencantumkan **komponen mana yang bekerja**
dan **apa yang dilakukannya**.

> Simbol yang dipakai:
> - ✅ = kondisi terpenuhi / sukses
> - ❌ = kondisi gagal / ditolak → response error dikirim, alur berhenti
> - 🗄️ = operasi ke database PostgreSQL
> - 🔐 = pemeriksaan keamanan
> - 📤 = response dikirim ke client

---

## Autentikasi

### `POST /api/v1/auth/login`

**Tujuan**: Memverifikasi identitas pengguna dan menerbitkan token JWT.

```
Client → POST /api/v1/auth/login (body: { username, password })
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | **Router** | Terima request, jalankan middleware `requireGuest` sebelum controller. |
| 2 | 🔐 **`requireGuest`** | Cek header `Authorization`. Jika ada token dan token valid + sesi aktif di DB → ❌ 403 "Anda sudah login. Silakan logout terlebih dahulu". Jika tidak ada token atau sesi tidak aktif → lanjut ke controller. |
| 3 | **`auth.controller.js` → `login()`** | Ekstrak `username` dan `password` dari `req.body`. Jika salah satu kosong → ❌ 400 "Username dan password wajib diisi". |
| 4 | 🗄️ **`executeWriteSP`** | Panggil `CALL sp_login($1, ...)` dengan `username`. |
| 5 | 🗄️ **`sp_login` (PostgreSQL)** | `SELECT id_pengguna, password_hash, nama_lengkap, peran FROM pengguna WHERE username = ? AND is_active = TRUE`. Jika tidak ditemukan → `RAISE EXCEPTION` kode `28P01`. Generate `gen_random_uuid()` sebagai `token_aktif` baru → `UPDATE pengguna SET token_aktif = uuid WHERE id_pengguna = ?`. Kembalikan semua data ke controller. |
| 6 | **Controller** | Jika `idPengguna` null → ❌ 401 "Username atau password salah". Jalankan `bcrypt.compare(password, passwordHash)`. Jika tidak cocok → ❌ 401 "Username atau password salah". |
| 7 | **Controller** | Buat JWT dengan payload `{ id_pengguna, username, peran, nama, jti: tokenAktif }`, secret dari `JWT_SECRET`, expires `8h`. |
| 8 | 📤 **Response** | ✅ 200 `{ success: true, data: { id_pengguna, nama, peran, token } }` |

**Error yang mungkin:**
- `28P01` dari PostgreSQL → ditangkap catch, kembalikan 401.
- `JWT_SECRET` tidak terdefinisi → 500 Internal Server Error.

---

### `POST /api/v1/auth/logout`

**Tujuan**: Menginvalidasi sesi pengguna yang sedang aktif.

```
Client → POST /api/v1/auth/logout (header: Authorization: Bearer <token>)
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | **Router** | Terima request, jalankan middleware `verifyToken`. |
| 2 | 🔐 **`verifyToken`** | Ekstrak token dari header `Authorization: Bearer <token>`. Jika tidak ada → ❌ 401 "Token tidak ditemukan". Jalankan `jwt.verify(token, JWT_SECRET)`. Jika gagal → ❌ 403 "Token tidak valid". Panggil `fn_cek_sesi_aktif(id_pengguna, jti)`. Jika `FALSE` → ❌ 403 "Sesi telah berakhir". Sisipkan `req.user = decoded`. |
| 3 | **`auth.controller.js` → `logout()`** | Ambil `req.user.id_pengguna`. |
| 4 | 🗄️ **`executeWriteSP`** | Panggil `CALL sp_logout($1)` dengan `id_pengguna`. |
| 5 | 🗄️ **`sp_logout` (PostgreSQL)** | `UPDATE pengguna SET token_aktif = NULL WHERE id_pengguna = ?`. Token lama tidak bisa dipakai lagi. |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, message: "Logout berhasil" }` |

---

## Akun Pengguna

### `GET /api/v1/akun`

**Tujuan**: Mengambil daftar seluruh akun pengguna yang aktif (tanpa data sensitif).

```
Client → GET /api/v1/akun (header: Authorization: Bearer <token-manajer>)
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi aktif di DB. Sisipkan `req.user`. |
| 2 | 🔐 **`requireRole('manajer')`** | Cek `req.user.peran === 'manajer'`. Jika bukan → ❌ 403 "Hanya manajer yang diizinkan". |
| 3 | **`akun.controller.js` → `getDaftarAkun()`** | Tidak ada input tambahan dari request. |
| 4 | 🗄️ **`executeReadSP`** | `BEGIN` → `CALL sp_get_daftar_pengguna('cur_pengguna')` → `FETCH ALL IN "cur_pengguna"` → `COMMIT`. |
| 5 | 🗄️ **`sp_get_daftar_pengguna` (PostgreSQL)** | Buka kursor dari `vw_daftar_pengguna` → `SELECT id_pengguna, username, nama_lengkap, peran, is_active FROM pengguna WHERE is_active = TRUE`. Kolom `password_hash` dan `token_aktif` **tidak** dikembalikan. |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, total: N, data: [...] }` |

---

### `POST /api/v1/akun`

**Tujuan**: Manajer membuat akun pengguna baru (Kasir atau Manajer).

```
Client → POST /api/v1/akun (atau POST /api/v1/akun/kasir)
Body: { username, password, nama_lengkap, peran?: "kasir"|"manajer" }
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi aktif. |
| 2 | 🔐 **`requireRole('manajer')`** | Pastikan pemanggilnya manajer. |
| 3 | **`akun.controller.js` → `tambahPengguna()`** | Ekstrak `username`, `password`, `nama_lengkap`, `peran` (default `'kasir'`). Jika ada yang kosong → ❌ 400. Jika `peran` bukan `'manajer'` atau `'kasir'` → ❌ 400. |
| 4 | **Controller** | `bcrypt.genSalt(10)` → `bcrypt.hash(password, salt)` → hasilkan `password_hash`. Proses hashing dilakukan di Node.js sebelum dikirim ke DB. |
| 5 | 🗄️ **`executeWriteSP`** | Panggil `CALL sp_tambah_pengguna($1, $2, $3, $4, $5)` dengan `[id_manajer, username, password_hash, nama_lengkap, peran]`. |
| 6 | 🗄️ **`sp_tambah_pengguna` (PostgreSQL)** | Verifikasi `id_manajer` adalah manajer aktif. Jika tidak → `RAISE EXCEPTION`. `INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, is_active) VALUES (?, ?, ?, peran, TRUE)`. Jika `username` sudah ada → error `23505` (unique violation). |
| 7 | 📤 **Response** | ✅ 201 `{ success: true, message: "Akun manajer/kasir 'username' berhasil dibuat" }` |

**Error yang mungkin:**
- Error `23505` dari PostgreSQL → username sudah ada (tangkap di catch jika diimplementasikan, saat ini diteruskan ke `errorHandler`).

---

## Barang / Katalog

### `GET /api/v1/barang`

**Tujuan**: Mengambil seluruh katalog barang yang aktif beserta kategorinya.

```
Client → GET /api/v1/barang (header: Authorization: Bearer <token>)
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. Semua role (manajer/kasir) diizinkan. |
| 2 | **`product.controller.js` → `getKatalog()`** | Tidak ada input dari request. |
| 3 | 🗄️ **`executeReadSP`** | `CALL sp_get_katalog_barang('cur_katalog')` → `FETCH ALL IN "cur_katalog"`. |
| 4 | 🗄️ **`sp_get_katalog_barang` (PostgreSQL)** | Buka kursor dari `vw_katalog_barang` → `SELECT b.id_barang, b.nama_barang, k.nama_kategori, b.harga, b.stok, b.spesifikasi, b.is_active FROM barang b JOIN kategori k ... WHERE b.is_active = TRUE`. |
| 5 | 📤 **Response** | ✅ 200 `{ success: true, total: N, data: [...] }` |

---

### `POST /api/v1/barang`

**Tujuan**: Manajer menambahkan menu baru ke katalog.

```
Client → POST /api/v1/barang
Body: { nama_barang, id_kategori, harga, stok, spesifikasi? }
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | 🔐 **`requireRole('manajer')`** | Hanya manajer. |
| 3 | **`product.controller.js` → `tambahBarang()`** | Ekstrak semua field dari `req.body`. Jika `nama_barang`, `id_kategori`, `harga`, atau `stok` kosong → ❌ 400. |
| 4 | 🗄️ **`executeWriteSP`** | Panggil `CALL sp_tambah_barang($1...$6)` dengan `[id_manajer, nama_barang, id_kategori, harga, stok, spesifikasi_json]`. |
| 5 | 🗄️ **`sp_tambah_barang` (PostgreSQL)** | Verifikasi `id_manajer` adalah manajer aktif. `INSERT INTO barang (nama_barang, id_kategori, harga, stok, spesifikasi, is_active) VALUES (...)`. Trigger `trg_validasi_harga_barang` berjalan → cek `harga > 0` dan `stok >= 0`. Jika tidak → `RAISE EXCEPTION`. |
| 6 | 📤 **Response** | ✅ 201 `{ success: true, message: "Barang berhasil ditambahkan" }` |

---

### `GET /api/v1/barang/:id`

**Tujuan**: Mengambil detail satu barang berdasarkan ID.

```
Client → GET /api/v1/barang/3 (header: Authorization: Bearer <token>)
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. Semua role diizinkan. |
| 2 | **`product.controller.js` → `getDetailBarang()`** | Ekstrak `id` dari `req.params`. |
| 3 | 🗄️ **`executeReadSP`** | Panggil `CALL sp_get_detail_barang($1, $2)` dengan `[id, 'cur_detail']` → `FETCH ALL IN "cur_detail"`. |
| 4 | 🗄️ **`sp_get_detail_barang` (PostgreSQL)** | Buka kursor → `SELECT * FROM barang WHERE id_barang = ?`. Mengembalikan data mentah dari tabel `barang` (termasuk `is_active = FALSE` sekalipun). |
| 5 | **Controller** | Jika `result` kosong → ❌ 404 "Barang tidak ditemukan". |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, data: { ...satu barang... } }` |

---

### `PUT /api/v1/barang/:id`

**Tujuan**: Manajer memperbarui harga dan/atau spesifikasi varian menu.

```
Client → PUT /api/v1/barang/3
Body: { harga?, spesifikasi? }   ← keduanya opsional, minimal satu diisi
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | 🔐 **`requireRole('manajer')`** | Hanya manajer. |
| 3 | **`product.controller.js` → `updateHargaSpesifikasi()`** | Ekstrak `id` dari `req.params`, ekstrak `harga` dan `spesifikasi` dari `req.body`. Jika `spesifikasi` ada, dikonversi ke JSON string. |
| 4 | 🗄️ **`executeWriteSP`** | Panggil `CALL sp_update_harga_spesifikasi($1...$4)` dengan `[id_manajer, id_barang, harga|null, spesifikasi_json|null]`. |
| 5 | 🗄️ **`sp_update_harga_spesifikasi` (PostgreSQL)** | Verifikasi `id_manajer` manajer aktif. Ambil `spesifikasi` lama dari tabel `barang`. Panggil `fn_merge_spesifikasi(spek_lama, spek_baru)` → hasilkan JSONB gabungan (key baru ditambah/menimpa, key lama yang tidak disentuh tetap ada). `UPDATE barang SET harga = COALESCE(harga_baru, harga), spesifikasi = merged WHERE id_barang = ?`. Trigger `trg_validasi_harga_barang` berjalan → cek `harga > 0`. |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, message: "Harga & spesifikasi berhasil diperbarui" }` |

---

## Transaksi

### `POST /api/v1/transaksi/checkout`

**Tujuan**: Kasir memproses pesanan pelanggan — ini endpoint paling kompleks di sistem.

```
Client → POST /api/v1/transaksi/checkout
Body: { items: [ { id_barang, jumlah }, ... ] }
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | 🔐 **`requireRole('kasir')`** | Hanya kasir. Manajer tidak bisa checkout. |
| 3 | **`transaction.controller.js` → `checkout()`** | Ekstrak `items` dari `req.body` dan `id_kasir` dari `req.user.id_pengguna`. Jika `items` kosong atau bukan array → ❌ 400. |
| 4 | 🗄️ **`executeWriteSP`** | Panggil `CALL sp_checkout_transaksi($1, $2, $3, $4)` dengan `[id_kasir, JSON.stringify(items), null, null]`. Dua parameter terakhir adalah `INOUT` yang akan diisi procedure. |
| 5 | 🗄️ **`sp_checkout_transaksi` (PostgreSQL)** | Lihat alur detail di bawah ↓ |
| 6 | **Controller** | Tangkap error jika mengandung "stok tidak mencukupi" → ❌ 400. |
| 7 | 📤 **Response** | ✅ 201 `{ success: true, data: { id_transaksi, total_bayar } }` |

**Alur di dalam `sp_checkout_transaksi`:**

```
[1] Validasi kasir → SELECT nama_lengkap FROM pengguna WHERE id = kasir AND is_active = TRUE
       → Jika NULL: RAISE EXCEPTION 'Kasir tidak ditemukan'

[2] Buat header transaksi → INSERT INTO transaksi (id_kasir, total_bayar=0.00)
       → Dapat p_id_transaksi (nomor struk)

[3] Loop tiap item dalam items_jsonb:
    [3a] Ekstrak id_barang dan jumlah dari JSON
    [3b] Validasi stok → SELECT dari fn_validasi_ketersediaan(id_barang, jumlah)
             → fn_validasi: cek stok >= jumlah AND is_active = TRUE
             → Jika valid = FALSE: RAISE EXCEPTION 'stok tidak mencukupi'
    [3c] Hitung subtotal = harga × jumlah
    [3d] INSERT INTO detail_transaksi (...) ← Trigger trg_kurang_stok berjalan di sini!
             → Trigger: UPDATE barang SET stok = stok - jumlah
             → Jika stok < 0 setelah dikurangi: RAISE EXCEPTION (rollback)
    [3e] Tambahkan item ke array JSONB v_items_struk untuk struk

[4] p_total_bayar := total semua subtotal
[5] UPDATE transaksi SET total_bayar = p_total_bayar
[6] INSERT INTO struk (id_transaksi, data_struk JSONB) ← Dokumen struk lengkap
```

---

### `GET /api/v1/transaksi`

**Tujuan**: Mengambil daftar transaksi — kasir hanya melihat miliknya, manajer melihat semua (RLS aktif).

```
Client → GET /api/v1/transaksi (header: Authorization: Bearer <token>)
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. Semua role diizinkan. |
| 2 | **`transaction.controller.js` → `getSemuaTransaksi()`** | Ekstrak `id_pengguna` dan `peran` dari `req.user`. |
| 3 | 🗄️ **`executeReadSP`** | `CALL sp_get_semua_transaksi($1, $2, $3)` dengan `[id_pengguna, peran, 'cur_semua_trx']` → `FETCH ALL IN "cur_semua_trx"`. |
| 4 | 🗄️ **`sp_get_semua_transaksi` (PostgreSQL)** | `set_config('pos.user_id', id_pengguna, true)` → `set_config('pos.peran', peran, true)` → Buka kursor dari `fn_get_semua_transaksi()`. |
| 5 | 🗄️ **`fn_get_semua_transaksi` + RLS** | `SELECT * FROM vw_semua_transaksi`. **RLS Policy `rls_trx_context` aktif**: jika `pos.peran = 'manajer'` → semua baris dikembalikan; jika `pos.peran = 'kasir'` → hanya baris di mana `id_kasir = pos.user_id`. |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, data: [...] }` |

---

### `GET /api/v1/transaksi/struk/:id`

**Tujuan**: Mengambil detail struk satu transaksi. `:id` bisa berupa angka atau kata `latest`.

```
Client → GET /api/v1/transaksi/struk/5  ATAU  GET /api/v1/transaksi/struk/latest
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. Semua role diizinkan. |
| 2 | **`transaction.controller.js` → `getDetailStruk()`** | Ekstrak `id` dari `req.params`. Jika `id === 'latest'` → konversi ke `-1` (kode sinyal ke procedure). Jika tidak, parse sebagai `parseInt`. |
| 3 | 🗄️ **`executeReadSP`** | `CALL sp_get_detail_struk($1, $2, $3, $4)` dengan `[id_pengguna, peran, id_transaksi, 'cur_struk']` → `FETCH ALL IN "cur_struk"`. |
| 4 | 🗄️ **`sp_get_detail_struk` (PostgreSQL)** | Set session variables (`pos.user_id`, `pos.peran`) untuk RLS. Jika `p_id_transaksi = -1` → `SELECT id_transaksi FROM transaksi ORDER BY created_at DESC LIMIT 1` (ambil terbaru). Buka kursor → `SELECT fn_get_detail_struk(p_id_transaksi) AS struk_json`. |
| 5 | 🗄️ **`fn_get_detail_struk` (PostgreSQL)** | `SELECT data_struk FROM struk WHERE id_transaksi = ?`. Berjalan dengan `SECURITY DEFINER` (`pos_definer`) sehingga RLS struk bisa dievaluasi. |
| 6 | **Controller** | Jika result kosong atau `struk_json` null → ❌ 404 "Struk tidak ditemukan". |
| 7 | 📤 **Response** | ✅ 200 `{ success: true, data: { id_transaksi, kasir, tanggal, items: [...], total_bayar } }` |

---

## Restock

### `POST /api/v1/restock`

**Tujuan**: Manajer mencatat penambahan (atau retur) stok dari supplier.

```
Client → POST /api/v1/restock
Body: { id_barang, jumlah_tambah, nama_supplier? }
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | 🔐 **`requireRole('manajer')`** | Hanya manajer. |
| 3 | **`restock.controller.js` → `restockBarang()`** | Ekstrak `id_barang`, `jumlah_tambah`, `nama_supplier` dari `req.body`. Jika `id_barang` atau `jumlah_tambah` kosong → ❌ 400. |
| 4 | 🗄️ **`executeWriteSP`** | `CALL sp_restock_barang($1, $2, $3, $4)` dengan `[id_manajer, id_barang, jumlah_tambah, nama_supplier|null]`. |
| 5 | 🗄️ **`sp_restock_barang` (PostgreSQL)** | Verifikasi `id_manajer` manajer aktif. `SELECT stok FROM barang WHERE id_barang = ?` → jika null → `RAISE EXCEPTION 'Barang tidak ditemukan'`. `INSERT INTO restock (id_barang, jumlah_tambah, id_manajer, nama_supplier)` ← **Trigger `trg_tambah_stok_restock` berjalan**: `UPDATE barang SET stok = stok + jumlah_tambah`. Jika stok hasil < 0 (retur melebihi stok) → `RAISE EXCEPTION` (rollback). |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, message: "Restock berhasil ditambahkan" }` |

---

### `GET /api/v1/restock/riwayat`

**Tujuan**: Manajer melihat laporan riwayat restock dengan filter opsional.

```
Client → GET /api/v1/restock/riwayat?id_barang=1&dari=2026-01-01&sampai=2026-12-31
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | **`restock.controller.js` → `getLaporanRestock()`** | Ekstrak `id_barang`, `dari`, `sampai` dari `req.query`. Jika tidak ada, kirim `null` ke SP (artinya tidak difilter). |
| 3 | 🗄️ **`executeReadSP`** | `CALL sp_get_laporan_restock($1, $2, $3, $4)` dengan `[id_barang|null, dari|null, sampai|null, 'cur_restock']` → `FETCH ALL IN "cur_restock"`. |
| 4 | 🗄️ **`sp_get_laporan_restock` → `fn_get_laporan_restock` (PostgreSQL)** | Buka kursor dari `vw_laporan_restock` dengan kondisi: `WHERE (id_barang IS NULL OR r.id_barang = ?) AND (dari IS NULL OR created_at::DATE >= ?) AND (sampai IS NULL OR created_at::DATE <= ?)`. |
| 5 | 📤 **Response** | ✅ 200 `{ success: true, total: N, data: [...] }` |

---

## Kategori

### `GET /api/v1/kategori`

**Tujuan**: Mengambil seluruh daftar kategori menu.

```
Client → GET /api/v1/kategori (header: Authorization: Bearer <token>)
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. Semua role diizinkan. |
| 2 | **`kategori.controller.js` → `getKategori()`** | Tidak ada input. |
| 3 | 🗄️ **`executeReadSP`** | `CALL sp_get_kategori('cur_kategori')` → `FETCH ALL IN "cur_kategori"`. |
| 4 | 🗄️ **`sp_get_kategori` (PostgreSQL)** | Buka kursor → `SELECT id_kategori, nama_kategori FROM kategori ORDER BY id_kategori`. |
| 5 | 📤 **Response** | ✅ 200 `{ success: true, message: "Berhasil mengambil data kategori", data: [...] }` |

---

### `POST /api/v1/kategori`

**Tujuan**: Manajer menambahkan jenis kategori menu baru.

```
Client → POST /api/v1/kategori
Body: { nama_kategori }
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | 🔐 **`requireRole('manajer')`** | Hanya manajer. |
| 3 | **`kategori.controller.js` → `tambahKategori()`** | Ekstrak `nama_kategori` dari `req.body`. Jika kosong → ❌ 400 "Nama kategori wajib diisi". |
| 4 | 🗄️ **`executeWriteSP`** | `CALL sp_tambah_kategori($1, $2)` dengan `[id_pengguna, nama_kategori]`. |
| 5 | 🗄️ **`sp_tambah_kategori` (PostgreSQL)** | Verifikasi `id_manajer` manajer aktif. `INSERT INTO kategori (nama_kategori) VALUES (?)`. Jika nama sudah ada → error `23505` (UNIQUE constraint `nama_kategori`). |
| 6 | **Controller** | Tangkap `error.code === '23505'` → ❌ 400 "Nama kategori sudah ada". |
| 7 | 📤 **Response** | ✅ 201 `{ success: true, message: "Kategori berhasil ditambahkan" }` |

---

## Sistem & Administrasi

### `PATCH /api/v1/sistem/status`

**Tujuan**: Manajer mengaktifkan atau menonaktifkan sebuah entitas (akun, barang, atau kategori).

```
Client → PATCH /api/v1/sistem/status
Body: { entitas: "akun"|"barang"|"kategori", id: <angka>, is_active: true|false }
```

| # | Komponen | Aksi |
|---|---|---|
| 1 | 🔐 **`verifyToken`** | Validasi JWT + cek sesi. |
| 2 | 🔐 **`requireRole('manajer')`** | Hanya manajer. |
| 3 | **`sistem.controller.js` → `toggleStatus()`** | Ekstrak `entitas`, `id`, `is_active` dari `req.body`. Jika `entitas` tidak ada dalam daftar `['akun', 'barang', 'kategori']` → ❌ 400. Jika `id` bukan number atau `is_active` bukan boolean → ❌ 400. |
| 4 | 🗄️ **`executeWriteSP`** | `CALL sp_toggle_status($1, $2, $3, $4)` dengan `[id_manajer, entitas, id, is_active]`. |
| 5 | 🗄️ **`sp_toggle_status` (PostgreSQL)** | Verifikasi `id_manajer` manajer aktif. Jalankan cabang sesuai `entitas`: <br> - `'akun'`: **Cek Proteksi Self-Deactivation** (jika `id_target === id_manajer` dan `is_active === false` → ❌ `RAISE EXCEPTION 'Anda tidak dapat menonaktifkan akun Anda sendiri'`). Jika menonaktifkan akun lain → `is_active = false` dan `token_aktif = NULL` (sesi pengguna target otomatis hangus/tertendang). <br> - `'barang'`: `UPDATE barang SET is_active = ?`. <br> - `'kategori'`: `UPDATE kategori SET is_active = ?`. |
| 6 | 📤 **Response** | ✅ 200 `{ success: true, message: "Status akun/barang/kategori dengan ID X berhasil diubah menjadi aktif/non-aktif" }` |

---

## Ringkasan Alur Middleware

Setiap request melewati lapisan ini secara berurutan **sebelum** sampai ke controller:

```
Request HTTP masuk
       ↓
[Express Router] — cocokkan method + path
       ↓
[requireGuest] (hanya /auth/login)
   └─ Ada sesi aktif? → tolak 403
   └─ Tidak ada / sesi tidak aktif → lanjut
       ↓
[verifyToken] (semua endpoint kecuali /login)
   ├─ Tidak ada header Authorization → tolak 401
   ├─ jwt.verify() gagal → tolak 403
   ├─ fn_cek_sesi_aktif() = FALSE → tolak 403
   └─ Sukses → req.user = { id_pengguna, username, peran, nama, jti }
       ↓
[requireRole('manajer'|'kasir')] (endpoint tertentu)
   ├─ req.user.peran ≠ role yang dibutuhkan → tolak 403
   └─ Cocok → lanjut
       ↓
[Controller] — eksekusi logika bisnis
       ↓
[sp.service.js] — eksekusi stored procedure
       ↓
[PostgreSQL] — jalankan procedure + trigger (jika ada)
       ↓
[Controller] — format response
       ↓
Response JSON dikirim ke client
       ↓
(jika error di mana saja)
[errorHandler middleware] — format error response JSON
```

---

## Ringkasan Keterlibatan Trigger per Endpoint

| Endpoint | Trigger yang Terpicu | Kapan |
|---|---|---|
| `POST /transaksi/checkout` | `trg_kurang_stok` | Setiap `INSERT INTO detail_transaksi` (per item) |
| `POST /transaksi/checkout` | `trg_validasi_harga_barang` | Tidak terpicu (tidak ada UPDATE/INSERT ke `barang`) |
| `POST /restock` | `trg_tambah_stok_restock` | Saat `INSERT INTO restock` |
| `POST /barang` | `trg_validasi_harga_barang` | Saat `INSERT INTO barang` |
| `PUT /barang/:id` | `trg_validasi_harga_barang` | Saat `UPDATE barang SET harga = ...` |
