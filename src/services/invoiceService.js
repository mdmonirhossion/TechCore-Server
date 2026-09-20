import PDFDocument from 'pdfkit';

/**
 * Generates a PDF invoice buffer for a TechCore order
 * @param {Object} order - Order document object
 * @returns {Promise<Buffer>} - Resolves to PDF Buffer
 */
export function generateInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // --- 1. Header Banner ---
      doc.fillColor('#0b0f17').rect(0, 0, doc.page.width, 100).fill();

      doc.fillColor('#00f2fe').fontSize(24).font('Helvetica-Bold').text('TECHCORE', 40, 30);
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('Computer & Electronics E-Commerce & Service Portal', 40, 60);

      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('INVOICE', 450, 30, { align: 'right' });
      doc.fillColor('#00f2fe').fontSize(11).font('Helvetica-Bold').text(`#${order.id}`, 450, 52, { align: 'right' });
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(`Date: ${order.createdAt || new Date().toISOString().split('T')[0]}`, 450, 68, { align: 'right' });

      // --- 2. Customer & Billed Information ---
      doc.moveDown(4);
      const startY = 120;

      doc.fillColor('#151c28').rect(40, startY, 250, 95).fill();
      doc.fillColor('#00f2fe').fontSize(10).font('Helvetica-Bold').text('BILLED TO (CUSTOMER)', 50, startY + 10);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(order.customer?.name || 'Customer', 50, startY + 28);
      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`Phone: ${order.customer?.phone || 'N/A'}`, 50, startY + 44);
      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`Email: ${order.customer?.email || 'N/A'}`, 50, startY + 58);
      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`Address: ${order.customer?.address || ''}, ${order.customer?.city || ''}`, 50, startY + 72);

      doc.fillColor('#151c28').rect(305, startY, 250, 95).fill();
      doc.fillColor('#00f2fe').fontSize(10).font('Helvetica-Bold').text('PAYMENT & SHIPPING', 315, startY + 10);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(`Payment Method: ${order.paymentMethod || 'Cash on Delivery'}`, 315, startY + 28);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(`Payment Status: ${order.paymentStatus || 'Pending'}`, 315, startY + 44);
      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`Delivery Zone: ${order.customer?.zone || 'Dhaka Inside'}`, 315, startY + 60);
      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`Order Status: ${order.orderStatus || 'Confirmed'}`, 315, startY + 74);

      // --- 3. Items Table Header ---
      const tableTop = 235;
      doc.fillColor('#00f2fe').rect(40, tableTop, 515, 22).fill();
      doc.fillColor('#0b0f17').fontSize(9).font('Helvetica-Bold');
      doc.text('ITEM DESCRIPTION', 50, tableTop + 6);
      doc.text('QTY', 330, tableTop + 6, { width: 40, align: 'center' });
      doc.text('UNIT PRICE', 380, tableTop + 6, { width: 80, align: 'right' });
      doc.text('TOTAL (BDT)', 470, tableTop + 6, { width: 75, align: 'right' });

      // --- 4. Items Table Rows ---
      let y = tableTop + 28;
      (order.items || []).forEach((item, index) => {
        const rowBg = index % 2 === 0 ? '#151c28' : '#0e131d';
        doc.fillColor(rowBg).rect(40, y - 4, 515, 24).fill();

        doc.fillColor('#ffffff').fontSize(9).font('Helvetica').text(item.name || 'Product', 50, y, { width: 270, height: 16, ellipsis: true });
        doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(String(item.quantity || 1), 330, y, { width: 40, align: 'center' });
        doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`Tk ${(item.price || 0).toLocaleString()}`, 380, y, { width: 80, align: 'right' });
        doc.fillColor('#00f2fe').fontSize(9).font('Helvetica-Bold').text(`Tk ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}`, 470, y, { width: 75, align: 'right' });

        y += 26;
      });

      // --- 5. Order Summary Calculations ---
      y += 10;
      doc.fillColor('#151c28').rect(330, y, 225, 85).fill();

      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text('Subtotal:', 340, y + 10);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(`Tk ${(order.subtotal || 0).toLocaleString()}`, 450, y + 10, { width: 95, align: 'right' });

      if (order.discount > 0) {
        doc.fillColor('#34d399').fontSize(9).font('Helvetica').text('Discount:', 340, y + 25);
        doc.fillColor('#34d399').fontSize(9).font('Helvetica-Bold').text(`-Tk ${(order.discount || 0).toLocaleString()}`, 450, y + 25, { width: 95, align: 'right' });
      }

      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text('Delivery Charge:', 340, y + 40);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(`Tk ${(order.deliveryFee || 0).toLocaleString()}`, 450, y + 40, { width: 95, align: 'right' });

      doc.strokeColor('#00f2fe').lineWidth(1).moveTo(340, y + 56).lineTo(545, y + 56).stroke();

      doc.fillColor('#00f2fe').fontSize(11).font('Helvetica-Bold').text('Grand Total:', 340, y + 63);
      doc.fillColor('#00f2fe').fontSize(11).font('Helvetica-Bold').text(`Tk ${(order.grandTotal || 0).toLocaleString()}`, 450, y + 63, { width: 95, align: 'right' });

      // --- 6. Footer Note ---
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Thank you for shopping with TechCore! For support & warranty claims, visit https://techcore.com.bd or call 16793.', 40, 760, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
