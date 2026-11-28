// Opens Razorpay's payment window in the browser. Used by screens; the server always
// re-checks the payment signature before anything is marked paid.

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

export interface CheckoutResult {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

function loadScript(): Promise<RazorpayCtor | null> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

/** Resolves with the payment details, or null when the person closes the window without paying. */
export async function openRazorpayCheckout(order: { keyId: string; amount: number; razorpayOrderId: string }, description: string): Promise<CheckoutResult | null> {
  const Razorpay = await loadScript();
  if (!Razorpay) throw new Error('Could not load the payment page. Please check your connection and try again.');
  return new Promise((resolve) => {
    new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: 'INR',
      order_id: order.razorpayOrderId,
      name: 'EC',
      description,
      handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) =>
        resolve({ razorpayPaymentId: r.razorpay_payment_id, razorpayOrderId: r.razorpay_order_id, razorpaySignature: r.razorpay_signature }),
      modal: { ondismiss: () => resolve(null) },
      theme: { color: '#0B5563' },
    }).open();
  });
}
