import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_dev');

async function createStripePaymentIntent(amountInBdt, customerEmail) {
  try {
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

    console.log('✅ Payment Intent Created Successfully:', paymentIntent.id, paymentIntent.client_secret);
    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  }
}

createStripePaymentIntent(40000, 'tanvir@gmail.com');
