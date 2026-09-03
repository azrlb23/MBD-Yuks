# POS Jalur Langit — Database & Backend API

Sistem **Point of Sale (POS)** untuk toko "Jalur Langit", dibangun sebagai proyek akademis mata kuliah **Manajemen Basis Data (MBD)**.

---

## 🛠️ Tech Stack
- **Database Engine**: PostgreSQL 17 (Docker Container)
- **Backend Framework**: Node.js & Express.js (ES Modules, MVC Layered Architecture)
- **Driver**: `pg` (Node-Postgres Connection Pool)
- **Security**: Stored Procedures (`CALL sp_...()`), Triggers, Views, RLS, & Role Privilege

---

## 📁 Struktur Direktori

```
d:\MBD\
├── compose.yaml              # Konfigurasi Docker Compose (PostgreSQL 17)
├── .env                      # Environment Variables
├── package.json              # Express.js Dependencies & Scripts
├── README.md                 # Dokumentasi & Panduan Setup
├── context1.md               # Arsitektur Lengkap & Inventaris DB
├── sql/                      # Skrip SQL PostgreSQL Terstruktur
│   ├── 01_schema.sql         # DDL 7 Tabel, Constraints, & 17 Indexes
│   ├── 02_seed.sql           # Seed Data (User Manajer, Kasir, & Produk)
│   ├── functions/
│   │   └── 01_functions.sql  # 18 Read-Only Functions
│   ├── procedures/
│   │   └── 01_procedures.sql # 14 Stored Procedures (CALL sp_...())
│   ├── triggers/
│   │   └── 01_triggers.sql   # 5 Triggers & Trigger Functions
│   ├── views/
│   │   └── 01_views.sql      # 6 Views
│   └── 07_roles_rls.sql      # Setup PostgreSQL Roles & Policy RLS
└── src/                      # Source Code Backend Express.js
    ├── database/db.js        # Connection Pool pg
    ├── middlewares/          # JWT Verification & Global Error Handler
    ├── services/sp.service.js# DB Service Execution Layer (CALL sp_...())
    ├── controllers/          # Controller Handlers
    ├── routes/               # API Router (/api/v1/...)
    └── app.js                # Server Entrypoint
```

---

## ⚙️ Cara Menjalankan Project

### 1. Jalankan PostgreSQL 17 di Docker Container
```powershell
docker compose up -d
```

### 2. Install Dependensi Node.js
```powershell
npm install
```

### 3. Eksekusi Skrip SQL ke Database Docker (Berurutan)
```powershell
Get-Content sql/01_schema.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
Get-Content sql/02_seed.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
Get-Content sql/views/01_views.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
Get-Content sql/functions/01_functions.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
Get-Content sql/triggers/01_triggers.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
Get-Content sql/procedures/01_procedures.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
Get-Content sql/07_roles_rls.sql | docker exec -i pos_jalur_langit_db psql -U pos_admin -d pos_jalur_langit
```

### 4. Jalankan Server Backend Express.js
```powershell
npm run dev
```
Server akan berjalan di: `http://localhost:3000/api/v1`

---

## 📡 Ringkasan Endpoints API (`/api/v1`)

| Method | Path | Aksek / Role | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | Publik | Login & terbitkan JWT token |
| POST | `/auth/logout` | All User | Logout session |
| GET | `/products` | All User | `CALL sp_GetKatalogProduk()` |
| GET | `/products/:id` | All User | `CALL sp_GetDetailProduk()` |
| GET | `/products/:id/riwayat-harga` | Manajer | `CALL sp_GetRiwayatHarga()` |
| PUT | `/products/:id` | Manajer | `CALL sp_UpdateHargaSpesifikasi()` |
| POST | `/transactions/checkout` | Kasir / All | `CALL sp_CheckoutTransaction()` |
| GET | `/transactions` | All User | `CALL sp_GetTransaksiHarian()` |
| GET | `/transactions/receipt/:id` | All User | `CALL sp_GetDetailStruk()` |
| POST | `/restock` | Manajer | `CALL sp_RestockBarang()` |
| GET | `/restock/history` | Manajer | `CALL sp_GetLaporanRestock()` |
| GET | `/akun` | Manajer | `CALL sp_GetDaftarAkun()` |
| POST | `/akun/kasir` | Manajer | `CALL sp_BuatAkunKasir()` |
| PUT | `/akun/privilege` | Manajer | `CALL sp_AturPrivilege()` |
| DELETE | `/akun/:id` | Manajer | `CALL sp_NonaktifkanAkun()` |
