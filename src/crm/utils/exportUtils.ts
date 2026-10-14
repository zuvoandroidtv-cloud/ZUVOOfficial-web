/**
 * ZUVO TV CRM Data Export Utilities
 * Provides safe UTF-8 CSV and XML/Excel Spreadsheet exporting with proper escaping.
 */

export interface HeaderConfig {
  key: string;
  label: string;
}

/**
 * Escapes a cell value for CSV formatting.
 */
// Sensitive keys that must never be exported in reports
const SENSITIVE_EXPORT_KEYS = new Set([
  'token',
  'raw_token',
  'token_hash',
  'survey_token',
  'customer_confirmation_otp',
  'otp',
  'password',
  'secret',
  'customer_signature_data'
]);

/**
 * Escapes a cell value for CSV formatting and mitigates spreadsheet formula injection.
 */
const escapeCSVValue = (val: any): string => {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Formula injection defense: if non-numeric string begins with =, +, -, @, \t, or \r
  if (typeof val === 'string' && /^[=+\-@\t\r]/.test(str.trim())) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

const escapeXML = (str: string): string => {
  let val = String(str);
  // Formula injection defense for XML/Spreadsheet cells
  if (/^[=+\-@\t\r]/.test(val.trim())) {
    val = `'${val}`;
  }
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Exports data to CSV file with security headers and formula injection mitigation.
 * Supports both:
 * 1. exportToCSV(filename, headers, rows)
 * 2. exportToCSV(objectRows, headerConfigs, filename)
 */
export const exportToCSV = (
  arg1: any,
  arg2: any,
  arg3?: any
) => {
  let filename = 'export';
  let headers: string[] = [];
  let rows: (string | number | boolean | null | undefined)[][] = [];

  if (typeof arg1 === 'string' && Array.isArray(arg2)) {
    filename = arg1;
    headers = arg2;
    rows = arg3 || [];
  } else if (Array.isArray(arg1) && Array.isArray(arg2)) {
    filename = arg3 || 'export';
    // Filter out sensitive columns
    const safeHeaderConfigs = arg2.filter((h: any) => {
      const key = typeof h === 'string' ? h.toLowerCase() : (h.key || '').toLowerCase();
      return !SENSITIVE_EXPORT_KEYS.has(key);
    });
    headers = safeHeaderConfigs.map((h: any) => typeof h === 'string' ? h : h.label);
    const keys = safeHeaderConfigs.map((h: any) => typeof h === 'string' ? h : h.key);
    rows = arg1.map((item: any) => keys.map((k: string) => item[k]));
  }

  const headerLine = headers.map(escapeCSVValue).join(',');
  const rowLines = rows.map((row) => row.map(escapeCSVValue).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanName = filename.endsWith('.csv') ? filename : `${filename.replace(/\s+/g, '_')}.csv`;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Exports data using Microsoft Office XML Spreadsheet format (SpreadsheetML / Excel 2003 XML).
 * Note: This produces an XML-based spreadsheet readable directly by Microsoft Excel, LibreOffice,
 * and Google Sheets, rather than a zipped binary OOXML (.xlsx) package.
 * Supports both:
 * 1. exportToExcel(filename, sheetName, headers, rows)
 * 2. exportToExcel(objectRows, headerConfigs, filename, sheetName)
 */
export const exportToExcel = async (
  arg1: any,
  arg2: any,
  arg3?: any,
  arg4?: any
) => {
  let filename = 'export';
  let sheetName = 'Sheet1';
  let headers: string[] = [];
  let rows: (string | number | boolean | null | undefined)[][] = [];

  if (typeof arg1 === 'string' && typeof arg2 === 'string') {
    filename = arg1;
    sheetName = arg2;
    headers = arg3 || [];
    rows = arg4 || [];
  } else if (Array.isArray(arg1) && Array.isArray(arg2)) {
    filename = arg3 || 'export';
    sheetName = arg4 || 'Sheet1';
    const safeHeaderConfigs = arg2.filter((h: any) => {
      const key = typeof h === 'string' ? h.toLowerCase() : (h.key || '').toLowerCase();
      return !SENSITIVE_EXPORT_KEYS.has(key);
    });
    headers = safeHeaderConfigs.map((h: any) => typeof h === 'string' ? h : h.label);
    const keys = safeHeaderConfigs.map((h: any) => typeof h === 'string' ? h : h.key);
    rows = arg1.map((item: any) => keys.map((k: string) => item[k]));
  }

  const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF" />
      <Interior ss:Color="#2563EB" ss:Pattern="Solid" />
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
    </Style>
    <Style ss:ID="Default">
      <Alignment ss:Vertical="Center" />
    </Style>
  </Styles>
  <Worksheet ss:Name="${sheetName.replace(/[\\/?*\[\]]/g, '')}">
    <Table>`;

  const xmlHeaders = `      <Row ss:StyleID="Header">\n` +
    headers.map((h) => `        <Cell><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`).join('\n') +
    `\n      </Row>`;

  const xmlRows = rows
    .map((row) => {
      const cells = row
        .map((val) => {
          if (val === null || val === undefined) {
            return `        <Cell><Data ss:Type="String"></Data></Cell>`;
          }
          if (typeof val === 'number') {
            return `        <Cell><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          if (typeof val === 'boolean') {
            return `        <Cell><Data ss:Type="String">${val ? 'TRUE' : 'FALSE'}</Data></Cell>`;
          }
          return `        <Cell><Data ss:Type="String">${escapeXML(String(val))}</Data></Cell>`;
        })
        .join('\n');
      return `      <Row ss:StyleID="Default">\n${cells}\n      </Row>`;
    })
    .join('\n');

  const xmlFooter = `
    </Table>
  </Worksheet>
</Workbook>`;

  const fullXML = xmlHeader + '\n' + xmlHeaders + '\n' + xmlRows + xmlFooter;
  const blob = new Blob([fullXML], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const baseName = filename.replace(/\.(xlsx|xml)$/i, '').replace(/\s+/g, '_');
  const cleanName = `${baseName}.xml`;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
