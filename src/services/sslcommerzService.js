/**
 * SSLCommerz Payment Gateway Integration Service
 */
export function getSSLCommerzCredentials() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
  const isLive = String(process.env.SSLCOMMERZ_IS_LIVE || 'false').toLowerCase() === 'true';
  const refer = process.env.SSLCOMMERZ_REFER || '5B1F9DE4D82B6';

  if (!storeId || !storePassword) {
    throw new Error('SSLCommerz credentials missing: SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD must be configured in environment variables.');
  }

  const baseUrl = isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com';

  return { storeId, storePassword, isLive, baseUrl, refer };
}

/**
 * Initialize SSLCommerz Payment Session
 * @param {Object} param0 - { order, serverBaseUrl }
 */
export async function initSSLCommerzPayment({ order, serverBaseUrl }) {
  const { storeId, storePassword, baseUrl } = getSSLCommerzCredentials();
  const apiEndpoint = `${baseUrl}/gwprocess/v4/api.php`;

  // Resolve base URL for SSLCommerz callback redirects (prevent localhost leakage in production/Vercel)
  let callbackBase = '';
  if (serverBaseUrl && !serverBaseUrl.includes('localhost') && !serverBaseUrl.includes('127.0.0.1')) {
    callbackBase = serverBaseUrl;
  } else if (process.env.SERVER_URL && !process.env.SERVER_URL.includes('localhost') && !process.env.SERVER_URL.includes('127.0.0.1')) {
    callbackBase = process.env.SERVER_URL;
  } else if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    callbackBase = 'https://techcore-server.vercel.app';
  } else {
    callbackBase = process.env.SERVER_URL || serverBaseUrl || 'http://localhost:5000';
  }
  const serverUrl = callbackBase.replace(/\/+$/, '');

  const payload = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: order.grandTotal,
    currency: 'BDT',
    tran_id: order.id,
    success_url: `${serverUrl}/api/payment/sslcommerz/success?orderId=${order.id}`,
    fail_url: `${serverUrl}/api/payment/sslcommerz/fail?orderId=${order.id}`,
    cancel_url: `${serverUrl}/api/payment/sslcommerz/cancel?orderId=${order.id}`,
    ipn_url: `${serverUrl}/api/payment/sslcommerz/ipn`,
    shipping_method: 'COURIER',
    product_name: (order.items || []).map(i => i.name).join(', ').substring(0, 100) || 'TechCore Computer Parts',
    product_category: 'Computer & Hardware',
    product_profile: 'general',
    cus_name: order.customer?.name || 'Customer',
    cus_email: order.customer?.email || 'customer@techcore.com',
    cus_add1: order.customer?.address || 'Dhaka',
    cus_city: order.customer?.city || 'Dhaka',
    cus_postcode: '1200',
    cus_country: 'Bangladesh',
    cus_phone: order.customer?.phone || '01700000000',
    ship_name: order.customer?.name || 'Customer',
    ship_add1: order.customer?.address || 'Dhaka',
    ship_city: order.customer?.city || 'Dhaka',
    ship_postcode: '1200',
    ship_country: 'Bangladesh',
    emi_option: '0'
  });

  console.log(`Initiating SSLCommerz session for Order #${order.id} (${order.grandTotal} BDT)...`);

  try {
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    });

    const data = await res.json();

    if (data && data.status === 'SUCCESS') {
      console.log(`SSLCommerz session created! Gateway URL: ${data.GatewayPageURL}`);
      return {
        status: 'SUCCESS',
        gatewayUrl: data.GatewayPageURL,
        sessionkey: data.sessionkey
      };
    } else {
      console.warn(`SSLCommerz Session Init Failed:`, data);
      return {
        status: 'FAILED',
        message: data?.failedreason || 'SSLCommerz session initiation failed'
      };
    }
  } catch (err) {
    console.error('SSLCommerz Init Error:', err.message);
    return {
      status: 'FAILED',
      message: err.message || 'SSLCommerz gateway connection error'
    };
  }
}

/**
 * Create SSLCommerz Payment Invoice
 * Calls SSLCommerz Invoice API (gwprocess/v4/invoice.php)
 * Returns pay_url, QR image URLs, Bangla QR code, and invoice_id
 * @param {Object} param0 - { order, serverBaseUrl, isBanglaQr, sendEmail, sendSms, refer }
 */
export async function createSSLCommerzInvoice({
  order,
  serverBaseUrl,
  isBanglaQr = true,
  sendEmail = false,
  sendSms = false,
  refer: customRefer
}) {
  const { storeId, storePassword, baseUrl, refer: defaultRefer } = getSSLCommerzCredentials();
  const invoiceEndpoint = `${baseUrl}/gwprocess/v4/invoice.php`;

  const callbackBase = process.env.SERVER_URL || serverBaseUrl || 'http://localhost:5000';
  const serverUrl = callbackBase.replace(/\/+$/, '');

  const items = Array.isArray(order.items) ? order.items : [];
  const cartJson = JSON.stringify(
    items.map(item => ({
      product: (item.name || 'Product').substring(0, 100),
      quantity: String(item.quantity || 1),
      amount: Number((item.price || 0) * (item.quantity || 1)).toFixed(2)
    }))
  );

  const payload = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    refer: customRefer || defaultRefer || '5B1F9DE4D82B6',
    acct_no: String(order.invoiceNo || order.id || `INV-${Date.now()}`),
    total_amount: Number(order.grandTotal || 0).toFixed(2),
    currency: 'BDT',
    tran_id: String(order.id),
    product_category: 'Computer & Hardware',
    is_bangla_qr_enabled: isBanglaQr ? 'YES' : 'NO',
    is_sent_email: sendEmail ? 'yes' : 'no',
    is_sent_sms: sendSms ? 'yes' : 'no',
    ipn_url: `${serverUrl}/api/payment/sslcommerz/ipn`,
    emi_option: '0',
    cus_name: order.customer?.name || 'Customer',
    cus_email: order.customer?.email || 'customer@techcore.com',
    cus_add1: order.customer?.address || 'Dhaka',
    cus_city: order.customer?.city || order.customer?.district || 'Dhaka',
    cus_state: order.customer?.division || 'Dhaka',
    cus_postcode: '1200',
    cus_country: 'Bangladesh',
    cus_phone: order.customer?.phone || '01700000000',
    shipping_method: 'YES',
    num_of_item: String(items.length || 1),
    ship_name: order.customer?.name || 'Customer',
    ship_add1: order.customer?.address || 'Dhaka',
    ship_city: order.customer?.city || 'Dhaka',
    ship_postcode: '1200',
    ship_country: 'Bangladesh',
    product_name: items.map(i => i.name).join(', ').substring(0, 100) || 'TechCore Computer Parts',
    product_profile: 'general',
    product_amount: Number(order.subtotal || order.grandTotal || 0).toFixed(2),
    discount_amount: Number(order.discount || 0).toFixed(2),
    cart: cartJson,
    value_a: String(order.id),
    value_b: String(order.invoiceNo || '')
  });

  console.log(`Creating SSLCommerz Invoice for Order #${order.id} (${order.grandTotal} BDT)...`);

  try {
    const res = await fetch(invoiceEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    });

    const data = await res.json();

    if (data && (data.status === 'success' || data.status === 'SUCCESS')) {
      console.log(`SSLCommerz Invoice created successfully! Invoice ID: ${data.invoice_id}, Pay URL: ${data.pay_url}`);
      return {
        status: 'SUCCESS',
        invoiceId: data.invoice_id,
        invoiceRefer: data.invoice_refer,
        payUrl: data.pay_url,
        qrImageUrl: data.qr_image_url || data.qr_image_pay_url,
        qrImagePayUrl: data.qr_image_pay_url,
        banglaQrCode: data.bangla_qr_code,
        emailSendingStatus: data.email_sending_status,
        smsSendingStatus: data.sms_sending_status,
        raw: data
      };
    } else {
      console.warn(`SSLCommerz Invoice creation failed:`, data);
      return {
        status: 'FAILED',
        message: data?.error_reason || data?.failedreason || 'SSLCommerz invoice creation failed',
        raw: data
      };
    }
  } catch (err) {
    console.error('SSLCommerz Invoice API Error:', err.message);
    return {
      status: 'FAILED',
      message: err.message || 'SSLCommerz Invoice API connection error'
    };
  }
}

/**
 * Validate SSLCommerz Transaction with SSLCommerz Validation Server
 * @param {String} valId - SSLCommerz validation ID
 */
export async function validateSSLCommerzTransaction(valId) {
  const { storeId, storePassword, baseUrl } = getSSLCommerzCredentials();
  const validationEndpoint = `${baseUrl}/validator/api/validationserverAPI.php?val_id=${valId}&store_id=${storeId}&store_passwd=${storePassword}&v=1&format=json`;

  try {
    const res = await fetch(validationEndpoint);
    const data = await res.json();
    if (data && (data.status === 'VALID' || data.status === 'VALIDATED')) {
      console.log(`SSLCommerz Transaction Validated Successfully: ${valId}`);
      return { isValid: true, data };
    }
    console.warn(`SSLCommerz Transaction Validation Status:`, data?.status);
    return { isValid: false, data };
  } catch (err) {
    console.error('SSLCommerz Validation Server Error:', err.message);
    return { isValid: false, error: err.message };
  }
}
