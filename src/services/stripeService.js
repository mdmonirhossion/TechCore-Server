import Stripe from 'stripe';

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_dev';
  return new Stripe(secretKey);
}

/**
 * Creates a Stripe PaymentIntent for the given order amount
 * @param {number} amountInBdt - Amount in Bangladeshi Taka
 * @param {string} customerEmail - Customer email address
 */
export async function createStripePaymentIntent(amountInBdt, customerEmail) {
  try {
    const stripe = getStripe();
    // Convert BDT to USD cents for Stripe Card processing (1 USD ~ 115 BDT)
    const amountInUsdCents = Math.max(100, Math.round((amountInBdt / 115) * 100));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInUsdCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail && customerEmail.includes('@') ? customerEmail : undefined,
      metadata: {
        integration: 'TechCore E-Commerce',
        amountInBdt: String(amountInBdt)
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (err) {
    console.error('❌ Stripe API Error:', err.message);
    throw err;
  }
}
