import { useState, type FormEvent, type ReactElement } from 'react';
import { Submitted } from './Submitted';

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  street: '',
  city: '',
  postalCode: '',
  country: '',
  quantity: 1,
  deliveryDate: '',
  shipping: 'standard',
  giftMessage: '',
  newsletter: false,
  terms: false,
  // Card fields exist to prove PromptFill skips them.
  cardNumber: '',
  cvc: '',
};

/** Every input is React-controlled, so a naive `el.value = x` would not stick. */
export function CheckoutForm() {
  const [form, setForm] = useState(empty);
  const [submitted, setSubmitted] = useState<typeof empty | null>(null);
  const set = <K extends keyof typeof empty>(k: K) => (v: (typeof empty)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(form);
  };

  return (
    <div className="grid">
      <form className="card" onSubmit={onSubmit}>
        <h2>Checkout</h2>

        <fieldset>
          <legend>Personal information</legend>
          <div className="two">
            <Field label="First name"><input name="firstName" required value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} /></Field>
            <Field label="Last name"><input name="lastName" required value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} /></Field>
          </div>
          <div className="two">
            <Field label="Email"><input name="email" type="email" required value={form.email} onChange={(e) => set('email')(e.target.value)} /></Field>
            <Field label="Phone"><input name="phone" type="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
          </div>
          <Field label="Company (optional)"><input name="company" value={form.company} onChange={(e) => set('company')(e.target.value)} /></Field>
        </fieldset>

        <fieldset>
          <legend>Billing address</legend>
          <Field label="Street address"><input name="street" value={form.street} onChange={(e) => set('street')(e.target.value)} /></Field>
          <div className="three">
            <Field label="City"><input name="city" value={form.city} onChange={(e) => set('city')(e.target.value)} /></Field>
            <Field label="Postal code"><input name="postalCode" maxLength={10} value={form.postalCode} onChange={(e) => set('postalCode')(e.target.value)} /></Field>
            <Field label="Country">
              <select name="country" value={form.country} onChange={(e) => set('country')(e.target.value)}>
                <option value="">Select…</option>
                <option value="AL">Albania</option>
                <option value="CH">Switzerland</option>
                <option value="DE">Germany</option>
                <option value="IT">Italy</option>
                <option value="US">United States</option>
              </select>
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>Order</legend>
          <div className="two">
            <Field label="Quantity"><input name="quantity" type="number" min={1} max={50} value={form.quantity} onChange={(e) => set('quantity')(Number(e.target.value))} /></Field>
            <Field label="Preferred delivery date"><input name="deliveryDate" type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate')(e.target.value)} /></Field>
          </div>
          <div className="radios" role="radiogroup" aria-label="Shipping speed">
            {['standard', 'express', 'pickup'].map((v) => (
              <label key={v}>
                <input type="radio" name="shipping" value={v} checked={form.shipping === v} onChange={() => set('shipping')(v)} /> {v[0].toUpperCase() + v.slice(1)}
              </label>
            ))}
          </div>
          <Field label="Gift message"><textarea name="giftMessage" rows={3} maxLength={280} value={form.giftMessage} onChange={(e) => set('giftMessage')(e.target.value)} /></Field>
        </fieldset>

        <fieldset>
          <legend>Payment</legend>
          <div className="two">
            <Field label="Card number"><input name="cardNumber" autoComplete="cc-number" value={form.cardNumber} onChange={(e) => set('cardNumber')(e.target.value)} /></Field>
            <Field label="CVC"><input name="cvc" autoComplete="cc-csc" value={form.cvc} onChange={(e) => set('cvc')(e.target.value)} /></Field>
          </div>
          <p className="muted">PromptFill never reads or fills card or password fields.</p>
        </fieldset>

        <label className="check"><input type="checkbox" name="newsletter" checked={form.newsletter} onChange={(e) => set('newsletter')(e.target.checked)} /> Send me product news</label>
        <label className="check"><input type="checkbox" name="terms" required checked={form.terms} onChange={(e) => set('terms')(e.target.checked)} /> I accept the terms</label>

        <button className="primary" type="submit">Complete order</button>
      </form>

      <Submitted data={submitted} />
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactElement }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
