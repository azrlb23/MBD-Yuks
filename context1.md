# Fondasi Sistem POS Kafe Jalur Langit
## Dokumentasi Arsitektur & Inventaris Objek Basis Data — Versi 7 Tabel & 3 Trigger

---

## 📋 Daftar Use Case Utama

| Kode | Nama UC | Aktor | Deskripsi Singkat |
|---|---|---|---|
| **UC-00** | Login User | Kasir, Manajer | Otentikasi pengguna dan penerbitan token akses JWT |
| **UC-01** | Checkout Penjualan | Kasir | Pemrosesan pesanan menu, pemotongan stok otomatis, dan penerbitan struk JSONB |
| **UC-02** | Restock Barang | Manajer | Pencatatan penambahan stok porsi menu dari supplier |
| **UC-03** | Kelola Harga & Spesifikasi Produk | Manajer | Pembaruan harga jual dan varian spesifikasi dinamis JSONB |

---

## 🗄️ Struktur 7 Tabel Utama (Bahasa Indonesia)

1. **`pengguna`**: Akun kasir & manajer (`id_pengguna`, `username`, `password_hash`, `nama_lengkap`, `peran`, `is_active`)
2. **`kategori`**: Kategori menu (`id_kategori`, `nama_kategori`)
3. **`barang`**: Katalog menu kafe (`id_barang`, `nama_barang`, `id_kategori`, `harga`, `stok`, `spesifikasi` JSONB, `is_active`)
4. **`transaksi`**: Header pesanan kasir (`id_transaksi`, `id_kasir`, `total_bayar`, `created_at`)
5. **`detail_transaksi`**: Detail item pesanan (`id_detail`, `id_transaksi`, `id_barang`, `nama_barang`, `harga_satuan`, `jumlah`, `subtotal`)
6. **`struk`**: Struk digital JSONB (`id_struk`, `id_transaksi`, `data_struk` JSONB, `dicetak_at`)
7. **`restock`**: Riwayat restock stok kafe (`id_restock`, `id_barang`, `jumlah_tambah`, `id_manajer`, `nama_supplier`, `created_at`)

---

## ⚡ 3 Trigger Otomatis
1. `trg_kurang_stok`: AFTER INSERT ON `detail_transaksi` → memotong stok porsi di `barang.stok`, raise exception jika stok < 0 (rollback otomatis).
2. `trg_tambah_stok_restock`: AFTER INSERT ON `restock` → menambah stok porsi di `barang.stok` secara otomatis.
3. `trg_validasi_harga_barang`: BEFORE INSERT OR UPDATE ON `barang` → memproteksi integritas data agar `harga > 0` dan `stok >= 0`.

---

## 📜 Stored Procedures (10 Procedures - CALL sp_...())
- **Write Logic**: `sp_login`, `sp_checkout_transaksi`, `sp_restock_barang`, `sp_update_harga_spesifikasi`
- **Read Wrappers (REFCURSOR)**: `sp_get_katalog_barang`, `sp_get_detail_barang`, `sp_get_transaksi_harian`, `sp_get_detail_struk`, `sp_get_laporan_restock`, `sp_get_daftar_pengguna`
