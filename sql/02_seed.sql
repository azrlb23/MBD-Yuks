-- =============================================================================
-- POS Kafe Jalur Langit — Seed Data (7 Tabel Bahasa Indonesia)
-- =============================================================================

-- 1. SEED PENGGUNA (1 Manajer, 2 Kasir)
INSERT INTO pengguna (username, password_hash, nama_lengkap, peran, is_active) VALUES
('manajer1', 'manajer123', 'Budi Manajer Utama', 'manajer', TRUE),
('kasir1',   'kasir123',   'Siti Kasir Shift Pagi', 'kasir', TRUE),
('kasir2',   'kasir123',   'Rian Kasir Shift Malam', 'kasir', TRUE);

-- 2. SEED KATEGORI
INSERT INTO kategori (nama_kategori) VALUES
('Minuman Kopi'),
('Minuman Non-Kopi'),
('Pastry & Dessert'),
('Makanan Berat'),
('Cemilan');

-- 3. SEED KATALOG BARANG MENU KAFE
INSERT INTO barang (nama_barang, id_kategori, harga, stok, spesifikasi) VALUES
('Kopi Susu Gula Aren', 1, 22000.00, 45, '{"suhu": ["dingin", "panas"], "tingkat_gula": ["normal", "sedikit"]}'::jsonb),
('Americano Single Shot', 1, 18000.00, 50, '{"suhu": ["dingin", "panas"], "biji_kopi": "Arabika Gayo"}'::jsonb),
('Caramel Macchiato', 1, 28000.00, 30, '{"suhu": ["dingin", "panas"], "caramel_drizzle": true}'::jsonb),
('Matcha Latte Ice', 2, 26000.00, 35, '{"jenis_susu": ["susu_sapi", "susu_oat"]}'::jsonb),
('Chocolate Signature Cold', 2, 25000.00, 40, '{"whipped_cream": true}'::jsonb),
('Croissant Butter Classic', 3, 25000.00, 15, '{"dihangatkan": true}'::jsonb),
('Choco Lava Cake', 3, 28000.00, 12, '{"dihangatkan": true}'::jsonb),
('Nasi Goreng Kafe Spesial', 4, 32000.00, 25, '{"level_pedas": [1, 2, 3]}'::jsonb),
('Spaghetti Carbonara', 4, 35000.00, 20, '{"ekstra_keju": true}'::jsonb),
('French Fries Sea Salt', 5, 18000.00, 60, '{"saus": ["sambal", "mayones"]}'::jsonb);

-- 4. SEED RIWAYAT RESTOCK STOK (DENGAN MANAJER ID)
INSERT INTO restock (id_barang, jumlah_tambah, id_manajer, nama_supplier) VALUES
(1, 50, 1, 'PT Biji Kopi Nusantara'),
(3, 35, 1, 'CV Sirup Caramel Indo'),
(6, 20, 1, 'Bakery Supplier Utama');

-- 5. SEED SAMPLE TRANSAKSI & STRUK DIGITAL (DENGAN KASIR ID)
INSERT INTO transaksi (id_kasir, total_bayar, created_at) VALUES
(2, 47000.00, NOW() - INTERVAL '2 hours'),
(3, 50000.00, NOW() - INTERVAL '30 minutes');

INSERT INTO detail_transaksi (id_transaksi, id_barang, nama_barang, harga_satuan, jumlah, subtotal) VALUES
(1, 1, 'Kopi Susu Gula Aren', 22000.00, 1, 22000.00),
(1, 6, 'Croissant Butter Classic', 25000.00, 1, 25000.00),
(2, 5, 'Chocolate Signature Cold', 25000.00, 2, 50000.00);

INSERT INTO struk (id_transaksi, data_struk, dicetak_at) VALUES
(
    1,
    jsonb_build_object(
        'id_transaksi', 1,
        'kasir', 'Siti Kasir Shift Pagi',
        'tanggal', NOW() - INTERVAL '2 hours',
        'items', '[{"nama_barang":"Kopi Susu Gula Aren","harga_satuan":22000,"jumlah":1,"subtotal":22000},{"nama_barang":"Croissant Butter Classic","harga_satuan":25000,"jumlah":1,"subtotal":25000}]'::jsonb,
        'total_bayar', 47000.00
    ),
    NOW() - INTERVAL '2 hours'
),
(
    2,
    jsonb_build_object(
        'id_transaksi', 2,
        'kasir', 'Rian Kasir Shift Malam',
        'tanggal', NOW() - INTERVAL '30 minutes',
        'items', '[{"nama_barang":"Chocolate Signature Cold","harga_satuan":25000,"jumlah":2,"subtotal":50000}]'::jsonb,
        'total_bayar', 50000.00
    ),
    NOW() - INTERVAL '30 minutes'
);
