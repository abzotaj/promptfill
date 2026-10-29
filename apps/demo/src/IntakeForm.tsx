import { useState, type FormEvent } from 'react';
import { Field } from './CheckoutForm';
import { Submitted } from './Submitted';

/** A second, unrelated form: the widget should handle it with no code changes. */
export function IntakeForm() {
  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    sex: '',
    personalId: '',
    phone: '',
    insurer: '',
    visitReason: '',
    symptoms: [] as string[],
    appointmentTime: '',
    firstVisit: true,
    smsReminders: false,
  });
  const [submitted, setSubmitted] = useState<typeof form | null>(null);
  const set = (k: keyof typeof form) => (v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(form);
  };

  return (
    <div className="grid">
      <form className="card" onSubmit={onSubmit}>
        <h2>New patient intake</h2>
        <Field label="Full name"><input name="fullName" required value={form.fullName} onChange={(e) => set('fullName')(e.target.value)} /></Field>
        <div className="two">
          <Field label="Date of birth"><input name="dateOfBirth" type="date" max="2026-12-31" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth')(e.target.value)} /></Field>
          <Field label="Sex">
            <select name="sex" value={form.sex} onChange={(e) => set('sex')(e.target.value)}>
              <option value="">Select…</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="X">Prefer not to say</option>
            </select>
          </Field>
        </div>
        <div className="two">
          {/* Matches the "national id" rule, so PromptFill skips it. */}
          <Field label="National ID number"><input name="personalId" value={form.personalId} onChange={(e) => set('personalId')(e.target.value)} /></Field>
          <Field label="Mobile phone"><input name="phone" type="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
        </div>
        <Field label="Insurance provider"><input name="insurer" value={form.insurer} onChange={(e) => set('insurer')(e.target.value)} /></Field>
        <Field label="Reason for visit"><textarea name="visitReason" rows={3} value={form.visitReason} onChange={(e) => set('visitReason')(e.target.value)} /></Field>
        <Field label="Symptoms (hold Ctrl/⌘ to pick several)">
          <select
            name="symptoms"
            multiple
            value={form.symptoms}
            onChange={(e) => set('symptoms')(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            <option value="fever">Fever</option>
            <option value="cough">Cough</option>
            <option value="headache">Headache</option>
            <option value="back-pain">Back pain</option>
            <option value="fatigue">Fatigue</option>
          </select>
        </Field>
        <Field label="Appointment"><input name="appointmentTime" type="datetime-local" value={form.appointmentTime} onChange={(e) => set('appointmentTime')(e.target.value)} /></Field>
        <label className="check"><input type="checkbox" name="firstVisit" checked={form.firstVisit} onChange={(e) => set('firstVisit')(e.target.checked)} /> First visit to this clinic</label>
        <label className="check"><input type="checkbox" name="smsReminders" checked={form.smsReminders} onChange={(e) => set('smsReminders')(e.target.checked)} /> SMS appointment reminders</label>
        <button className="primary" type="submit">Register patient</button>
      </form>
      <Submitted data={submitted} />
    </div>
  );
}
