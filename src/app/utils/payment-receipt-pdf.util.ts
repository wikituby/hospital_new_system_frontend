import jsPDF from 'jspdf';
import { formatMoneyWholeDisplay } from './ugx-money.util';

export interface PaymentReceiptPdfData {
  facilityName: string;
  facilityContactLine?: string;
  patientName: string;
  patientFileNo?: string;
  visitNumber?: string | number | null;
  visitDate?: string;
  receiptNo: string;
  amountPaid: number | string | null | undefined;
  paymentForm: string;
  status: string;
  notes: string;
  dateOfPayment: string;
  timeOfPayment: string;
  paidBy?: string;
  receivedBy?: string;
  invoiceTotal?: number | string | null | undefined;
  invoiceAmountPaid?: number | string | null | undefined;
  balanceDue?: number | string | null | undefined;
}

export interface PaymentStatementRow {
  amountPaid: number | string | null | undefined;
  paymentForm: string;
  status: string;
  notes: string;
  dateOfPayment: string;
  timeOfPayment: string;
  paidBy?: string;
  receivedBy?: string;
}

export interface PaymentStatementPdfData {
  facilityName: string;
  facilityContactLine?: string;
  patientName: string;
  patientFileNo?: string;
  visitNumber?: string | number | null;
  visitDate?: string;
  rows: PaymentStatementRow[];
  subtotal?: number | string | null | undefined;
  discount?: number | string | null | undefined;
  tax?: number | string | null | undefined;
  totalAmount?: number | string | null | undefined;
  amountPaid?: number | string | null | undefined;
  balanceDue?: number | string | null | undefined;
}

export interface PaymentPdfDeps {
  addLogoToPdf: (pdf: jsPDF, x: number, y: number, w: number, h: number) => boolean;
}

function money(value: any): string {
  return `UGX ${formatMoneyWholeDisplay(value)}`;
}

function textOrDash(value: any): string {
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function downloadPdf(pdf: jsPDF, filename: string): void {
  const out = pdf.output('bloburl');
  const url = typeof out === 'string' ? out : out instanceof URL ? out.href : String(out);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => window.URL.revokeObjectURL(url), 1500);
}

function drawHeader(
  pdf: jsPDF,
  deps: PaymentPdfDeps,
  title: string,
  data: { facilityName: string; facilityContactLine?: string }
): number {
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 16;
  let y = 16;
  const logoW = 28;
  const logoH = 22;
  if (deps.addLogoToPdf(pdf, (pageW - logoW) / 2, y, logoW, logoH)) {
    y += logoH + 4;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  const facility = (data.facilityName || 'Health Facility').toUpperCase();
  pdf.text(facility, pageW / 2, y, { align: 'center' });
  y += 6;

  if (data.facilityContactLine) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(data.facilityContactLine, pageW / 2, y, { align: 'center' });
    y += 5;
  }

  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, pageW - margin, y);
  y += 7;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(title, pageW / 2, y, { align: 'center' });
  y += 8;
  return y;
}

function drawKeyValue(pdf: jsPDF, label: string, value: string, x: number, y: number, labelW = 34): void {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(label, x, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(value, x + labelW, y);
}

export function buildPaymentReceiptPdf(data: PaymentReceiptPdfData, deps: PaymentPdfDeps): jsPDF {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const margin = 16;
  let y = drawHeader(pdf, deps, 'PAYMENT RECEIPT', data);

  drawKeyValue(pdf, 'Receipt No:', textOrDash(data.receiptNo), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Patient:', textOrDash(data.patientName).toUpperCase(), margin, y);
  y += 6;
  drawKeyValue(pdf, 'File No:', textOrDash(data.patientFileNo), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Visit:', textOrDash(data.visitNumber), margin, y);
  y += 6;
  if (data.visitDate) {
    drawKeyValue(pdf, 'Visit Date:', textOrDash(data.visitDate), margin, y);
    y += 6;
  }

  y += 3;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(margin, y, pdf.internal.pageSize.getWidth() - margin, y);
  y += 8;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Amount Paid', margin, y);
  pdf.text(money(data.amountPaid), pdf.internal.pageSize.getWidth() - margin, y, { align: 'right' });
  y += 8;

  drawKeyValue(pdf, 'Payment Form:', textOrDash(data.paymentForm), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Status:', textOrDash(data.status), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Date:', textOrDash(data.dateOfPayment), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Time:', textOrDash(data.timeOfPayment), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Paid By:', textOrDash(data.paidBy), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Received By:', textOrDash(data.receivedBy), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Notes:', textOrDash(data.notes), margin, y);
  y += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Visit balances', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  drawKeyValue(pdf, 'Invoice Total:', money(data.invoiceTotal), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Total Paid:', money(data.invoiceAmountPaid), margin, y);
  y += 6;
  drawKeyValue(pdf, 'Balance Due:', money(data.balanceDue), margin, y);
  y += 12;

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.text('Thank you for your payment.', margin, y);

  return pdf;
}

export function buildPaymentStatementPdf(data: PaymentStatementPdfData, deps: PaymentPdfDeps): jsPDF {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let y = drawHeader(pdf, deps, 'PAYMENT STATEMENT', data);

  drawKeyValue(pdf, 'Patient:', textOrDash(data.patientName).toUpperCase(), margin, y);
  y += 5.5;
  drawKeyValue(pdf, 'File No:', textOrDash(data.patientFileNo), margin, y);
  y += 5.5;
  drawKeyValue(pdf, 'Visit:', textOrDash(data.visitNumber), margin, y);
  y += 5.5;
  if (data.visitDate) {
    drawKeyValue(pdf, 'Visit Date:', textOrDash(data.visitDate), margin, y);
    y += 5.5;
  }
  y += 3;

  const cols = [
    { label: 'Date', w: 24 },
    { label: 'Time', w: 18 },
    { label: 'Amount', w: 28 },
    { label: 'Form', w: 30 },
    { label: 'Status', w: 22 },
    { label: 'Notes', w: 60 },
  ];
  const tableW = cols.reduce((sum, c) => sum + c.w, 0);

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const drawTableHeader = () => {
    ensureSpace(10);
    pdf.setFillColor(55, 65, 81);
    pdf.rect(margin, y - 4, tableW, 7, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    let x = margin + 1;
    for (const col of cols) {
      pdf.text(col.label, x, y);
      x += col.w;
    }
    pdf.setTextColor(0, 0, 0);
    y += 6;
  };

  drawTableHeader();

  const rows = data.rows || [];
  if (!rows.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('No payment records for this visit.', margin, y + 2);
    y += 10;
  } else {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    for (const row of rows) {
      ensureSpace(8);
      const values = [
        textOrDash(row.dateOfPayment),
        textOrDash(row.timeOfPayment),
        money(row.amountPaid),
        textOrDash(row.paymentForm),
        textOrDash(row.status),
        textOrDash(row.notes),
      ];
      let x = margin + 1;
      values.forEach((value, i) => {
        const maxW = cols[i].w - 2;
        const clipped = pdf.splitTextToSize(value, maxW)[0] || value;
        pdf.text(clipped, x, y);
        x += cols[i].w;
      });
      y += 6;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, y - 3.5, margin + tableW, y - 3.5);
    }
  }

  y += 6;
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('Balances summary', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  drawKeyValue(pdf, 'Subtotal:', money(data.subtotal), margin, y);
  y += 5.5;
  drawKeyValue(pdf, 'Discount:', money(data.discount), margin, y);
  y += 5.5;
  drawKeyValue(pdf, 'Tax:', money(data.tax), margin, y);
  y += 5.5;
  drawKeyValue(pdf, 'Total Amount:', money(data.totalAmount), margin, y);
  y += 5.5;
  drawKeyValue(pdf, 'Amount Paid:', money(data.amountPaid), margin, y);
  y += 5.5;
  pdf.setFont('helvetica', 'bold');
  drawKeyValue(pdf, 'Balance Due:', money(data.balanceDue), margin, y);

  return pdf;
}

export function downloadPaymentReceiptPdf(data: PaymentReceiptPdfData, deps: PaymentPdfDeps): void {
  const pdf = buildPaymentReceiptPdf(data, deps);
  downloadPdf(pdf, `payment-receipt-${data.receiptNo || 'payment'}.pdf`);
}

export function downloadPaymentStatementPdf(data: PaymentStatementPdfData, deps: PaymentPdfDeps): void {
  const pdf = buildPaymentStatementPdf(data, deps);
  const visit = data.visitNumber != null ? String(data.visitNumber) : 'visit';
  downloadPdf(pdf, `payment-statement-${visit}.pdf`);
}
