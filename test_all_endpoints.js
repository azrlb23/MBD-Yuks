const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 AUTOMATED COMPREHENSIVE ENDPOINT TEST SUITE FOR POS API');
  console.log('===========================================================');

  let passedCount = 0;
  let failedCount = 0;
  let managerToken = '';
  let cashierToken = '';

  async function testEndpoint(name, fetchFn, expectedStatus = 200, checkFn = () => true) {
    try {
      const res = await fetchFn();
      const body = await res.json();
      const statusOk = res.status === expectedStatus;
      const customOk = checkFn(body, res);

      if (statusOk && customOk) {
        console.log(`✅ [PASS] ${name} (Status: ${res.status})`);
        passedCount++;
        return { ok: true, status: res.status, body };
      } else {
        console.log(`❌ [FAIL] ${name} (Status: ${res.status}, Expected: ${expectedStatus})`);
        console.log('   Response body:', JSON.stringify(body, null, 2));
        failedCount++;
        return { ok: false, status: res.status, body };
      }
    } catch (err) {
      console.log(`❌ [ERROR] ${name}: ${err.message}`);
      failedCount++;
      return { ok: false, error: err };
    }
  }

  // 1. Health Check
  await testEndpoint('1. GET / - Root Health Check', () =>
    fetch(`${BASE_URL}/`), 200, (b) => b.status === 'online'
  );

  // 2. Auth - Login Manager
  const mgrLogin = await testEndpoint('2. POST /api/v1/auth/login - Manager Login', () =>
    fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'manajer1', password: 'manajer123' })
    }), 200, (b) => b.success && b.data.token
  );
  if (mgrLogin.ok) {
    managerToken = mgrLogin.body.data.token;
  }

  // 3. Auth - Login Cashier
  const kasirLogin = await testEndpoint('3. POST /api/v1/auth/login - Cashier Login', () =>
    fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir1', password: 'kasir123' })
    }), 200, (b) => b.success && b.data.token
  );
  if (kasirLogin.ok) {
    cashierToken = kasirLogin.body.data.token;
  }

  // 4. Akun - GET /api/v1/akun (Manager)
  await testEndpoint('4. GET /api/v1/akun - List All Accounts (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/akun`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data)
  );

  // 5. Akun - POST /api/v1/akun (Create New Manager Account)
  const testMgrName = `mgr_test_${Date.now().toString().slice(-4)}`;
  await testEndpoint('5. POST /api/v1/akun - Create New Manager Account', () =>
    fetch(`${BASE_URL}/api/v1/akun`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        username: testMgrName,
        password: 'password123',
        nama_lengkap: 'Manajer Cabang Baru',
        peran: 'manajer'
      })
    }), 201, (b) => b.success
  );

  // 6. Akun - POST /api/v1/akun/kasir (Create New Cashier Account)
  const testKasirName = `kasir_test_${Date.now().toString().slice(-4)}`;
  await testEndpoint('6. POST /api/v1/akun/kasir - Create New Cashier Account', () =>
    fetch(`${BASE_URL}/api/v1/akun/kasir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        username: testKasirName,
        password: 'password123',
        nama_lengkap: 'Kasir Shift Pagi Baru'
      })
    }), 201, (b) => b.success
  );

  // 7. Barang - GET /api/v1/barang (Katalog)
  await testEndpoint('7. GET /api/v1/barang - Get Menu Catalog', () =>
    fetch(`${BASE_URL}/api/v1/barang`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data) && b.data.length > 0
  );

  // 8. Barang - GET /api/v1/barang/:id (Detail Barang)
  await testEndpoint('8. GET /api/v1/barang/1 - Get Product Detail ID=1', () =>
    fetch(`${BASE_URL}/api/v1/barang/1`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && b.data.id_barang === 1
  );

  // 9. Barang - PUT /api/v1/barang/:id (Update Harga & Spek - Manager)
  await testEndpoint('9. PUT /api/v1/barang/1 - Update Price/Spec (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/barang/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        harga: 23000.00,
        spesifikasi: { suhu: ['dingin', 'panas'], promo: 'Diskon 10%' }
      })
    }), 200, (b) => b.success
  );

  // 10. Restock - POST /api/v1/restock (Restock Stok - Manager)
  await testEndpoint('10. POST /api/v1/restock - Restock Menu Item (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/restock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        id_barang: 1,
        jumlah_tambah: 10,
        nama_supplier: 'PT Supplier Kopi Mantap'
      })
    }), 200, (b) => b.success
  );

  // 11. Restock - GET /api/v1/restock/riwayat (Laporan Restock - Manager)
  await testEndpoint('11. GET /api/v1/restock/riwayat - Get Restock Report', () =>
    fetch(`${BASE_URL}/api/v1/restock/riwayat`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data)
  );

  // 12. Transaksi - POST /api/v1/transaksi/checkout (Checkout Kasir)
  const checkoutRes = await testEndpoint('12. POST /api/v1/transaksi/checkout - Cashier Checkout', () =>
    fetch(`${BASE_URL}/api/v1/transaksi/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        items: [
          { id_barang: 1, jumlah: 2 },
          { id_barang: 6, jumlah: 1 }
        ]
      })
    }), 201, (b) => b.success && b.data.id_transaksi
  );

  const createdTrxId = checkoutRes.body?.data?.id_transaksi || 1;

  // 13. Transaksi - GET /api/v1/transaksi (Transaksi Harian)
  await testEndpoint('13. GET /api/v1/transaksi - Get Daily Transactions', () =>
    fetch(`${BASE_URL}/api/v1/transaksi`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data)
  );

  // 14. Transaksi - GET /api/v1/transaksi/struk/:id (Detail Struk Digital)
  await testEndpoint(`14. GET /api/v1/transaksi/struk/${createdTrxId} - Get Receipt Detail`, () =>
    fetch(`${BASE_URL}/api/v1/transaksi/struk/${createdTrxId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && b.data
  );

  // 15. Sistem - PATCH /api/v1/sistem/status (Toggle Status Entity)
  await testEndpoint('15. PATCH /api/v1/sistem/status - Deactivate Account (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/sistem/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        entitas: 'akun',
        id: 3,
        is_active: false
      })
    }), 200, (b) => b.success
  );

  // 15b. Self-Deactivation Protection Test (Expecting Failure)
  await testEndpoint('15b. Security Test: Manager trying to deactivate OWN account (Expecting Error)', () =>
    fetch(`${BASE_URL}/api/v1/sistem/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        entitas: 'akun',
        id: 1,
        is_active: false
      })
    }), 500, (b) => b.success === false
  );

  // 16. Security Role Enforcement Test: Cashier trying manager-only endpoint
  await testEndpoint('16. Security Test: Cashier trying Restock (Expecting 403)', () =>
    fetch(`${BASE_URL}/api/v1/restock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({ id_barang: 1, jumlah_tambah: 5 })
    }), 403, (b) => b.success === false
  );

  // 17. Security Role Enforcement Test: Manager trying cashier-only checkout
  await testEndpoint('17. Security Test: Manager trying Checkout (Expecting 403)', () =>
    fetch(`${BASE_URL}/api/v1/transaksi/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        items: [{ id_barang: 1, jumlah: 1 }]
      })
    }), 403, (b) => b.success === false
  );

  // 18. Auth - Logout Manager
  await testEndpoint('18. POST /api/v1/auth/logout - Logout Manager User', () =>
    fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    }), 200, (b) => b.success
  );

  console.log('===========================================================');
  console.log(`📊 TEST RESULTS SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('===========================================================');
}

runTests();
