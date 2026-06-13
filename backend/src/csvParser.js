const fs = require('fs');
const csv = require('csv-parser');

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push({
          caseNumber: row['Case Number']?.trim(),
          technicianName: row['Technician Name']?.trim(),
          customerName: row['Customer Name']?.trim(),
          city: row['City']?.trim(),
          state: row['State/Province']?.trim(),
          zip: row['Zip/Postal Code']?.trim(),
          complaint: row['Customer Complaint']?.trim(),
          woStatus: row['WO Status']?.trim(),
          lineItemStatus: row['LineItem Status']?.trim(),
          createdDate: row['Created Date']?.trim(),
          endDate: row['End Date']?.trim(),
          productName: row['Product Name']?.trim(),
          technicianAssignedDate: row['Technician Assigned Date']?.trim(),
        });
      })
      .on('end', () => {
        const pending = results.filter(
          (r) =>
            r.technicianName &&
            r.lineItemStatus !== 'Completed' &&
            r.woStatus !== 'Resolved'
        );
        resolve(pending);
      })
      .on('error', reject);
  });
}

module.exports = { parseCSV };