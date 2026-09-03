const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 AUTOMATED COMPREHENSIVE ENDPOINT TEST SUITE FOR POS API');
  console.log('===========================================================');

  let passedCount = 0;
  let failedCount = 0;
  let managerToken = '';
  let cashierToken = '';
  let managerId = null;
  let createdKasirId = null;

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
    managerId = mgrLogin.body.data.id_pengguna;
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

  // 4. Auth - Logout
  await testEndpoint('4. POST /api/v1/auth/logout - Logout User', () =>
    fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    }), 200, (b) => b.success
  );

  // 5. Akun - GET /api/v1/akun (Manager)
  const akunRes = await testEndpoint('5. GET /api/v1/akun - List All Accounts (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/akun`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data)
  );

  // 6. Akun - POST /api/v1/akun/kasir (Manager)
  const testKasirName = `kasir_test_${Date.now().toString().slice(-4)}`;
  const createAkunRes = await testEndpoint('6. POST /api/v1/akun/kasir - Create Cashier (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/akun/kasir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        username: testKasirName,
        password: 'password123',
        nama_lengkap: 'Kasir Test Auto'
      })
    }), 201, (b) => b.success
  );

  // Get ID of newly created cashier if list refreshed
  if (createAkunRes.ok) {
    const freshAkunList = await fetch(`${BASE_URL}/api/v1/akun`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    }).then(r => r.json());
    const newAccount = freshAkunList.data?.find(a => a.username === testKasirName);
    if (newAccount) {
      createdKasirId = newAccount.id_pengguna;
    }
  }

  // 7. Akun - PUT /api/v1/akun/privilege (Manager)
  await testEndpoint('7. PUT /api/v1/akun/privilege - Configure Privilege (Manager)', () =>
    fetch(`${BASE_URL}/api/v1/akun/privilege`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        username: testKasirName,
        aksi: 'GRANT',
        objek: 'EXECUTE ON PROCEDURE sp_checkout_transaksi'
      })
    }), 200, (b) => b.success
  );

  // 8. Akun - DELETE /api/v1/akun/:id (Manager)
  if (createdKasirId) {
    await testEndpoint(`8. DELETE /api/v1/akun/${createdKasirId} - Deactivate Account (Manager)`, () =>
      fetch(`${BASE_URL}/api/v1/akun/${createdKasirId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managerToken}` }
      }), 200, (b) => b.success
    );
  }

  // 9. Barang - GET /api/v1/barang (Katalog)
  await testEndpoint('9. GET /api/v1/barang - Get Menu Catalog', () =>
    fetch(`${BASE_URL}/api/v1/barang`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data) && b.data.length > 0
  );

  // 10. Barang - GET /api/v1/barang/:id (Detail Barang)
  await testEndpoint('10. GET /api/v1/barang/1 - Get Product Detail ID=1', () =>
    fetch(`${BASE_URL}/api/v1/barang/1`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && b.data.id_barang === 1
  );

  // 11. Barang - PUT /api/v1/barang/:id (Update Harga & Spek - Manager)
  await testEndpoint('11. PUT /api/v1/barang/1 - Update Price/Spec (Manager)', () =>
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

  // 12. Restock - POST /api/v1/restock (Restock Stok - Manager)
  await testEndpoint('12. POST /api/v1/restock - Restock Menu Item (Manager)', () =>
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

  // 13. Restock - GET /api/v1/restock/riwayat (Laporan Restock - Manager)
  await testEndpoint('13. GET /api/v1/restock/riwayat - Get Restock Report', () =>
    fetch(`${BASE_URL}/api/v1/restock/riwayat`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data)
  );

  // 14. Transaksi - POST /api/v1/transaksi/checkout (Checkout Kasir)
  const checkoutRes = await testEndpoint('14. POST /api/v1/transaksi/checkout - Cashier Checkout', () =>
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

  // 15. Transaksi - GET /api/v1/transaksi (Transaksi Harian)
  await testEndpoint('15. GET /api/v1/transaksi - Get Daily Transactions', () =>
    fetch(`${BASE_URL}/api/v1/transaksi`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && Array.isArray(b.data)
  );

  // 16. Transaksi - GET /api/v1/transaksi/struk/:id (Detail Struk Digital)
  await testEndpoint(`16. GET /api/v1/transaksi/struk/${createdTrxId} - Get Receipt Detail`, () =>
    fetch(`${BASE_URL}/api/v1/transaksi/struk/${createdTrxId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` }
    }), 200, (b) => b.success && b.data
  );

  // 17. Security Role Enforcement Test: Cashier trying manager-only endpoint
  await testEndpoint('17. Security Test: Cashier trying Restock (Expecting 403)', () =>
    fetch(`${BASE_URL}/api/v1/restock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({ id_barang: 1, jumlah_tambah: 5 })
    }), 403, (b) => b.success === false
  );

  // 18. Security Role Enforcement Test: Manager trying cashier-only checkout
  await testEndpoint('18. Security Test: Manager trying Checkout (Expecting 403)', () =>
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

  console.log('===========================================================');
  console.log(`📊 TEST RESULTS SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('===========================================================');
}

runTests();
