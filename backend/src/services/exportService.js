/**
 * Report Exporter Service (JSON & CSV)
 */

export function exportToJson(auditDoc) {
  return JSON.stringify(auditDoc, null, 2);
}

function escapeCsvCell(cell) {
  if (cell === null || cell === undefined) return '""';
  const str = String(cell).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportToCsv(auditDoc) {
  const headers = [
    'Category',
    'Severity',
    'Title',
    'Description',
    'Selector',
    'Evidence',
    'Recommendation'
  ];

  const rows = [headers.map(escapeCsvCell).join(',')];

  if (auditDoc.findings && Array.isArray(auditDoc.findings)) {
    for (const f of auditDoc.findings) {
      const row = [
        f.category || '',
        f.severity || '',
        f.title || '',
        f.description || '',
        f.selector || '',
        f.evidence || '',
        f.recommendation || ''
      ];
      rows.push(row.map(escapeCsvCell).join(','));
    }
  }

  // Also include checked links as a secondary section or standalone
  if (auditDoc.checkedLinks && auditDoc.checkedLinks.length > 0) {
    rows.push('');
    rows.push(['--- CHECKED HYPERLINKS ---', '', '', '', '', '', ''].map(escapeCsvCell).join(','));
    rows.push(['Target URL', 'HTTP Status', 'Status Text', 'Health', 'Response Time (ms)', 'Error', 'Anchor Snippet'].map(escapeCsvCell).join(','));

    for (const link of auditDoc.checkedLinks) {
      const linkRow = [
        link.url,
        link.status || 'N/A',
        link.statusText || '',
        link.ok ? 'HEALTHY' : 'BROKEN',
        link.durationMs || 0,
        link.error || '',
        link.sourceSnippet || ''
      ];
      rows.push(linkRow.map(escapeCsvCell).join(','));
    }
  }

  return rows.join('\r\n');
}
