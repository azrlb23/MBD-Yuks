# Rangkuman Materi & Fitur Lanjutan Manajemen Basis Data (MBD)

Dokumen ini berisi rangkuman komprehensif seluruh materi, konsep, dan fitur lanjutan **Manajemen Basis Data (MBD)** PostgreSQL yang diterapkan pada proyek **POS Kafe Jalur Langit**. Dokumen ini dirancang sebagai panduan materi untuk ujian, persentasi, maupun *project defense*.

---

## 1. Stored Procedures (`sp_*`)
* **Pengertian**: Kumpulan blok kode SQL/PL-pgSQL yang tersimpan di server database dan dipanggil menggunakan perintah `CALL`. Stored Procedure mampu mengontrol transaksi secara penuh (`COMMIT` dan `ROLLBACK`).
* **Daftar di Codebase (10 Stored Procedures)**:
  1. `sp_login`: Mengautentikasi pengguna, memperbarui UUID `token_aktif` untuk sesi tunggal.
  2. `sp_logout`: Mengosongkan `token_aktif = NULL` untuk menghentikan sesi.
  3. `sp_checkout_transaksi`: Inti pemrosesan transaksi penjualan (validasi stok, insert detail, hitung total, terbitkan struk).
  4. `sp_restock_barang`: Mencatat jurnal penambahan/retur stok dari supplier.
  5. `sp_update_harga_spesifikasi`: Mengubah harga dan/atau gabungan (*merge*) JSONB spesifikasi barang.
  6. `sp_tambah_barang`: Menambahkan barang/menu baru ke katalog.
  7. `sp_tambah_pengguna` *(wrapper: `sp_buat_akun_kasir`)*: Membuat akun Kasir atau Manajer baru beserta hash bcrypt.
  8. `sp_toggle_status`: Menonaktifkan/mengaktifkan entitas (`akun`, `barang`, `kategori`) dengan proteksi *self-deactivation*.
  9. `sp_tambah_kategori`: Menambahkan kategori menu baru.
  10. `sp_get_katalog_barang` / `sp_get_detail_barang` / `sp_get_semua_transaksi` / `sp_get_detail_struk` / `sp_get_laporan_restock` / `sp_get_daftar_pengguna`: Mengembalikan kursor data terstruktur (`REFCURSOR`).
* **Gunanya**: Mengenkapsulasi logika bisnis di dalam database, mengurangi lalu lintas jaringan antara Node.js & Database, serta mencegah eksekusi query mentah dari luar.

---

## 2. User-Defined Functions (`fn_*` & `trg_fn_*`)
* **Pengertian**: Fungsi buatan di database yang menerima masukan argumen dan mengembalikan nilai skalar, tabel, `JSONB`, `SETOF`, atau `TRIGGER`. Bersifat *read-only* atau *atomic within statement*.
* **Daftar di Codebase (8 Functions)**:
  * **Read-Only / Utility**: `fn_validasi_ketersediaan`, `fn_merge_spesifikasi`, `fn_get_detail_struk`, `fn_get_semua_transaksi`, `fn_get_laporan_restock`, `fn_cek_sesi_aktif`.
  * **Trigger Functions**: `trg_fn_kurang_stok`, `trg_fn_tambah_stok_restock`, `trg_fn_validasi_harga_barang`.
* **Gunanya**: Menyediakan logika pemrosesan yang dapat digunakan kembali (*reusable*), baik oleh Stored Procedure maupun oleh Trigger.

---

## 3. Triggers (`trg_*`)
* **Pengertian**: Pengait otomatis (*event listener*) pada database yang mengeksekusi suatu fungsi (*Trigger Function*) secara otomatis saat terjadi perintah DML (`INSERT`, `UPDATE`, atau `DELETE`).
* **Daftar di Codebase (3 Triggers)**:
  1. `trg_kurang_stok` (`AFTER INSERT ON detail_transaksi`): Otomatis memotong jumlah stok di tabel `barang` setiap ada item transaksi baru.
  2. `trg_tambah_stok_restock` (`AFTER INSERT ON restock`): Otomatis menambah jumlah stok di tabel `barang` saat Manajer melakukan restock.
  3. `trg_validasi_harga_barang` (`BEFORE INSERT OR UPDATE ON barang`): Menjamin harga `> 0` dan stok `>= 0` sebelum baris disimpan.
* **Gunanya**: Otomatisasi konsistensi data dan proteksi keamanan integritas data di level terendah database.

---

## 4. Views (`vw_*`)
* **Pengertian**: Tabel virtual yang terbentuk dari kueri `SELECT` tersimpan. View menyajikan representasi data tanpa menyimpan fisik data terpisah.
* **Daftar di Codebase (5 Views)**:
  1. `vw_daftar_pengguna`: Menyajikan daftar pengguna aktif **tanpa** kolom sensitif (`password_hash` dan `token_aktif`).
  2. `vw_katalog_barang`: Menyajikan katalog barang aktif yang di-`JOIN` dengan nama kategorinya.
  3. `vw_semua_transaksi`: Menyajikan ringkasan transaksi (kasir, total item, total bayar, tanggal).
  4. `vw_laporan_restock`: Menyajikan jurnal restock lengkap dengan nama barang dan nama manajer.
  5. `vw_barang_spesifikasi`: Membongkar JSONB spesifikasi menjadi baris key-value dinamis.
* **Gunanya**: Menyembunyikan kolom sensitif, menyederhanakan kueri `JOIN` kompleks, dan membatasi data yang boleh terekspos.

---

## 5. Row-Level Security (RLS) & Security Policies
* **Pengertian**: Fitur keamanan tingkat baris di mana PostgreSQL membatasi baris data mana saja yang boleh dilihat/diubah oleh pengguna berdasarkan aturan kebijakan.
* **Daftar di Codebase (2 Policies)**:
  1. `rls_trx_context` pada tabel `transaksi`: Kasir hanya dapat melihat transaksi yang diproses oleh dirinya sendiri, sedangkan Manajer dapat melihat seluruh transaksi.
  2. `rls_struk_context` pada tabel `struk`: Kasir hanya dapat melihat struk transaksi miliknya sendiri.
* **Gunanya**: Mencegah kebocoran data antar Kasir di tingkat paling dasar (Database Level Isolation).

---

## 6. Database Roles & Privilege Management
* **Pengertian**: Pengaturan akun dan wewenang di tingkat database engine untuk membatasi perintah apa saja yang boleh dijalankan oleh suatu role (*Principle of Least Privilege*).
* **Daftar di Codebase**:
  * **Roles**: `pos_definer` (Owner/Superuser), `manajer_role`, `kasir_role`.
  * **Hak Akses (`GRANT`/`REVOKE`)**: Mencabut seluruh izin akses tabel langsung dari `kasir_role` dan `manajer_role` (`REVOKE ALL ON ALL TABLES`). Izin hanya diberikan untuk `EXECUTE` Stored Procedure.
  * **`SECURITY DEFINER`**: Stored Procedure dijalankan dengan wewenang `pos_definer` agar kasir/manajer bisa bertransaksi tanpa harus punya izin `UPDATE`/`INSERT` mentah ke tabel utama.
* **Gunanya**: Menutup celah SQL Injection dan akses tabel secara liar.

---

## 7. Pengindeksan Data / Indexing (B-Tree & GIN Index)
* **Pengertian**: Struktur data tambahan di database yang mempercepat proses pencarian data `SELECT`.
* **Daftar di Codebase**:
  * **B-Tree Index** (13 Indeks): Dipakai untuk Foreign Key, Username, dan Timestamp (`idx_pengguna_username`, `idx_transaksi_kasir`, `idx_transaksi_created_at`, dll).
  * **GIN Index** (1 Indeks): `idx_barang_spek_gin` pada kolom `barang.spesifikasi` (`JSONB`).
* **Gunanya**: B-Tree mempercepat pencarian skalar dan sorting, sedangkan GIN memecah dokumen JSONB agar pencarian kunci dinamis di dalam JSONB berjalan cepat.

---

## 8. Variabel Sesi Dinamis / Custom GUC (`set_config` & `current_setting`)
* **Pengertian**: Fitur PostgreSQL untuk menyisipkan variabel sementara di dalam sesi koneksi aktif.
* **Penerapan di Codebase**: Backend Express.js mengirimkan `set_config('pos.user_id', ...)` dan `set_config('pos.peran', ...)` sebelum menjalankan kueri.
* **Gunanya**: Menghubungkan identitas pengguna JWT dari aplikasi Express.js ke dalam PostgreSQL agar dibaca oleh Policy RLS.

---

## 9. Concurrency Control & Pessimistic Locking (`FOR UPDATE`)
* **Pengertian**: Penguncian baris data saat dibaca agar tidak bisa diubah oleh transaksi lain hingga transaksi saat ini selesai (`COMMIT`/`ROLLBACK`).
* **Penerapan di Codebase**: Menggunakan `SELECT ... FOR UPDATE` saat memeriksa stok di `sp_checkout_transaksi` dan `sp_restock_barang`.
* **Gunanya**: Mencegah *Race Condition* atau stok minus saat 2 kasir memotong stok barang yang sama secara bersamaan di detik yang sama.

---

## 10. Data Integrity Constraints (Batasan Tabel DDL)
* **Pengertian**: Aturan integritas data yang dipaksakan langsung oleh database engine.
* **Penerapan di Codebase**:
  * `PRIMARY KEY` & `FOREIGN KEY` (`ON DELETE RESTRICT` dan `ON DELETE CASCADE`).
  * `UNIQUE` (pada `username`, `nama_kategori`, `struk.id_transaksi`).
  * `CHECK` Constraint (`harga > 0`, `stok >= 0`, `peran IN ('manajer', 'kasir')`).
  * `NOT NULL` & `DEFAULT` (misal: `created_at DEFAULT NOW()`).
* **Gunanya**: Menjamin tidak ada data sampah/invalid yang masuk ke database.

---

## 11. Tipe Data Modern (`JSONB` & `SERIAL / IDENTITY`)
* **Pengertian**: Dukungan tipe data dokumen terstruktur dan penomoran otomatis.
* **Penerapan di Codebase**:
  * `JSONB`: Dipakai pada `barang.spesifikasi` (varian menu dinamis) dan `struk.data_struk` (dokumen struk cetak).
  * `SERIAL`: Dipakai untuk Auto-increment Primary Key seluruh tabel.
* **Gunanya**: Fleksibilitas skema tanpa perlu sering merubah DDL tabel saat ada varian menu baru.

---

## 12. Manajemen Transaksi ACID (`BEGIN`, `COMMIT`, `ROLLBACK`)
* **Pengertian**: Jaminan integritas transaksi (Atomicity, Consistency, Isolation, Durability).
* **Penerapan di Codebase**: Pengelolaan blok `BEGIN ... COMMIT` pada `executeWriteSP` dan `executeReadSP` di Node.js serta Stored Procedure PL-pgSQL.
* **Gunanya**: Menjamin bahwa seluruh rangkaian checkout (misal: 5 item) harus berhasil semua, atau jika 1 gagal maka seluruhnya dibatalkan (*rollback*) secara atomik.

---

## 13. Desain Pola Data: Historic Snapshot Pattern
* **Pengertian**: Teknik menyimpan duplikasi data historis pada saat transaksi terjadi.
* **Penerapan di Codebase**: Kolom `nama_barang` dan `harga_satuan` di dalam tabel `detail_transaksi`.
* **Gunanya**: Menjamin bahwa jika harga barang dinaikkan oleh Manajer di masa depan, laporan dan histori transaksi penjualan masa lalu tidak ikut berubah.
