/**
 * SSLCommerz Payment Gateway Integration Service
 */
export function getSSLCommerzCredentials() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
  const isLive = String(process.env.SSLCOMMERZ_IS_LIVE || 'false').toLowerCase() === 'true';

  if (!storeId || !storePassword) {
    throw new Error('SSLCommerz credentials missing: SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD must be configured in environment variables.');
  }

  const baseUrl = isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com';

  return { storeId, storePassword, isLive, baseUrl };
}

/**
 * Initialize SSLCommerz Payment Session
 * @param {Object} param0 - { order, serverBaseUrl }
 */
export async function initSSLCommerzPayment({ order, serverBaseUrl }) {
  const { storeId, storePassword, baseUrl } = getSSLCommerzCredentials();
  const apiEndpoint = `${baseUrl}/gwprocess/v4/api.php`;

  // Always prefer SERVER_URL environment variable for callback URLs
  const callbackBase = process.env.SERVER_URL || serverBaseUrl || 'http://localhost:5000';
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
