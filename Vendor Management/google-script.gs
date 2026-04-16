// ============================================================
// JAINCO PVT LTD — VENDOR MANAGEMENT SYSTEM
// Google Apps Script Backend
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Paste this entire file, replacing default code
// 4. Save as "Jainco VMS Backend"
// 5. Deploy > New Deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Copy the deployment URL and paste in index.html CONFIG
// ============================================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Sheet names
const SHEETS = {
  vendors: 'Vendors',
  invoices: 'Invoices',
  payments: 'Payments',
  users: 'Users'
};

// Headers for each sheet
const HEADERS = {
  vendors: ['VendorID','Name','Category','GSTNo','ContactPerson','Phone','Email','City','State','Status','JoinDate','BankAccount','IFSC','PaymentTerms'],
  invoices: ['InvoiceNo','VendorID','VendorName','InvoiceDate','DueDate','Items','Amount','GSTAmount','TotalAmount','Status','PaidDate','PaymentRef'],
  payments: ['PaymentID','VendorID','InvoiceRef','Amount','PaymentMode','BankRef','PaymentDate','ProcessedBy','Remarks'],
  users: ['UserID','Name','Email','Role','Status','LastLogin','Department']
};

// ─── CORS Helper ────────────────────────────────────────────
function setCORSHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── GET Handler ────────────────────────────────────────────
function doGet(e) {
  try {
    const sheet = (e.parameter.sheet || 'vendors').toLowerCase();
    const sheetName = SHEETS[sheet];

    if (!sheetName) {
      return setCORSHeaders(ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Invalid sheet name' })
      ));
    }

    const data = getSheetData(sheetName);
    return setCORSHeaders(ContentService.createTextOutput(
      JSON.stringify({ success: true, sheet: sheet, data: data, count: data.length })
    ));
  } catch (err) {
    return setCORSHeaders(ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ));
  }
}

// ─── POST Handler ───────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, sheet, data, rowId } = body;

    const sheetName = SHEETS[sheet];
    if (!sheetName) {
      return setCORSHeaders(ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Invalid sheet name' })
      ));
    }

    let result;
    switch (action) {
      case 'create':
        result = createRow(sheetName, data, sheet);
        break;
      case 'update':
        result = updateRow(sheetName, rowId, data, sheet);
        break;
      case 'delete':
        result = deleteRow(sheetName, rowId, sheet);
        break;
      case 'bulkCreate':
        result = bulkCreate(sheetName, data, sheet);
        break;
      default:
        return setCORSHeaders(ContentService.createTextOutput(
          JSON.stringify({ success: false, error: 'Invalid action' })
        ));
    }

    return setCORSHeaders(ContentService.createTextOutput(
      JSON.stringify({ success: true, result: result })
    ));
  } catch (err) {
    return setCORSHeaders(ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ));
  }
}

// ─── Get Sheet Data ──────────────────────────────────────────
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = initializeSheet(ss, sheetName);
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1).map((row, index) => {
    const obj = { _rowIndex: index + 2 };
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ─── Create Row ──────────────────────────────────────────────
function createRow(sheetName, data, sheetKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = initializeSheet(ss, sheetName);

  const headers = HEADERS[sheetKey];
  const row = headers.map(h => data[h] || '');
  sheet.appendRow(row);
  return { message: 'Row created successfully', data: data };
}

// ─── Update Row ──────────────────────────────────────────────
function updateRow(sheetName, rowId, data, sheetKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  const headers = HEADERS[sheetKey];
  const allData = sheet.getDataRange().getValues();
  const idCol = headers[0];
  const idColIndex = 0;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idColIndex] == rowId) {
      const row = headers.map(h => data[h] !== undefined ? data[h] : allData[i][headers.indexOf(h)]);
      sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { message: 'Row updated successfully', rowId: rowId };
    }
  }
  throw new Error('Row not found: ' + rowId);
}

// ─── Delete Row ──────────────────────────────────────────────
function deleteRow(sheetName, rowId, sheetKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found');

  const headers = HEADERS[sheetKey];
  const allData = sheet.getDataRange().getValues();

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] == rowId) {
      sheet.deleteRow(i + 1);
      return { message: 'Row deleted successfully', rowId: rowId };
    }
  }
  throw new Error('Row not found: ' + rowId);
}

// ─── Bulk Create ─────────────────────────────────────────────
function bulkCreate(sheetName, dataArray, sheetKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = initializeSheet(ss, sheetName);

  const headers = HEADERS[sheetKey];
  const rows = dataArray.map(data => headers.map(h => data[h] || ''));
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { message: `${rows.length} rows created`, count: rows.length };
}

// ─── Initialize Sheet with Headers ──────────────────────────
function initializeSheet(ss, sheetName) {
  const sheet = ss.insertSheet(sheetName);
  const sheetKey = Object.keys(SHEETS).find(k => SHEETS[k] === sheetName);
  if (sheetKey && HEADERS[sheetKey]) {
    sheet.getRange(1, 1, 1, HEADERS[sheetKey].length).setValues([HEADERS[sheetKey]]);
    sheet.getRange(1, 1, 1, HEADERS[sheetKey].length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ─── One-time Setup Function ─────────────────────────────────
// Run this manually once after deployment to set up all sheets
function setupAllSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEETS).forEach(key => {
    let sheet = ss.getSheetByName(SHEETS[key]);
    if (!sheet) {
      sheet = initializeSheet(ss, SHEETS[key]);
      Logger.log('Created sheet: ' + SHEETS[key]);
    } else {
      Logger.log('Sheet already exists: ' + SHEETS[key]);
    }
  });
  SpreadsheetApp.getUi().alert('All sheets initialized successfully!');
}

// ─── Send Email Reminder ─────────────────────────────────────
function sendPaymentReminder(vendorEmail, vendorName, invoiceNo, amount, dueDate) {
  const subject = `Payment Reminder - Invoice ${invoiceNo} | Jainco Pvt Ltd`;
  const body = `
Dear ${vendorName},

This is a friendly reminder that the following invoice is due for payment:

Invoice No: ${invoiceNo}
Amount Due: ₹${amount.toLocaleString('en-IN')}
Due Date: ${dueDate}

Please process the payment at your earliest convenience.

For any queries, please contact our accounts team.

Best regards,
Accounts Team
Jainco Pvt Ltd
  `;
  MailApp.sendEmail(vendorEmail, subject, body);
  return { message: 'Reminder sent to ' + vendorEmail };
}
