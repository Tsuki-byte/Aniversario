const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const fileEmail = '../EMAIL CLIENTES.xlsx';
const fileClientes = '../LISTADO CLIENTES 2025 ++++++.xlsx';

// 1. Read Emails
const emailsMap = new Map();
if (fs.existsSync(fileEmail)) {
  const wb = XLSX.readFile(fileEmail);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
  data.forEach(row => {
    if (row.length > 2 && row[0]) {
      const id2 = String(row[0]).trim();
      emailsMap.set(id2, {
        nombre_email: String(row[1] || '').trim(),
        email: String(row[2] || '').trim()
      });
    }
  });
}

// 2. Read Clientes
const clientesMap = new Map();
if (fs.existsSync(fileClientes)) {
  const wb = XLSX.readFile(fileClientes);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
  data.forEach(row => {
    if (row.length > 3 && row[1] && String(row[1]).match(/^\d+$/)) {
      const seleccion = String(row[0] || '').trim() || 'NO';
      const id1 = String(row[1]).trim();
      const id2 = String(row[2]).trim();
      const nombre = String(row[3]).trim();
      
      clientesMap.set(id2, {
        seleccion_preliminar: seleccion.toLowerCase() === 'x' ? 'SI' : seleccion,
        id1,
        id2,
        nombre,
        direccion_1: String(row[4] || '').trim(),
        direccion_2: String(row[5] || '').trim(),
        ciudad: String(row[6] || '').trim(),
        aux_1_prevision: String(row[7] || '').trim(),
        aux_2_hotel: String(row[8] || '').trim(),
        codigo_postal: String(row[9] || '').trim(),
        facturacion_anual: row[10] || 0,
        nif: String(row[11] || '').trim(),
        observaciones: String(row[12] || '').trim(),
        tipo: 'Cliente'
      });
    }
  });
}

// 3. Full Outer Join
const allIds = new Set([...emailsMap.keys(), ...clientesMap.keys()]);
const combined = [];
let counter = 1000;

const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

for (const id2 of allIds) {
  const cData = clientesMap.get(id2) || {};
  const eData = emailsMap.get(id2) || {};
  
  let dudoso = 'NO';
  const nameC = cData.nombre || '';
  const nameE = eData.nombre_email || '';
  
  if (nameC && nameE) {
    const normC = normalize(nameC);
    const normE = normalize(nameE);
    
    // Comparación simple de coincidencia
    const wordsC = normC.substring(0, 5);
    const wordsE = normE.substring(0, 5);
    
    if (!normC.includes(normE) && !normE.includes(normC) && wordsC !== wordsE) {
      dudoso = 'SI'; 
    }
  }

  // Código de acceso fácil: ANIV-id2 (ej. ANIV-1578)
  const codigo_acceso = (id2 && id2 !== 'undefined') ? `ANIV-${id2}` : `ANIV-${counter++}`;

  combined.push({
    codigo_acceso,
    emparejamiento_dudoso: dudoso,
    seleccion_preliminar: cData.seleccion_preliminar || 'NO',
    id1: cData.id1 || '',
    id2: id2 !== 'undefined' ? id2 : '',
    nombre: cData.nombre || eData.nombre_email || 'SIN NOMBRE',
    nombre_en_email: eData.nombre_email || '', 
    email: eData.email || '',
    direccion_1: cData.direccion_1 || '',
    direccion_2: cData.direccion_2 || '',
    ciudad: cData.ciudad || '',
    codigo_postal: cData.codigo_postal || '',
    aux_1_prevision: cData.aux_1_prevision || '',
    aux_2_hotel: cData.aux_2_hotel || '',
    facturacion_anual: cData.facturacion_anual || 0,
    nif: cData.nif || '',
    observaciones: cData.observaciones || '',
    tipo: 'Cliente'
  });
}

// 4. Generate CSV
const headers = Object.keys(combined[0]);
let csvString = headers.join(',') + '\n';

combined.forEach(row => {
  const line = headers.map(h => {
    let val = row[h] !== undefined ? row[h] : '';
    if (String(val).includes(',') || String(val).includes('"')) {
      val = `"${String(val).replace(/"/g, '""')}"`;
    }
    return val;
  });
  csvString += line.join(',') + '\n';
});

fs.writeFileSync('../clientes_unificados.csv', csvString);
console.log('CSV de clientes creado con', combined.length, 'registros.');
