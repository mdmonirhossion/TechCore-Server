import nodemailer from 'nodemailer';
import { BirdClient } from '@messagebird/sdk';

// Initialize MessageBird / Bird Client
const birdApiKey = process.env.BIRD_API_KEY;
export const bird = new BirdClient({ apiKey: birdApiKey || '' });

// Create Nodemailer transporter with Gmail App Password credentials
export const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends order confirmation HTML email to customer with attached PDF invoice
 * @param {Object} param0 - { order, pdfBuffer }
 */
export async function sendOrderConfirmationEmail({ order, pdfBuffer }) {
  const customerEmail = order.customer?.email;
  if (!customerEmail) {
    console.warn('⚠️ No customer email provided for order confirmation.');
    return;
  }

  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #f8fafc;">${i.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #cbd5e1; text-align: center;">${i.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #1e293b; color: #00f2fe; text-align: right; font-weight: bold;">৳${((i.price || 0) * i.quantity).toLocaleString()} BDT</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #0b0f17; color: #f8fafc; padding: 25px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
      <div style="text-align: center; border-bottom: 1px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #00f2fe; margin: 0; font-size: 26px;">TECHCORE</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Computer & Electronics E-Commerce & Service Portal</p>
      </div>

      <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 10px;">Order Confirmation - #${order.id}</h2>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
        Dear <strong>${order.customer?.name || 'Customer'}</strong>,<br>
        Thank you for shopping with TechCore! Your order has been successfully placed and confirmed.
      </p>

      <div style="background-color: #151c28; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #1e293b;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #94a3b8;">Order Date:</span>
          <strong style="color: #ffffff;">${order.createdAt || new Date().toISOString().split('T')[0]}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
          <span style="color: #94a3b8;">Payment Method:</span>
          <strong style="color: #00f2fe;">${order.paymentMethod || 'Cash on Delivery'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
          <span style="color: #94a3b8;">Payment Status:</span>
          <strong style="color: #34d399;">${order.paymentStatus || 'Confirmed'}</strong>
        </div>
      </div>

      <h3 style="color: #00f2fe; font-size: 16px; margin-top: 25px; margin-bottom: 10px;">Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #151c28; color: #00f2fe; text-align: left;">
            <th style="padding: 8px;">Product</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="text-align: right; border-top: 1px solid #1e293b; padding-top: 10px; font-size: 14px;">
        <p style="margin: 4px 0; color: #cbd5e1;">Subtotal: <strong>৳${(order.subtotal || 0).toLocaleString()}</strong></p>
        ${order.discount > 0 ? `<p style="margin: 4px 0; color: #34d399;">Discount: <strong>-৳${order.discount.toLocaleString()}</strong></p>` : ''}
        <p style="margin: 4px 0; color: #cbd5e1;">Delivery Fee: <strong>৳${order.deliveryFee || 0}</strong></p>
        <h3 style="margin: 8px 0 0 0; color: #00f2fe; font-size: 18px;">Grand Total: ৳${(order.grandTotal || 0).toLocaleString()} BDT</h3>
      </div>

      <div style="background-color: #0e131d; padding: 12px; border-radius: 6px; margin-top: 25px; text-align: center; font-size: 12px; color: #94a3b8;">
        📎 <strong>Official Invoice PDF Attached</strong>: Please check the attached <code>Invoice-${order.id}.pdf</code> document for your official records and warranty lookup.
      </div>
    </div>
  `;

  // 1. Try MessageBird SDK Email
  try {
    const birdMsg = await bird.email.send({
      from: { email: 'onboarding@messagebird.dev', name: 'TechCore' },
      to: [customerEmail],
      subject: `Order Confirmed - #${order.id} | TechCore Bangladesh`,
      html: htmlContent
    });
    console.log(`🐦 MessageBird Email dispatched (ID: ${birdMsg.id}, Status: ${birdMsg.status})`);
  } catch (birdErr) {
    console.warn('⚠️ MessageBird Email fallback to Nodemailer Gmail:', birdErr.message || birdErr);
  }

  // 2. Nodemailer Gmail Dispatch with PDF Attachment
  const mailOptions = {
    from: `"TechCore BD" <${process.env.EMAIL_USER || 'mdmonirhossion2002@gmail.com'}>`,
    to: customerEmail,
    subject: `Order Confirmed - #${order.id} | TechCore Bangladesh`,
    html: htmlContent,
    attachments: pdfBuffer ? [
      {
        filename: `Invoice-${order.id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ] : []
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Nodemailer Gmail confirmation email sent to ${customerEmail} (MessageId: ${info.messageId})`);
    return info;
  } catch (err) {
    console.error('❌ Nodemailer Gmail Error:', err.message);
    throw err;
  }
}

/**
 * Sends notification email to TechCore Admin when a new order is received
 * @param {Object} param0 - { order }
 */
export async function sendAdminOrderNotificationEmail({ order }) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'mdmonirhossion2002@gmail.com';

  const mailOptions = {
    from: `"TechCore System" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🔔 New Order Received - #${order.id} (৳${order.grandTotal.toLocaleString()})`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #0b0f17; color: #ffffff; padding: 20px; border-radius: 8px;">
        <h2 style="color: #00f2fe;">New Store Order Notification</h2>
        <p><strong>Order ID:</strong> #${order.id}</p>
        <p><strong>Customer Name:</strong> ${order.customer?.name} (${order.customer?.phone})</p>
        <p><strong>Email:</strong> ${order.customer?.email}</p>
        <p><strong>Shipping Zone:</strong> ${order.customer?.zone}</p>
        <p><strong>Grand Total:</strong> ৳${order.grandTotal.toLocaleString()} BDT</p>
        <p><strong>Payment Method:</strong> ${order.paymentMethod} (${order.paymentStatus})</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`🔔 Admin notification email sent to ${adminEmail}`);
    return info;
  } catch (err) {
    console.error('❌ Nodemailer Error (Admin Notification):', err.message);
  }
}
