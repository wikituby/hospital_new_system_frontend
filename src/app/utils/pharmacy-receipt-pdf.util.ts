import jsPDF from 'jspdf';
import { formatPharmacyMoney, PharmacyReceiptLine } from './pharmacy-prescription-sale.util';

export interface PharmacyReceiptPdfData {
  saleNo: string;
  saleDateLabel: string;
  saleTimeLabel: string;
  facilityName: string;
  patientName?: string;
  receivedBy: string;
  paymentMethod: string;
  notes: string;
  includePrescribing: boolean;
  lines: PharmacyReceiptLine[];
  subtotal: number;
  amountReceived: number;
  changeDue: number;
}

export interface PharmacyReceiptPdfDeps {
  addLogoToPdf: (pdf: jsPDF, x: number, y: number, w: number, h: number) => boolean;
}

export function pharmacyReceiptPdfFilename(saleNo: string | undefined): string {
  const safe = String(saleNo ?? 'rx').replace(/[^\w-]+/g, '-');
  return `pharmacy-receipt-${safe}.pdf`;
}

export function pharmacyReceiptPdfBlobUrl(pdf: jsPDF): string {
  const out = pdf.output('bloburl');
  if (typeof out === 'string') {
    return out;
  }
  if (out instanceof URL) {
    return out.href;
  }
  return String(out);
}

/** Build receipt PDF (OTC Rx tab + patient visit pharmacy tab). */
export function buildPharmacyReceiptPdf(
  r: PharmacyReceiptPdfData,
  deps: PharmacyReceiptPdfDeps
): jsPDF {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const right = pageW - margin;
  const withPrescribing = r.includePrescribing !== false;
  const colItemW = withPrescribing ? 72 : 100;
  const colDosageW = 38;
  const colQtyW = 14;
  const xItem = margin;
  const xDosage = xItem + colItemW;
  const xQty = withPrescribing ? xDosage + colDosageW : xItem + colItemW;
  let y = 22;
  const logoW = 28;
  const logoH = 22;
  if (deps.addLogoToPdf(pdf, (pageW - logoW) / 2, y, logoW, logoH)) {
    y += logoH + 4;
  }

  const ensureSpace = (needMm: number) => {
    const pageH = pdf.internal.pageSize.getHeight();
    if (y + needMm > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const centerLine = (text: string, size: number, bold = false) => {
    ensureSpace(8);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const w = pdf.getTextWidth(text);
    pdf.text(text, (pageW - w) / 2, y);
    y += size * 0.38 + 3;
  };

  const drawTotalRow = (label: string, value: string, bold = false) => {
    ensureSpace(7);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(10);
    pdf.text(label, margin, y);
    const vw = pdf.getTextWidth(value);
    pdf.text(value, right - vw, y);
    y += 5.5;
  };

  centerLine(r.facilityName, 14, true);
  centerLine(r.patientName ? 'Pharmacy Visit Sale' : 'OTC Counter Sale', 10);
  if (r.patientName?.trim()) {
    centerLine(`Patient: ${r.patientName.trim()}`, 10, true);
  }
  centerLine(r.saleNo, 11, true);
  centerLine(`${r.saleDateLabel} · ${r.saleTimeLabel}`, 9);
  centerLine(`Served by: ${r.receivedBy}`, 9);
  y += 2;

  ensureSpace(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Item', xItem, y);
  if (withPrescribing) {
    pdf.text('Dosage', xDosage, y);
  }
  pdf.text('Qty', xQty + colQtyW - pdf.getTextWidth('Qty'), y);
  pdf.text('Amount', right - pdf.getTextWidth('Amount'), y);
  y += 2;
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, right, y);
  y += 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  for (const line of r.lines) {
    const itemLines = pdf.splitTextToSize(line.itemName, colItemW - 2);
    const dosageLines = withPrescribing
      ? pdf.splitTextToSize(line.dosage || '—', colDosageW - 2)
      : [];
    const rowLines = Math.max(itemLines.length, dosageLines.length, 1);
    const rowH = rowLines * 4.2 + 2;
    ensureSpace(rowH);
    const rowY = y;
    pdf.text(itemLines, xItem, rowY);
    if (withPrescribing) {
      pdf.text(dosageLines, xDosage, rowY);
    }
    const qty = String(line.quantity);
    pdf.text(qty, xQty + colQtyW - pdf.getTextWidth(qty), rowY);
    const amt = line.given === false ? '—' : formatPharmacyMoney(line.lineTotal);
    pdf.text(amt, right - pdf.getTextWidth(amt), rowY);
    y = rowY + rowH;
    pdf.setDrawColor(220);
    pdf.line(margin, y - 1.5, right, y - 1.5);
  }

  y += 2;
  pdf.setDrawColor(0);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.line(margin, y, right, y);
  pdf.setLineDashPattern([], 0);
  y += 6;

  drawTotalRow('Total due', formatPharmacyMoney(r.subtotal), true);
  drawTotalRow('Payment', r.paymentMethod);
  drawTotalRow('Amount received', formatPharmacyMoney(r.amountReceived), true);
  drawTotalRow('Change', formatPharmacyMoney(r.changeDue), true);

  if (r.notes?.trim()) {
    y += 2;
    ensureSpace(12);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const noteLines = pdf.splitTextToSize(`Notes: ${r.notes}`, right - margin);
    pdf.text(noteLines, margin, y);
    y += noteLines.length * 4.2 + 2;
  }

  y += 4;
  centerLine('Thank you', 11, true);
  return pdf;
}
