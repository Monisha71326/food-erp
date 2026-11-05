import { useRef, useState } from "react";
import "./ContactSupportPage.css";

const CATEGORIES = ["Orders", "Invoices", "Stock", "Technical"];

const CONTACTS = [
  { icon: "fa-envelope", label: "Email", value: "support@megworld.com" },
  { icon: "fa-phone", label: "Phone", value: "+91 00000 00000" },
  { icon: "fa-clock", label: "Hours", value: "Mon – Sat, 9 AM – 6 PM" },
];

const FAQS = [
  { q: "How do I track an order?", a: "Open Orders from the sidebar and click the order number to see its status." },
  { q: "Where is my invoice?", a: "Invoices are listed under My Invoices (Client) or Accounting / Invoices (Back office)." },
  { q: "How do I reset my password?", a: "Sign out, then ask your administrator to reset it from Users & Roles." },
  { q: "How do I place a new order?", a: "Open Client Portal, choose Place Order, select your products and confirm." },
  { q: "How do I cancel an order?", a: "Open the order from Orders and click Cancel before it is dispatched." },
  { q: "How do I update my address or contact details?", a: "Go to your Profile, edit the address or phone number and save." },
  { q: "How long does delivery take?", a: "Delivery time depends on your area. Check the order status for the expected date." },
  { q: "Who do I contact for a payment issue?", a: "Choose the Invoices category below and send a request, or email support@megworld.com." },
];

export default function ContactSupportPage() {
  const [category, setCategory] = useState("Orders");
  const [form, setForm] = useState({ subject: "", message: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const formRef = useRef(null);
  const subjectRef = useRef(null);

  const change = (e) => {
    setSent(false);
    setError("");
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // FAQ-la irundhu "Raise a ticket" click panna: form-ku scroll + subject fill + focus
  const raiseTicket = (question = "") => {
    setSent(false);
    setError("");
    if (question) setForm((f) => ({ ...f, subject: question }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => subjectRef.current?.focus(), 450);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      setError("Enter a subject and a message.");
      return;
    }
    setSent(true);
    setForm({ subject: "", message: "" });
  };

  return (
    <div className="contact-support-page page-anim">
      {/* Hero banner */}
      <div className="cs-hero">
        <div className="cs-hero-icon">
          <i className="fa-solid fa-headset" />
        </div>
        <div>
          <h1>How can we help you?</h1>
          <p>Send a request and our team will reply within 24 hours.</p>
        </div>
      </div>

      {/* Contact tiles */}
      <div className="cs-tiles">
        {CONTACTS.map((c) => (
          <div className="card cs-tile" key={c.label}>
            <span className="cs-tile-icon">
              <i className={`fa-solid ${c.icon}`} />
            </span>
            <div>
              <small>{c.label}</small>
              <strong>{c.value}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="cs-grid">
        {/* Request form (this is the ticket) */}
        <form className="card cs-form" onSubmit={submit} ref={formRef}>
          <h3>Send a request</h3>

          <label>Category</label>
          <div className="cs-chips">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                className={`cs-chip${category === c ? " active" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <label htmlFor="cs-subject">Subject</label>
          <input
            id="cs-subject"
            name="subject"
            ref={subjectRef}
            value={form.subject}
            onChange={change}
            placeholder="Subject"
          />

          <label htmlFor="cs-message">Message</label>
          <textarea
            id="cs-message"
            name="message"
            rows={5}
            value={form.message}
            onChange={change}
            placeholder="Describe your issue"
          />

          <div className="cs-actions">
            <button type="submit" className="cs-btn">
              <i className="fa-solid fa-paper-plane" /> Send request
            </button>
          </div>
          {error && <p className="cs-err">{error}</p>}
          {sent && <p className="cs-ok">Request sent. We'll reply soon.</p>}
        </form>

        {/* FAQ */}
        <div className="card cs-faq">
          <h3>Quick answers</h3>
          {FAQS.map((f, i) => (
            <div className={`cs-faq-item${openFaq === i ? " open" : ""}`} key={f.q}>
              <button
                type="button"
                className="cs-faq-q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{f.q}</span>
                <i className="fa-solid fa-chevron-down" />
              </button>
              {openFaq === i && (
                <div className="cs-faq-a">
                  <p>{f.a}</p>
                  <button type="button" className="cs-ticket-link" onClick={() => raiseTicket(f.q)}>
                    <i className="fa-solid fa-ticket" /> Not helpful? Raise a ticket
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="cs-faq-cta">
            <span>Didn't find your answer?</span>
            <button type="button" className="cs-btn cs-btn-sm" onClick={() => raiseTicket()}>
              <i className="fa-solid fa-ticket" /> Raise a ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}