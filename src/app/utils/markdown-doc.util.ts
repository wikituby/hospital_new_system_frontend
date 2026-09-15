/**
 * Lightweight Markdown → HTML for in-app documentation (no external dependency).
 */
export function markdownToHtml(source: string): string {
  if (!source) {
    return '';
  }

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const inline = (s: string) => {
    let t = escapeHtml(s);
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return t;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^---+$/.test(line.trim())) {
      out.push('<hr />');
      i++;
      continue;
    }

    if (/^#### (.+)$/.test(line)) {
      out.push(`<h4>${inline(line.replace(/^#### /, ''))}</h4>`);
      i++;
      continue;
    }
    if (/^### (.+)$/.test(line)) {
      out.push(`<h3>${inline(line.replace(/^### /, ''))}</h3>`);
      i++;
      continue;
    }
    if (/^## (.+)$/.test(line)) {
      out.push(`<h2>${inline(line.replace(/^## /, ''))}</h2>`);
      i++;
      continue;
    }
    if (/^# (.+)$/.test(line)) {
      out.push(`<h1>${inline(line.replace(/^# /, ''))}</h1>`);
      i++;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      if (tableRows.length >= 2) {
        const parseRow = (row: string) =>
          row
            .split('|')
            .slice(1, -1)
            .map(c => c.trim());
        const header = parseRow(tableRows[0]);
        const bodyStart = /^\|[\s\-:|]+\|$/.test(tableRows[1].trim()) ? 2 : 1;
        out.push('<table><thead><tr>');
        header.forEach(h => out.push(`<th>${inline(h)}</th>`));
        out.push('</tr></thead><tbody>');
        for (let r = bodyStart; r < tableRows.length; r++) {
          const cells = parseRow(tableRows[r]);
          out.push('<tr>');
          cells.forEach(c => out.push(`<td>${inline(c)}</td>`));
          out.push('</tr>');
        }
        out.push('</tbody></table>');
      }
      continue;
    }

    if (/^```/.test(line.trim())) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++;
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      out.push('</ol>');
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      out.push('<ul>');
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^[-*]\s/, ''))}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^#/.test(lines[i]) && !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i]) && !lines[i].trim().startsWith('|') && !/^```/.test(lines[i].trim())) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}
