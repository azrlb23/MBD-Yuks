const fs = require('fs');

let data = JSON.parse(fs.readFileSync('postman_collection.json', 'utf8'));

// Hapus Nonaktifkan dari Manajemen Akun
const akunFolder = data.item.find(i => i.name.includes('Akun'));
if (akunFolder) {
  akunFolder.item = akunFolder.item.filter(i => !i.name.includes('Nonaktifkan'));
}

// Hapus Nonaktifkan dari Manajemen Barang
const brgFolder = data.item.find(i => i.name.includes('Katalog'));
if (brgFolder) {
  brgFolder.item = brgFolder.item.filter(i => !i.name.includes('Nonaktifkan'));
}

// Tambahkan folder Manajemen Sistem
const sistemFolder = {
  name: 'Manajemen Sistem',
  item: [
    {
      name: 'Universal Toggle Status (sp_toggle_status - Manajer)',
      request: {
        method: 'PATCH',
        header: [
          { key: 'Authorization', value: 'Bearer {{token}}', type: 'text' }
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify({ entitas: 'akun', id: 2, is_active: false }, null, 4),
          options: { raw: { language: 'json' } }
        },
        url: {
          raw: '{{baseUrl}}/sistem/status',
          host: ['{{baseUrl}}'],
          path: ['sistem', 'status']
        }
      }
    }
  ]
};

// Cek apakah sudah ada folder Sistem
const existingSistem = data.item.findIndex(i => i.name === 'Manajemen Sistem');
if (existingSistem >= 0) {
    data.item[existingSistem] = sistemFolder;
} else {
    data.item.push(sistemFolder);
}

fs.writeFileSync('postman_collection.json', JSON.stringify(data, null, 2));
console.log('Postman collection updated');
