# Glosarium — Kamus Istilah Proyek

Daftar definisi tunggal untuk setiap istilah, singkatan, nama tabel, kolom,
dan nama fungsi yang dipakai di seluruh proyek **POS Kafe Jalur Langit**
(kode, DDL, README, maupun diskusi). Tujuannya agar tidak ada dua orang
(atau dosen vs kelompok) memahami istilah yang sama dengan cara berbeda.

> `database_dictionary.md` menjelaskan **struktur kolom setiap tabel secara rinci**.
> `erd_and_usecase.md` menjelaskan **diagram ERD dan spesifikasi Use Case**.
> File ini menjelaskan **apa arti tiap istilah/field/status di proyek ini**.
> Kalau bingung bedanya "role" di kalimat "role PostgreSQL" vs "role di JWT",
> atau bedanya "kasir" sebagai aktor vs nilai kolom `peran`, cari di sini.

---

## 1. Singkatan Umum

| Istilah | Kepanjangan / Arti |
| --- | --- |
| **POS** | *Point of Sale* — sistem kasir yang menangani transaksi penjualan di titik terjadinya penjualan. Proyek ini adalah backend sistem POS untuk Kafe Jalur Langit. |
| **MBD** | Manajemen Basis Data — mata kuliah asal proyek ini. |
| **UC-00 s/d UC-04** | *Use Case* 0 sampai 4 — lima alur bisnis utama proyek: UC-00 Login User, UC-01 Checkout Penjualan, UC-02 Restock Barang, UC-03 Kelola Harga & Spesifikasi Produk, UC-04 Kelola Akun Kasir & Privilege. Router di `src/routes/` dan procedure di DDL dikelompokkan mengikuti penomoran ini. |
| **JWT** | *JSON Web Token* — standar token autentikasi berbasis JSON yang di-*sign* dengan secret key. Dipakai di proyek ini untuk membuktikan identitas pengguna setelah login. Token dikirim di header `Authorization: Bearer <token>`. |
| **JTI** | *JWT ID* — klaim standar dalam payload JWT yang berfungsi sebagai ID unik token. Di proyek ini, `jti` diisi dengan nilai UUID acak yang juga disimpan di kolom `pengguna.token_aktif`, digunakan untuk mekanisme *Single Session* — jika token lama tidak cocok dengan yang tersimpan di DB, token tersebut dianggap tidak valid. |
| **RBAC** | *Role-Based Access Control* — model kontrol akses berdasarkan peran (role), bukan identitas orang per orang. Diterapkan lewat middleware `requireRole()` di Express.js yang memeriksa nilai `peran` dalam JWT payload. |
| **RLS** | *Row-Level Security* — fitur PostgreSQL yang membatasi baris mana saja yang boleh dilihat oleh suatu role, di level tabel (bukan cuma kolom). Diterapkan di tabel `transaksi` dan `struk` agar kasir hanya bisa melihat transaksi miliknya sendiri, sedangkan manajer bisa melihat semua. |
| **DDL / DML / DCL** | *Data Definition Language* (`CREATE`, `ALTER`, `DROP` — struktur), *Data Manipulation Language* (`INSERT`, `UPDATE`, `SELECT` — isi data), *Data Control Language* (`GRANT`, `REVOKE` — hak akses). File `sql/init.sql` berisi ketiganya, dinamai sesuai konvensi karena DDL adalah bagian paling dominan. |
| **PK / FK / UK** | *Primary Key* (identitas unik baris) / *Foreign Key* (referensi ke baris di tabel lain) / *Unique Key* (nilai harus unik tapi bukan PK). |
| **JSONB** | Tipe data JSON biner PostgreSQL — berbeda dari tipe `JSON` teks biasa karena JSONB sudah di-*parse* saat disimpan dan bisa di-*index* menggunakan GIN Index. Dipakai untuk `barang.spesifikasi` (atribut varian menu dinamis) dan `struk.data_struk` (dokumen struk lengkap). |
| **GIN Index** | *Generalized Inverted Index* — tipe index di PostgreSQL yang dioptimalkan untuk mencari konten di dalam kolom JSONB, array, atau teks. Dipakai pada `barang.spesifikasi` (`idx_barang_spek_gin`) agar query mencari berdasarkan isi JSONB tetap cepat. |
| **UUID** | *Universally Unique Identifier* — string acak 128-bit berformat `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. Dipakai sebagai nilai `jti` (JWT ID) yang di-generate oleh `gen_random_uuid()` PostgreSQL di dalam `sp_login`. |
| **bcrypt** | Algoritma hashing password yang menggunakan *salt* dan faktor *work* (cost factor) untuk memperlambat proses hashing, sehingga menyulitkan serangan *brute-force*. Library yang dipakai: `bcryptjs` dengan salt rounds 10. |
| **REFCURSOR** | Tipe data PostgreSQL untuk kursor database — pointer ke result set yang sudah disiapkan. Dipakai agar *stored procedure* bisa mengembalikan banyak baris data. Cara kerjanya: procedure membuka kursor (`OPEN cur FOR SELECT ...`), lalu Node.js mengambil hasilnya dengan perintah `FETCH ALL IN "nama_cursor"`. |
| **SECURITY DEFINER** | Opsi pada procedure/function di PostgreSQL — membuat procedure tersebut berjalan dengan hak akses *pemiliknya* (biasanya `postgres` superuser atau `pos_definer`), bukan hak akses role yang memanggilnya. Dipakai di seluruh stored procedure proyek ini agar operasi yang memerlukan akses tabel bisa berjalan lewat procedure meski role pemanggil tidak punya akses tabel langsung. |
| **Connection Pool** | Sekumpulan koneksi database yang dibuat di awal dan digunakan ulang untuk setiap request, agar tidak perlu membuat koneksi baru setiap kali ada request. Di proyek ini dikelola oleh `pg.Pool` dengan maksimum 20 koneksi (`max: 20`). |

---

## 2. Entitas Domain (7 Tabel Utama)

| Entitas | Tabel | Apa Isinya |
| --- | --- | --- |
| **Pengguna** | `pengguna` | Akun pengguna yang dapat login ke sistem — Kasir dan Manajer. Tabel ini adalah "master" untuk autentikasi. Setiap transaksi (`id_kasir`) dan restock (`id_manajer`) selalu merujuk ke tabel ini. |
| **Kategori** | `kategori` | Pengelompokan jenis menu kafe (mis. Minuman Kopi, Pastry & Dessert). Setiap barang wajib masuk ke satu kategori. Ini tabel master referensi — hanya bisa dihapus jika tidak ada barang yang menggunakannya (`ON DELETE RESTRICT`). |
| **Barang** | `barang` | Master data menu kafe: nama, harga, stok porsi, dan spesifikasi varian dinamis. Ini tabel pusat yang direferensikan oleh `detail_transaksi` dan `restock`. |
| **Transaksi** | `transaksi` | Header (kepala) setiap transaksi penjualan yang diproses kasir. Berisi total harga dan siapa kasirnya — detail item ada di `detail_transaksi`. Tabel ini dilindungi RLS. |
| **Detail Transaksi** | `detail_transaksi` | Rincian item per baris dalam sebuah transaksi: barang apa, harga saat itu, berapa jumlah, dan subtotalnya. Satu transaksi bisa punya banyak detail. Trigger `trg_kurang_stok` berjalan di sini. |
| **Struk** | `struk` | Dokumen struk digital lengkap dalam format JSONB — berisi seluruh data transaksi yang siap ditampilkan ke pelanggan. Relasi 1-ke-1 dengan `transaksi` (satu transaksi = satu struk). Tabel ini dilindungi RLS. |
| **Restock** | `restock` | Jurnal pencatatan penambahan (atau retur/pengurangan jika `jumlah_tambah` negatif) stok porsi menu dari supplier. Trigger `trg_tambah_stok_restock` berjalan di sini untuk mengubah stok secara otomatis. |

---

## 3. Penjelasan Kolom Penting

Kolom-kolom ini gampang disalahpahami karena namanya serupa atau perannya ganda:

| Kolom | Tabel | Penjelasan |
| --- | --- | --- |
| `peran` | `pengguna` | Nilai `'manajer'` atau `'kasir'` — menentukan hak akses pengguna di seluruh sistem. Dibatasi oleh `CHECK (peran IN ('manajer', 'kasir'))` di level database. Nilai ini juga disematkan ke JWT payload saat login dan dibaca oleh middleware `requireRole()`. |
| `is_active` | `pengguna`, `barang` | `TRUE` = aktif/terlihat, `FALSE` = dinonaktifkan (*soft delete*). Pengguna nonaktif tidak bisa login; Barang nonaktif tidak muncul di katalog dan tidak bisa di-checkout. Toggle via `PATCH /api/v1/sistem/status` yang memanggil `sp_toggle_status`. |
| `token_aktif` | `pengguna` | Kolom kunci untuk mekanisme *Single Session*: menyimpan UUID yang menjadi nilai `jti` dari token JWT yang sedang aktif. Saat login baru → kolom ini diperbarui UUID baru (token lama otomatis mati). Saat logout → di-set `NULL`. Saat request masuk → middleware `verifyToken` mencocokkan `jti` dari JWT dengan nilai kolom ini via `fn_cek_sesi_aktif`. |
| `password_hash` | `pengguna` | Hash bcrypt dari password pengguna. **Tidak pernah** dikirim ke client. Proses pencocokan: `bcrypt.compare(password_input, password_hash)` di `auth.controller.js`. |
| `spesifikasi` | `barang` | Kolom JSONB bebas-skema untuk menyimpan atribut varian menu yang berbeda tiap item (mis. `{"suhu": ["dingin", "panas"]}` untuk kopi, `{"level_pedas": [1,2,3]}` untuk makanan berat). Update spesifikasi bersifat *merge* (gabung), bukan *replace* — menggunakan `fn_merge_spesifikasi`. |
| `nama_barang` | `detail_transaksi` | *Snapshot* nama barang pada saat transaksi terjadi — **sengaja** disimpan duplikat agar jika nama barang di tabel `barang` berubah, histori struk tetap mencatat nama yang benar pada waktu itu. |
| `harga_satuan` | `detail_transaksi` | *Snapshot* harga barang pada saat transaksi terjadi. Sama alasannya dengan `nama_barang` — melindungi integritas histori transaksi dari perubahan harga di masa depan. |
| `jumlah_tambah` | `restock` | Bisa bernilai **positif** (restock/penambahan stok dari supplier) atau **negatif** (retur/pengembalian stok ke supplier). Constraint: `CHECK (jumlah_tambah != 0)` — tidak boleh nol. |
| `data_struk` | `struk` | Dokumen JSONB lengkap berisi: `id_transaksi`, `kasir` (nama kasir), `tanggal`, `items` (array detail item), dan `total_bayar`. Dibuat oleh `sp_checkout_transaksi` menggunakan `jsonb_build_object`. |
| `total_bayar` | `transaksi` | Nilai awal di-INSERT sebagai `0.00` saat header transaksi dibuat, kemudian di-UPDATE setelah semua item diproses dan dijumlahkan di dalam `sp_checkout_transaksi`. |
| `created_at` | `transaksi`, `restock` | Timestamp otomatis (`DEFAULT NOW()`). Tidak bisa diisi manual melalui API — hanya bisa diisi langsung via SQL (seperti di seed data testing). |

---

## 4. Peran & Aktor — Istilah yang Sering Tertukar

"Peran" di proyek ini punya **dua lapisan berbeda** yang sering disalahpahami jika tidak dibedakan secara eksplisit:

| Istilah | Level | Nilai Contoh | Dipakai di |
| --- | --- | --- | --- |
| **Nilai kolom `peran`** | Lapisan data/aplikasi | `'manajer'`, `'kasir'` (huruf kecil, tanpa suffix) | Kolom `pengguna.peran` di database, payload JWT, middleware `requireRole()` |
| **Role PostgreSQL** | Lapisan database engine | `manajer_role`, `kasir_role`, `pos_definer` (dengan suffix `_role`) | DDL `GRANT`, `REVOKE`, konfigurasi OWNER object database |

> Seluruh koneksi database dari Node.js menggunakan satu user (`pos_admin`) yang merupakan superuser proyek. Pembatasan akses di lapisan aplikasi dilakukan lewat `verifyToken` + `requireRole()`, bukan lewat PostgreSQL role per request. Role PostgreSQL (`kasir_role`, `manajer_role`) adalah untuk keperluan GRANT permission pada object database, bukan untuk login per user.

Istilah aktor lain yang muncul dalam konteks berbeda:

| Istilah | Konteks | Penjelasan |
| --- | --- | --- |
| **Kasir (aktor UC-01)** | Use Case | Pegawai kafe yang melayani pelanggan dan memproses transaksi penjualan. |
| **Manajer (aktor UC-02 s/d UC-04)** | Use Case | Pengelola kafe yang bertanggung jawab atas stok, harga, akun kasir, dan laporan operasional. |
| `id_kasir` | Kolom `transaksi` | FK ke `pengguna.id_pengguna` — menyimpan siapa kasir yang memproses transaksi ini. |
| `id_manajer` | Kolom `restock` | FK ke `pengguna.id_pengguna` — menyimpan siapa manajer yang mencatat restock ini. |

---

## 5. Stored Procedures (`sp_*`)

Semua operasi tulis (*write*) dan baca terstruktur dilakukan lewat stored procedure, bukan query SQL langsung dari Node.js. Dipanggil dengan `CALL`.

| Nama Procedure | Dipanggil dari | Fungsi |
| --- | --- | --- |
| `sp_login` | `POST /api/v1/auth/login` | Cari data pengguna berdasarkan username + status aktif, generate UUID baru sebagai `token_aktif`, simpan UUID ke kolom `pengguna.token_aktif`, dan kembalikan data (termasuk `token_aktif`) ke controller untuk proses bcrypt dan pembuatan JWT. |
| `sp_logout` | `POST /api/v1/auth/logout` | Set kolom `pengguna.token_aktif = NULL` untuk pengguna yang logout — membuat semua token lama tidak valid seketika. |
| `sp_checkout_transaksi` | `POST /api/v1/transaksi/checkout` | Inti proses penjualan: validasi kasir aktif → buat header `transaksi` → iterasi setiap item (validasi stok via `fn_validasi_ketersediaan`, insert `detail_transaksi`) → hitung total → update `transaksi` → buat dokumen `struk` JSONB. |
| `sp_restock_barang` | `POST /api/v1/restock` | Verifikasi pemanggilnya adalah manajer aktif, cek barang ada di katalog, lalu INSERT ke tabel `restock` (stok berubah otomatis via trigger `trg_tambah_stok_restock`). |
| `sp_update_harga_spesifikasi` | `PUT /api/v1/barang/:id` | Verifikasi manajer aktif, ambil spesifikasi lama, merge spesifikasi lama + baru via `fn_merge_spesifikasi`, lalu UPDATE harga dan/atau spesifikasi barang. |
| `sp_tambah_barang` | `POST /api/v1/barang` | Verifikasi manajer aktif, lalu INSERT barang baru ke tabel `barang`. |
| `sp_tambah_pengguna` | `POST /api/v1/akun` | Verifikasi manajer aktif, lalu INSERT pengguna baru dengan peran yang ditentukan (`'manajer'` atau `'kasir'`). Password sudah di-hash di Node.js (controller `akun.controller.js`) sebelum dikirim ke procedure ini. (`sp_buat_akun_kasir` tetap ada sebagai wrapper kompatibilitas). |
| `sp_toggle_status` | `PATCH /api/v1/sistem/status` | Verifikasi manajer aktif, lalu UPDATE kolom `is_active` pada entitas target (`'akun'`, `'barang'`, atau `'kategori'`). Khusus entitas `'akun'`, memiliki **proteksi *self-deactivation*** (dilarang menonaktifkan diri sendiri yang sedang aktif) dan **otomatis meneset `token_aktif = NULL`** jika akun dinonaktifkan agar pengguna langsung tertendang (*auto-logout*). |
| `sp_tambah_kategori` | `POST /api/v1/kategori` | Verifikasi manajer aktif, lalu INSERT kategori baru. Jika nama sudah ada, PostgreSQL melempar error `23505` (unique violation) yang ditangkap oleh controller. |
| `sp_get_katalog_barang` | `GET /api/v1/barang` | Buka REFCURSOR dari view `vw_katalog_barang` untuk diambil oleh `executeReadSP` di Node.js. |
| `sp_get_detail_barang` | `GET /api/v1/barang/:id` | Buka REFCURSOR query langsung ke tabel `barang` berdasarkan `id_barang`. |
| `sp_get_semua_transaksi` | `GET /api/v1/transaksi` | Set session variables `pos.user_id` dan `pos.peran` untuk RLS, lalu buka REFCURSOR dari `fn_get_semua_transaksi()`. RLS akan menyaring baris yang dikembalikan. |
| `sp_get_detail_struk` | `GET /api/v1/transaksi/struk/:id` | Set session variables untuk RLS. Jika `id_transaksi = -1`, otomatis ambil `id_transaksi` terbaru. Buka REFCURSOR dengan memanggil `fn_get_detail_struk`. |
| `sp_get_laporan_restock` | `GET /api/v1/restock` | Buka REFCURSOR dari `fn_get_laporan_restock` dengan tiga filter opsional: `id_barang`, `dari` (tanggal mulai), dan `sampai` (tanggal akhir). |
| `sp_get_daftar_pengguna` | `GET /api/v1/akun` | Buka REFCURSOR dari view `vw_daftar_pengguna` (hanya pengguna aktif, tanpa kolom sensitif). |
| `sp_get_kategori` | `GET /api/v1/kategori` | Buka REFCURSOR query ke tabel `kategori` diurutkan by `id_kategori`. |

---

## 6. Functions (`fn_*`)

Function berbeda dari procedure: mengembalikan nilai, dipanggil dengan `SELECT`, dan tidak bisa mengatur transaksi sendiri.

| Nama Function | Dipanggil dari | Fungsi |
| --- | --- | --- |
| `fn_validasi_ketersediaan` | `sp_checkout_transaksi` (internal) | Cek apakah stok barang cukup dan barang masih aktif untuk sejumlah `p_jumlah` porsi. Mengembalikan TABLE berisi `valid` (BOOLEAN), `stok_saat_ini`, `harga`, dan `nama_barang`. |
| `fn_merge_spesifikasi` | `sp_update_harga_spesifikasi` (internal) | Menggabungkan dua objek JSONB — kunci dari `p_spek_baru` menimpa atau menambah kunci di `p_spek_lama`. Jika salah satu `NULL`, dianggap `{}`. Ditandai `IMMUTABLE` karena output-nya murni bergantung pada input (tanpa side effect). |
| `fn_get_detail_struk` | `sp_get_detail_struk` (internal) | Mengambil kolom `data_struk` dari tabel `struk` berdasarkan `id_transaksi`. Ditandai `SECURITY DEFINER` dan OWNER `pos_definer` agar bisa membaca tabel `struk` yang dilindungi RLS. |
| `fn_get_semua_transaksi` | `sp_get_semua_transaksi` (internal) | Wrapper: mengembalikan semua baris dari `vw_semua_transaksi`. RLS akan menyaring hasilnya berdasarkan session variables `pos.user_id` dan `pos.peran` yang sudah di-set sebelumnya. |
| `fn_get_laporan_restock` | `sp_get_laporan_restock` (internal) | Query ke `vw_laporan_restock` dengan filter opsional: `p_id_barang`, `p_dari` (tanggal mulai), `p_sampai` (tanggal akhir). Filter `NULL` berarti tidak ada filter untuk parameter tersebut. |
| `fn_cek_sesi_aktif` | `verifyToken` middleware (Node.js) | Membandingkan `p_token_aktif` (nilai `jti` dari JWT) dengan kolom `token_aktif` di tabel `pengguna`. Mengembalikan `TRUE` jika cocok (sesi valid), `FALSE` jika tidak (sesi tidak valid / sudah login di perangkat lain). |

---

## 7. Trigger Otomatis (`trg_*`)

Trigger berjalan secara otomatis ketika ada operasi DML tertentu, tanpa perlu dipanggil secara eksplisit dari aplikasi.

| Nama Trigger | Waktu Eksekusi | Tabel | Fungsi |
| --- | --- | --- | --- |
| `trg_kurang_stok` | `AFTER INSERT ON detail_transaksi` | `detail_transaksi` | Memotong stok porsi di `barang` sebesar `NEW.jumlah`. Jika `stok < 0` setelah dikurangi, trigger melempar `RAISE EXCEPTION` dan membatalkan seluruh transaksi (rollback otomatis). Ini lapisan keamanan kedua setelah validasi di `fn_validasi_ketersediaan`. |
| `trg_tambah_stok_restock` | `AFTER INSERT ON restock` | `restock` | Menambahkan stok di `barang` sebesar `NEW.jumlah_tambah`. Karena `jumlah_tambah` bisa negatif (retur), trigger juga memastikan sisa stok tidak menjadi `< 0`. |
| `trg_validasi_harga_barang` | `BEFORE INSERT OR UPDATE ON barang` | `barang` | Memvalidasi `harga > 0` dan `stok >= 0` **sebelum** baris ditulis ke tabel. Berjalan `BEFORE` sehingga bisa mencegah data tidak valid masuk ke database sama sekali — backup dari constraint `CHECK` di DDL. |

> `trg_*` adalah nama *trigger* (pengait ke tabel). Logikanya ada di trigger function bernama `trg_fn_*` (mis. `trg_fn_kurang_stok`). Trigger memanggil trigger function-nya saat kondisi terpicu.

---

## 8. Views (`vw_*`)

View adalah "tabel virtual" — query SELECT yang disimpan sebagai nama objek, sehingga bisa di-SELECT seperti tabel biasa tanpa mengekspos query aslinya.

| Nama View | Isi / Tujuan |
| --- | --- |
| `vw_daftar_pengguna` | Daftar pengguna yang `is_active = TRUE`, **tanpa** kolom `password_hash` dan `token_aktif` — aman untuk ditampilkan ke client. Dipakai oleh `sp_get_daftar_pengguna`. |
| `vw_katalog_barang` | Daftar barang aktif (`is_active = TRUE`) dengan nama kategorinya (JOIN ke `kategori`). Dipakai oleh `sp_get_katalog_barang`. |
| `vw_semua_transaksi` | Ringkasan semua transaksi dengan nama kasir (JOIN ke `pengguna`) dan jumlah item (COUNT dari `detail_transaksi`). Dipakai sebagai dasar RLS — kasir hanya bisa lihat baris di mana `id_kasir = pos.user_id`. |
| `vw_laporan_restock` | Riwayat restock dengan nama barang (JOIN ke `barang`) dan nama manajer (JOIN ke `pengguna`). Dipakai oleh `fn_get_laporan_restock`. |
| `vw_barang_spesifikasi` | Versi "dibuka/diratakan" dari spesifikasi JSONB — setiap key-value dalam JSONB jadi satu baris tersendiri menggunakan `LATERAL jsonb_each_text`. Berguna untuk analitik yang mencari berdasarkan isi spesifikasi tertentu. |

---

## 9. Indexes (`idx_*`)

Index mempercepat query SELECT dengan harga storage tambahan dan overhead kecil saat write. Semua index di proyek ini memakai prefix `idx_`.

| Nama Index | Tabel | Kolom | Jenis | Tujuan |
| --- | --- | --- | --- | --- |
| `idx_pengguna_username` | `pengguna` | `username` | UNIQUE | Mempercepat lookup saat login (`WHERE username = ?`) sekaligus menjamin tidak ada username duplikat. |
| `idx_pengguna_is_active` | `pengguna` | `is_active` | Biasa | Mempercepat query yang filter `is_active = TRUE`. |
| `idx_kategori_nama` | `kategori` | `nama_kategori` | Biasa | Mempercepat pencarian kategori by nama. |
| `idx_barang_kategori` | `barang` | `id_kategori` | Biasa | Mempercepat JOIN dari `barang` ke `kategori`. |
| `idx_barang_is_active` | `barang` | `is_active` | Biasa | Mempercepat filter `is_active = TRUE` saat tampil katalog. |
| `idx_barang_spek_gin` | `barang` | `spesifikasi` | **GIN** | Mempercepat query yang mencari *di dalam* konten JSONB (mis. `WHERE spesifikasi @> '{"suhu": "dingin"}'`). |
| `idx_transaksi_kasir` | `transaksi` | `id_kasir` | Biasa | Mempercepat filter transaksi by kasir — kritis untuk performa RLS. |
| `idx_transaksi_created_at` | `transaksi` | `created_at` | Biasa | Mempercepat query yang diurutkan atau difilter by tanggal transaksi. |
| `idx_detail_transaksi` | `detail_transaksi` | `id_transaksi` | Biasa | Mempercepat JOIN dari baris detail ke header transaksi. |
| `idx_detail_barang` | `detail_transaksi` | `id_barang` | Biasa | Mempercepat JOIN dari detail ke data barang. |
| `idx_struk_transaksi` | `struk` | `id_transaksi` | Biasa | Mempercepat lookup struk berdasarkan id transaksi. |
| `idx_restock_barang` | `restock` | `id_barang` | Biasa | Mempercepat filter laporan restock by barang. |
| `idx_restock_manajer` | `restock` | `id_manajer` | Biasa | Mempercepat filter laporan restock by manajer. |
| `idx_restock_created_at` | `restock` | `created_at` | Biasa | Mempercepat filter laporan restock by tanggal. |

---

## 10. Roles PostgreSQL & Hak Akses

| Role | Tipe | Hak Akses |
| --- | --- | --- |
| `pos_admin` | LOGIN (superuser proyek) | User yang dipakai koneksi Node.js (`pg.Pool`). Memiliki akses penuh ke database. Kredensial disimpan di `.env`. |
| `pos_definer` | NOLOGIN | Pemilik (OWNER) dari view dan function yang sensitif (`vw_semua_transaksi`, `fn_get_semua_transaksi`, `fn_get_detail_struk`, serta procedure terkait struk). Dengan `SECURITY DEFINER`, object yang dimiliki `pos_definer` berjalan atas namanya sehingga RLS bisa aktif dengan benar. |
| `manajer_role` | NOLOGIN | Memiliki `EXECUTE` pada **semua** procedure dan function. Tidak punya akses direct ke tabel (`REVOKE ALL ON ALL TABLES`). |
| `kasir_role` | NOLOGIN | Hanya punya `EXECUTE` pada procedure yang relevan: `sp_login`, `sp_logout`, `sp_checkout_transaksi`, `sp_get_katalog_barang`, `sp_get_semua_transaksi`, `sp_get_detail_struk`. |

---

## 11. RLS Policies (Kebijakan Row-Level Security)

| Nama Policy | Tabel | Berlaku untuk Role | Logika Akses |
| --- | --- | --- | --- |
| `rls_trx_context` | `transaksi` | `pos_definer` | **Manajer** (`pos.peran = 'manajer'`): bisa lihat semua baris. **Kasir** (`pos.peran = 'kasir'`): hanya bisa lihat baris di mana `id_kasir = pos.user_id`. Kondisi `IS NULL` sebagai fallback mencegah error jika session variable belum di-set. |
| `rls_struk_context` | `struk` | `pos_definer` | **Manajer**: bisa lihat semua struk. **Kasir**: hanya bisa lihat struk dari transaksi miliknya sendiri (sub-query ke `transaksi.id_kasir`). |

Session variables `pos.user_id` dan `pos.peran` di-set di awal setiap procedure baca (`sp_get_semua_transaksi`, `sp_get_detail_struk`) menggunakan `PERFORM set_config('pos.peran', ..., true)` sebelum kursor dibuka. Parameter ketiga `true` artinya nilai hanya berlaku untuk transaksi saat ini (*transaction-local*).

---

## 12. Mekanisme Single Session

*Single Session* adalah fitur keamanan yang memastikan satu akun hanya bisa aktif di satu perangkat/sesi pada satu waktu. Cara kerjanya:

| Langkah | Yang Terjadi |
| --- | --- |
| **Login (perangkat A)** | `sp_login` generate UUID baru → simpan di `pengguna.token_aktif` → UUID ini jadi nilai `jti` di JWT yang dikirim ke perangkat A. |
| **Login lagi (perangkat B)** | `sp_login` generate UUID **baru lagi** → timpa `pengguna.token_aktif` → JWT lama perangkat A langsung tidak valid karena `jti`-nya tidak cocok lagi. |
| **Request dari perangkat A** | `verifyToken` panggil `fn_cek_sesi_aktif(id_pengguna, jti_lama)` → DB kembalikan `FALSE` → request ditolak 403. |
| **Logout** | `sp_logout` set `pengguna.token_aktif = NULL` → token yang ada tidak bisa dipakai lagi. |
| **Login setelah sudah punya sesi aktif** | Middleware `requireGuest` cek apakah sudah ada sesi aktif → jika ya, tolak 403 dengan pesan "Anda sudah login". |

---

## 13. Middleware Node.js

| Middleware | File | Fungsi |
| --- | --- | --- |
| `verifyToken` | `auth.middleware.js` | Memvalidasi JWT dari header `Authorization: Bearer <token>`. Jika valid secara kriptografi, mengecek `jti` ke database via `fn_cek_sesi_aktif`. Jika sesi aktif, menyuntikkan `req.user` (payload JWT decoded) ke dalam objek request untuk dipakai controller. |
| `requireRole(role)` | `auth.middleware.js` | *Factory middleware* — menerima nama role (`'manajer'` atau `'kasir'`), mengembalikan middleware yang memeriksa `req.user.peran`. Menolak request dengan HTTP 403 jika role tidak sesuai. |
| `requireGuest` | `auth.middleware.js` | Kebalikan dari `verifyToken` — memblokir akses jika request sudah memiliki sesi aktif di database. Dipakai pada endpoint `POST /auth/login` untuk mencegah login ganda. |
| `errorHandler` | `error.middleware.js` | Error handler global Express — menangkap semua error yang di-`next(error)` oleh controller, dan mengembalikan respons JSON terformat (`success: false`, `message`, `error_code`). |
| `notFoundHandler` | `error.middleware.js` | Menangkap request ke route yang tidak terdaftar dan mengembalikan HTTP 404 dengan pesan deskriptif. |

---

## 14. Services Node.js (`sp.service.js`)

| Fungsi | Untuk Tipe Procedure | Cara Kerja |
| --- | --- | --- |
| `executeReadSP` | Procedure yang membuka REFCURSOR (prosedur baca banyak baris) | `BEGIN` → `CALL procedure` → `FETCH ALL IN "cur_..."` → `COMMIT` → kembalikan `rows`. Nama kursor diambil otomatis dari parameter yang diawali `cur_`. |
| `executeWriteSP` | Procedure/function yang menulis data ATAU mengembalikan nilai scalar | `BEGIN` → `CALL` atau `SELECT` → `COMMIT` → kembalikan `rows[0]`. Dipakai juga untuk `fn_cek_sesi_aktif` karena merupakan `SELECT` yang mengembalikan nilai scalar (BOOLEAN). |

> Menggunakan `executeWriteSP` untuk function yang mengembalikan `BOOLEAN` (seperti `fn_cek_sesi_aktif`) adalah **disengaja** — karena `executeReadSP` hanya bekerja untuk procedure yang membuka REFCURSOR, bukan untuk function yang mengembalikan nilai langsung.

---

## 15. Format Respons API

Semua endpoint mengembalikan JSON dengan format konsisten:

```json
{
  "success": true,
  "message": "Pesan deskriptif (opsional)",
  "total": 10,
  "data": { } 
}
```

| Field | Ada di | Isi |
| --- | --- | --- |
| `success` | Semua respons | `true` jika operasi berhasil, `false` jika gagal. |
| `message` | Error + beberapa sukses | Penjelasan *human-readable* untuk developer atau user. |
| `data` | Respons sukses yang membawa data | Objek tunggal (`{}`) atau array (`[]`), bergantung endpoint. |
| `total` | Respons sukses berupa array | Jumlah item dalam array `data` (kemudahan front-end, tidak selalu ada). |
| `error_code` | Respons error (dari `errorHandler`) | Kode error internal atau kode error PostgreSQL (mis. `23505` untuk unique violation, `28P01` untuk autentikasi gagal). |

---

## 16. Endpoint API Lengkap

| Method | Path | Auth | Role | Stored Procedure | Fungsi |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | `requireGuest` | - | `sp_login` | Login → terbitkan JWT |
| `POST` | `/api/v1/auth/logout` | `verifyToken` | semua | `sp_logout` | Logout → invalidasi sesi |
| `GET` | `/api/v1/akun` | `verifyToken` | manajer | `sp_get_daftar_pengguna` | Daftar akun pengguna aktif |
| `POST` | `/api/v1/akun/kasir` | `verifyToken` | manajer | `sp_buat_akun_kasir` | Buat akun kasir baru |
| `GET` | `/api/v1/barang` | `verifyToken` | semua | `sp_get_katalog_barang` | Katalog barang aktif |
| `POST` | `/api/v1/barang` | `verifyToken` | manajer | `sp_tambah_barang` | Tambah barang baru |
| `GET` | `/api/v1/barang/:id` | `verifyToken` | semua | `sp_get_detail_barang` | Detail satu barang |
| `PUT` | `/api/v1/barang/:id` | `verifyToken` | manajer | `sp_update_harga_spesifikasi` | Update harga & spesifikasi |
| `POST` | `/api/v1/transaksi/checkout` | `verifyToken` | kasir | `sp_checkout_transaksi` | Proses transaksi penjualan |
| `GET` | `/api/v1/transaksi` | `verifyToken` | semua | `sp_get_semua_transaksi` | Daftar transaksi (RLS aktif) |
| `GET` | `/api/v1/transaksi/struk/:id` | `verifyToken` | semua | `sp_get_detail_struk` | Detail struk (`:id` atau `latest`) |
| `POST` | `/api/v1/restock` | `verifyToken` | manajer | `sp_restock_barang` | Catat restock barang |
| `GET` | `/api/v1/restock` | `verifyToken` | manajer | `sp_get_laporan_restock` | Laporan restock (filter opsional) |
| `GET` | `/api/v1/kategori` | `verifyToken` | semua | `sp_get_kategori` | Daftar semua kategori |
| `POST` | `/api/v1/kategori` | `verifyToken` | manajer | `sp_tambah_kategori` | Tambah kategori baru |
| `PATCH` | `/api/v1/sistem/status` | `verifyToken` | manajer | `sp_toggle_status` | Toggle `is_active` entitas |

---

## 17. Nama File & Prefiks Kode

| Nama / Prefiks | Arti |
| --- | --- |
| `sp_*` | Prefiks penamaan untuk *stored procedure* di PostgreSQL (mis. `sp_login`, `sp_checkout_transaksi`). Dipanggil dengan `CALL`. |
| `fn_*` | Prefiks untuk *function* biasa yang mengembalikan nilai (mis. `fn_cek_sesi_aktif`, `fn_merge_spesifikasi`). Dipanggil dengan `SELECT`. |
| `trg_fn_*` | Prefiks untuk *trigger function* — badan logika trigger (mis. `trg_fn_kurang_stok`). Tidak dipanggil langsung; hanya dipanggil oleh trigger. |
| `trg_*` | Prefiks untuk *trigger* itu sendiri — pengait ke tabel yang memanggil trigger function (mis. `trg_kurang_stok`). |
| `vw_*` | Prefiks untuk *view* (mis. `vw_katalog_barang`, `vw_semua_transaksi`). |
| `idx_*` | Prefiks untuk *index* (mis. `idx_barang_spek_gin`). |
| `cur_*` | Prefiks penamaan kursor REFCURSOR (mis. `cur_katalog`, `cur_struk`, `cur_pengguna`). Konvensi ini dipakai `executeReadSP` untuk mendeteksi nama kursor secara otomatis dari daftar parameter. |
| `p_*` | Prefiks parameter stored procedure/function (mis. `p_id_kasir`, `p_items_jsonb`). |
| `v_*` | Prefiks variabel lokal dalam blok `DECLARE` di PL/pgSQL (mis. `v_total`, `v_nama_kasir`, `v_stok_sisa`). |
| `src/controllers/` | Berisi controller Express.js — lapisan yang menerima request HTTP, memanggil service database, dan mengirim response JSON. |
| `src/routes/` | Berisi definisi routing Express.js — menghubungkan method + path URL ke controller dan middleware yang sesuai. |
| `src/middlewares/` | Berisi middleware Express.js — `auth.middleware.js` (autentikasi & otorisasi) dan `error.middleware.js` (error handling global). |
| `src/services/` | Berisi `sp.service.js` — lapisan abstraksi database yang mengeksekusi stored procedure via `pg` driver. |
| `src/database/` | Berisi `db.js` — konfigurasi dan inisialisasi `pg.Pool` (connection pool PostgreSQL). |
| `sql/init.sql` | Master SQL script yang berisi DDL (tabel + index), seed data, views, functions, triggers, procedures, roles, dan RLS policies. Otomatis dieksekusi saat container Docker pertama kali dibuat. |
| `compose.yaml` | Konfigurasi Docker Compose untuk menjalankan container PostgreSQL secara lokal. Mount `sql/init.sql` ke `/docker-entrypoint-initdb.d/`. |
| `.env` | File environment variables lokal — berisi `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`. **Tidak di-commit ke Git** (ada di `.gitignore`). |
