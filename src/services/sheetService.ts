import { SaleRecord, CustomField } from '../types';

export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
}

export const createSpreadsheet = async (accessToken: string, title: string): Promise<string> => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create spreadsheet: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  return data.spreadsheetId;
};

export const prepareHeaders = (itemNames: string[], customFields: CustomField[]) => {
  const headers = [
    "ID",
    "Sr. No.",
    "Date",
    "Student Name",
    "Class",
    "General Notes"
  ];

  itemNames.forEach(itemName => {
    headers.push(`${itemName}_Size`);
    headers.push(`${itemName}_Qty`);
    headers.push(`${itemName}_Price`);
  });

  headers.push("Total Qty");
  headers.push("Total Amount");
  headers.push("Discount %");
  headers.push("Payment Mode");
  headers.push("Paid Amount");
  headers.push("Balance Due");
  headers.push("Payment Date");

  customFields.forEach(f => {
    headers.push(f.label);
  });

  return headers;
};

export const recordToRow = (r: SaleRecord, itemNames: string[], customFields: CustomField[]) => {
  const totalQty = r.items.reduce((s, i) => s + i.qty, 0);
  const paidNum = r.paidAmount || 0;
  const balance = r.totalAmount - paidNum;

  const row: any[] = [
    r.id,
    r.srNo,
    r.date,
    r.name,
    r.studentClass,
    r.notes || ""
  ];

  itemNames.forEach(itemName => {
    const lineItem = r.items.find((i: any) => i.item === itemName);
    row.push(lineItem ? lineItem.size : "");
    row.push(lineItem ? lineItem.qty : 0);
    row.push(lineItem ? lineItem.qty * lineItem.rate : 0);
  });

  row.push(totalQty);
  row.push(r.totalAmount);
  row.push(r.discountPercent || 0);
  row.push(r.paymentMode);
  row.push(paidNum);
  row.push(balance);
  row.push(r.paymentDate || "");

  customFields.forEach(f => {
    row.push(r.customData?.[f.id] || "");
  });

  return row;
};

export const setupSheetHeaders = async (accessToken: string, spreadsheetId: string, headers: string[]) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [headers],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to setup headers: ${error.message || response.statusText}`);
  }

  // Format headers and add alternating row colors
  const sheetMetadata = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
     headers: { 'Authorization': `Bearer ${accessToken}` },
  }).then(res => res.json());
  const sheetId = sheetMetadata.sheets[0].properties.sheetId;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.06, green: 0.1, blue: 0.16 }, // Slate-900 approx
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                horizontalAlignment: "CENTER"
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
          }
        },
        {
          addBanding: {
            bandingProperties: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: headers.length },
              rowProperties: {
                headerColor: { red: 0.95, green: 0.95, blue: 0.95 },
                firstBandColor: { red: 1, green: 1, blue: 1 },
                secondBandColor: { red: 0.98, green: 0.98, blue: 0.98 }
              }
            }
          }
        }
      ]
    })
  });
};

export const appendRecords = async (accessToken: string, spreadsheetId: string, rows: any[][]) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to append records: ${error.message || response.statusText}`);
  }
};

export const updateRecordInSheet = async (accessToken: string, spreadsheetId: string, recordId: string, newRow: any[]) => {
  // First, find the row index by searching for the record ID in Column A
  const getResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!getResponse.ok) throw new Error("Failed to fetch IDs from sheet");
  const data = await getResponse.json();
  const rowIndex = data.values ? data.values.findIndex((v: any[]) => v[0] === recordId) : -1;

  if (rowIndex === -1) {
    // If not found, just append it
    await appendRecords(accessToken, spreadsheetId, [newRow]);
    return;
  }

  const range = `Sheet1!A${rowIndex + 1}`;
  const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [newRow],
    }),
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    throw new Error(`Failed to update record: ${error.message || updateResponse.statusText}`);
  }
};

export const deleteRecordInSheet = async (accessToken: string, spreadsheetId: string, recordId: string) => {
  // Finding the row is necessary
  const getResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!getResponse.ok) throw new Error("Failed to fetch IDs from sheet");
  const data = await getResponse.json();
  const rowIndex = data.values ? data.values.findIndex((v: any[]) => v[0] === recordId) : -1;

  if (rowIndex === -1) return;

  // We can't easily "delete" a row via the values API without shifting, 
  // but we can clear it. To truly delete, we need the batchUpdate API.
  const sheetMetadata = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
     headers: { 'Authorization': `Bearer ${accessToken}` },
  }).then(res => res.json());
  
  const sheetId = sheetMetadata.sheets[0].properties.sheetId;

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to delete record: ${error.message || response.statusText}`);
  }
};

export const clearSheet = async (accessToken: string, spreadsheetId: string) => {
    // Clear all values except headers? Or just delete all rows below 1.
    const getResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!getResponse.ok) return;
    const data = await getResponse.json();
    const rowCount = data.values ? data.values.length : 0;
    if (rowCount <= 1) return;

    const sheetMetadata = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
     }).then(res => res.json());
     
     const sheetId = sheetMetadata.sheets[0].properties.sheetId;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: "ROWS",
                            startIndex: 1,
                            endIndex: rowCount
                        }
                    }
                }
            ]
        }),
    });
};
