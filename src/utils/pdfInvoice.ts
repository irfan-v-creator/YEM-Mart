import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../types';
import { formatDate } from './formatters';

export function generateOrderPdfInvoice(order: Order, supportWhatsApp = '7510447887'): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;

  // Colors
  const primaryColor: [number, number, number] = [23, 23, 23]; // #171717
  const goldColor: [number, number, number] = [201, 164, 76]; // #C9A44C
  const grayColor: [number, number, number] = [100, 100, 100];
  const lightBgColor: [number, number, number] = [247, 246, 242]; // #F7F6F2

  // 1. Top Decorative Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(...goldColor);
  doc.rect(margin, 5, 40, 1.5, 'F');

  // 2. Header Section
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('YEM MART', margin, 18);

  doc.setTextColor(...goldColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('YOUR EVERYDAY STORE • KERALA ONLINE SHOPPING', margin, 23);

  doc.setTextColor(...grayColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Authentic Traditional Wear, Spices, Electronics & Lifestyle Essentials', margin, 27.5);
  doc.text(`Official WhatsApp Care: +91 ${supportWhatsApp.replace(/[^0-9]/g, '').slice(-10)} | www.yemmart.in`, margin, 31.5);

  // Right Side Header Badge
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(pageWidth - margin - 58, 11, 58, 22, 2, 2, 'F');
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - margin - 58, 11, 58, 22, 2, 2, 'S');

  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TAX INVOICE / RECEIPT', pageWidth - margin - 29, 17.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Invoice Ref: ', pageWidth - margin - 53, 23);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(order.id, pageWidth - margin - 53 + doc.getTextWidth('Invoice Ref: '), 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Date: ', pageWidth - margin - 53, 28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(formatDate(order.createdAt), pageWidth - margin - 53 + doc.getTextWidth('Date: '), 28);

  // Horizontal Divider
  doc.setDrawColor(230, 228, 222);
  doc.setLineWidth(0.5);
  doc.line(margin, 36, pageWidth - margin, 36);

  // 3. Customer & Order Info Boxes
  const boxTop = 41;
  const colWidth = (pageWidth - margin * 2 - 6) / 2;

  // Box A: Billed & Delivered To
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(margin, boxTop, colWidth, 34, 2, 2, 'F');

  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CUSTOMER & DELIVERY DESTINATION', margin + 4, boxTop + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(order.customer.fullName || 'Valued Customer', margin + 4, boxTop + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(`Mobile: +91 ${order.customer.phone || 'N/A'}`, margin + 4, boxTop + 17);

  const addressLines = doc.splitTextToSize(
    `${order.customer.address}, ${order.customer.pincode}${order.customer.district ? ` (${order.customer.district}, Kerala)` : ''}${order.customer.landmark ? ` [Landmark: ${order.customer.landmark}]` : ''}`,
    colWidth - 8
  );
  doc.text(addressLines, margin + 4, boxTop + 22);

  // Box B: Order Status & Payment Info
  const rightColX = margin + colWidth + 6;
  doc.setFillColor(...lightBgColor);
  doc.roundedRect(rightColX, boxTop, colWidth, 34, 2, 2, 'F');

  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ORDER SUMMARY & PAYMENT STATUS', rightColX + 4, boxTop + 6);

  const statusMap: Record<string, string> = {
    prepared: 'Order Prepared',
    whatsapp_pending: 'Awaiting Confirmation',
    payment_submitted: 'Payment Under Review',
    confirmed: 'Confirmed & Verified',
    processing: 'Processing & Packed',
    shipped: 'Dispatched / In Transit',
    delivered: 'Delivered Successfully',
    cancelled: 'Cancelled',
  };
  const statusLabel = statusMap[order.status] || order.status.replace(/_/g, ' ').toUpperCase();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('Current Status: ', rightColX + 4, boxTop + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...goldColor);
  doc.text(statusLabel, rightColX + 4 + doc.getTextWidth('Current Status: '), boxTop + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('Payment Mode: ', rightColX + 4, boxTop + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  const paymentMode = order.paymentMethod === 'cod' ? 'Cash on Delivery (Doorstep)' : 'Prepaid UPI Transfer';
  doc.text(paymentMode, rightColX + 4 + doc.getTextWidth('Payment Mode: '), boxTop + 18);

  if (order.utrNumber || order.paymentRef) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('UPI UTR Ref: ', rightColX + 4, boxTop + 24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(order.utrNumber || order.paymentRef || 'N/A', rightColX + 4 + doc.getTextWidth('UPI UTR Ref: '), boxTop + 24);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Kerala Coverage: All 14 Districts • Express Courier', rightColX + 4, boxTop + 30);

  // 4. Itemized Products Table
  const tableRows = order.items.map((item, idx) => {
    const variantDesc = item.variantName ? `\nVariant: ${item.variantName}` : '';
    const skuDesc = item.variantSku ? ` | SKU: ${item.variantSku}` : '';
    return [
      String(idx + 1),
      `${item.productName}${variantDesc}${skuDesc}`,
      String(item.quantity),
      `Rs. ${item.unitPrice.toLocaleString('en-IN')}`,
      `Rs. ${item.totalPrice.toLocaleString('en-IN')}`,
    ];
  });

  autoTable(doc, {
    startY: 81,
    margin: { left: margin, right: margin },
    head: [['#', 'Item Description & Specifications', 'Qty', 'Unit Price', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 3,
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: primaryColor,
      cellPadding: 2.8,
      lineColor: [230, 228, 222],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [252, 251, 249],
    },
  });

  // 5. Billing Summary (Right-aligned below table)
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const summaryBoxWidth = 85;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;

  doc.setFillColor(...lightBgColor);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 38, 2, 2, 'F');
  doc.setDrawColor(220, 218, 210);
  doc.setLineWidth(0.3);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 38, 2, 2, 'S');

  let curY = finalY + 6;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('Subtotal:', summaryBoxX + 6, curY);
  doc.setTextColor(...primaryColor);
  doc.text(`Rs. ${order.subtotal.toLocaleString('en-IN')}`, pageWidth - margin - 6, curY, { align: 'right' });

  // Discount
  if (order.discountAmount && order.discountAmount > 0) {
    curY += 6;
    doc.setTextColor(...grayColor);
    doc.text(`Discount (${order.couponCode || 'Promo'}):`, summaryBoxX + 6, curY);
    doc.setTextColor(220, 38, 38); // Red
    doc.text(`- Rs. ${order.discountAmount.toLocaleString('en-IN')}`, pageWidth - margin - 6, curY, { align: 'right' });
  }

  // Delivery Fee
  curY += 6;
  doc.setTextColor(...grayColor);
  doc.text('Delivery Fee (Kerala):', summaryBoxX + 6, curY);
  doc.setTextColor(...primaryColor);
  const deliveryText = order.deliveryFee === 0 ? 'FREE' : `Rs. ${order.deliveryFee.toLocaleString('en-IN')}`;
  doc.text(deliveryText, pageWidth - margin - 6, curY, { align: 'right' });

  // Divider
  curY += 4;
  doc.setDrawColor(210, 208, 200);
  doc.line(summaryBoxX + 4, curY, pageWidth - margin - 4, curY);

  // Grand Total Box
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryColor);
  doc.text('Grand Total:', summaryBoxX + 6, curY);
  doc.setTextColor(...goldColor);
  doc.text(`Rs. ${order.grandTotal.toLocaleString('en-IN')}`, pageWidth - margin - 6, curY, { align: 'right' });

  // Left-side Terms & Authentication Note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('VERIFICATION & SUPPORT NOTICE:', margin, finalY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  const termsText = [
    '• Official tax receipt generated automatically by YEM MART e-commerce platform.',
    '• For order modifications, courier tracking, or returns, message our WhatsApp support desk.',
    `• Store Support Helpline: +91 ${supportWhatsApp.replace(/[^0-9]/g, '').slice(-10)} (Mon - Sat, 9:00 AM - 8:00 PM).`,
    '• Express dispatch across all 14 Kerala districts within 24-48 business hours.',
  ];
  let noteY = finalY + 12;
  termsText.forEach((t) => {
    doc.text(t, margin, noteY);
    noteY += 5;
  });

  // 6. Professional Page Footer
  const footerY = 282;
  doc.setDrawColor(220, 218, 210);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...goldColor);
  doc.text('YEM MART KERALA • THANK YOU FOR YOUR BUSINESS!', pageWidth / 2, footerY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text(
    `Invoice #${order.id} • Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • Customer Care: +91 ${supportWhatsApp.replace(/[^0-9]/g, '').slice(-10)}`,
    pageWidth / 2,
    footerY + 9,
    { align: 'center' }
  );

  // Save / Trigger Download
  doc.save(`YEM-Invoice-${order.id}.pdf`);
}
