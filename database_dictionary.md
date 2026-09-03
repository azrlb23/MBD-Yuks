# Kamus Data Basis Data — POS Kafe Jalur Langit
## Versi 7 Tabel Bahasa Indonesia + Auth & 3 Trigger

Dokumen ini berisi spesifikasi rinci seluruh struktur tabel, tipe data, kunci (Primary Key & Foreign Key), serta deskripsi bisnis pada basis data Sistem POS Kafe Jalur Langit.

---

## 1. Tabel `pengguna`
- **Deskripsi**: Menyimpan akun pengguna (Kasir dan Manajer) untuk otentikasi dan User Access Control.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_pengguna` | SERIAL | PK | No | Identifikasi unik pengguna |
| `username` | VARCHAR(50) | UK | No | Nama pengguna unik untuk login |
| `password_hash` | VARCHAR(255) | - | No | Hash kata sandi pengguna |
| `nama_lengkap` | VARCHAR(100) | - | No | Nama lengkap pegawai |
| `peran` | VARCHAR(20) | - | No | Peran akun (`manajer` atau `kasir`) |
| `is_active` | BOOLEAN | - | No | Status akun (TRUE = aktif) |

---

## 2. Tabel `kategori`
- **Deskripsi**: Menyimpan data pengelompokan jenis barang menu kafe.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_kategori` | SERIAL | PK | No | Identifikasi unik untuk setiap kategori barang |
| `nama_kategori` | VARCHAR(50) | UK | No | Nama kategori menu (contoh: Minuman Kopi, Pastry, Makanan Berat) |

---

## 3. Tabel `barang`
- **Deskripsi**: Master data menu kafe beserta stok porsi dan atribut spesifikasi dinamis berformat JSONB.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_barang` | SERIAL | PK | No | Identifikasi unik untuk setiap barang menu |
| `nama_barang` | VARCHAR(100) | - | No | Nama menu kafe (contoh: Kopi Susu Gula Aren, Croissant) |
| `id_kategori` | INTEGER | FK | No | Kategori barang, merujuk ke `kategori.id_kategori` |
| `harga` | NUMERIC(12,2) | - | No | Harga jual per porsi (dalam Rupiah) |
| `stok` | INTEGER | - | No | Sisa stok porsi menu yang tersedia |
| `spesifikasi` | JSONB | - | Yes | Atribut varian menu dalam bentuk dokumen JSONB (GIN Index) |
| `is_active` | BOOLEAN | - | No | Status keaktifan menu (TRUE = aktif, FALSE = dinonaktifkan) |

---

## 4. Tabel `transaksi`
- **Deskripsi**: Header transaksi pesanan penjualan yang dicatat oleh kasir.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_transaksi` | SERIAL | PK | No | Identifikasi unik transaksi (berfungsi sebagai Nomor Struk) |
| `id_kasir` | INTEGER | FK | No | Kasir yang melayani, merujuk ke `pengguna.id_pengguna` |
| `total_bayar` | NUMERIC(14,2) | - | No | Total nominal pembayaran belanjaan (dalam Rupiah) |
| `created_at` | TIMESTAMPTZ | - | No | Tanggal dan waktu transaksi dibuat |

---

## 5. Tabel `detail_transaksi`
- **Deskripsi**: Rincian item menu yang dibeli dalam satu transaksi pesanan.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_detail` | SERIAL | PK | No | Identifikasi unik item transaksi |
| `id_transaksi` | INTEGER | FK | No | Merujuk ke header transaksi (`transaksi.id_transaksi`) |
| `id_barang` | INTEGER | FK | No | Merujuk ke barang yang dibeli (`barang.id_barang`) |
| `nama_barang` | VARCHAR(100) | - | No | Snapshot nama barang pada saat transaksi terjadi |
| `harga_satuan` | NUMERIC(12,2) | - | No | Snapshot harga jual barang pada saat transaksi terjadi |
| `jumlah` | INTEGER | - | No | Jumlah porsi yang dibeli (harus > 0) |
| `subtotal` | NUMERIC(14,2) | - | No | Hasil perkalian `harga_satuan * jumlah` |

---

## 6. Tabel `struk`
- **Deskripsi**: Dokumentasi struk belanja digital utuh yang disimpan dalam format JSONB.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_struk` | SERIAL | PK | No | Identifikasi unik dokumen struk digital |
| `id_transaksi` | INTEGER | FK, UK | No | Merujuk 1-ke-1 ke header transaksi (`transaksi.id_transaksi`) |
| `data_struk` | JSONB | - | No | Dokumen JSONB lengkap yang berisi rincian item, tanggal, dan total |
| `dicetak_at` | TIMESTAMPTZ | - | No | Tanggal dan waktu struk diterbitkan |

---

## 7. Tabel `restock`
- **Deskripsi**: Jurnal pencatatan penambahan stok porsi menu yang dipasok oleh supplier.

| Nama Kolom | Tipe Data | Kunci | Nullable | Deskripsi / Keterangan |
|---|---|---|---|---|
| `id_restock` | SERIAL | PK | No | Identifikasi unik catatan restock |
| `id_barang` | INTEGER | FK | No | Merujuk ke barang yang direstock (`barang.id_barang`) |
| `jumlah_tambah` | INTEGER | - | No | Jumlah porsi yang ditambahkan ke stok |
| `id_manajer` | INTEGER | FK | No | Manajer yang mencatat, merujuk ke `pengguna.id_pengguna` |
| `nama_supplier` | VARCHAR(100) | - | Yes | Nama pihak/perusahaan supplier penyedia stok |
| `created_at` | TIMESTAMPTZ | - | No | Tanggal dan waktu pencatatan restock |
