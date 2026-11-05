import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { HubCard } from "@/components/HubUI/HubUI.jsx";
import "./DemoScriptPage.css";

/* Guided "things to click" list per role - used for presenting the Order Hub flow */
const SCRIPTS = {
  client: {
    title: "Client portal - demo script",
    desc: "Suggested run-through: this is what a wholesale customer sees once they are given a login.",
    steps: [
      ["Client Dashboard", "Show the account snapshot - open orders, outstanding balance vs credit limit, active offers."],
      ["Place Order", "Add a quantity to Basmati Rice 20kg and Garam Masala 1kg, enter promo code SPRING10, and submit - point out the price is already this client's agreed rate."],
      ["My Offers", "Show the SPRING10 offer card - explain only clients it was assigned to can see or use it."],
      ["My Invoices / Account Statement", "Show the existing outstanding invoice and balance vs credit limit."],
    ],
  },
  manager: {
    title: "Area manager - demo script",
    desc: "Suggested run-through: this is the field rep's view on their phone.",
    steps: [
      ["Manager Dashboard", "Point out the live location badge, visit count, order count and total sale value for their patch."],
      ["Register a Visit", "Pick a client, click \"Check my GPS location\" (or use the Simulate buttons if location is blocked), open the camera, capture a stamped photo, then confirm - \"Confirm visit\" stays disabled until both are done."],
      ["Client Orders", "Show every order placed by clients this manager covers."],
      ["Place Order for Client", "Switch the client dropdown to show pricing changes per account, then place an order on their behalf."],
    ],
  },
  admin: {
    title: "Back office - demo script",
    desc: "Suggested run-through: walk the boss through a full order lifecycle, then the AI pieces.",
    steps: [
      ["Orders", "Show the order sitting as \"Placed\", then click \"Send to Eden Farm\"."],
      ["POD Matching", "Open the order now \"With Eden Farm\", under-deliver one line on purpose, run the match - it raises an invoice AND logs a backorder in the same action."],
      ["POD Auto-Match (AI)", "Click \"Run auto-match now\" on the remaining pending order - it gets matched and invoiced with no manual entry."],
      ["Backorders", "Show the backorder(s) just created, then \"Raise replenishment PO\" on one."],
      ["Credit Control", "Show Green Leaf Grocers already flagged over their credit limit from a seeded invoice - click \"Send reminder\"."],
      ["Demand Forecasting", "Show Turmeric Powder flagged for reorder (seeded close to expiry / low stock) and create the suggested PO."],
      ["Promotions", "Create a new promo, assign it to one client, then open Client Portal > My Offers to see it appear live."],
      ["Audit Log", "Scroll through - every action taken in this walkthrough is timestamped here."],
    ],
  },
};

export default function DemoScriptPage({ role }) {
  const s = SCRIPTS[role];
  return (
    <div className="page-anim demo-script-page">
      <PageHeader eyebrow="ORDER HUB" title={s.title} subtitle={s.desc} icon="fa-star" />
      <HubCard>
        <ol className="demo-steps">
          {s.steps.map(([name, text]) => (
            <li key={name}>
              <b>{name}</b>
              <p className="muted">{text}</p>
            </li>
          ))}
        </ol>
      </HubCard>
      <p className="muted demo-note">Everything uses sample data and resets if the page reloads - safe to click through freely.</p>
    </div>
  );
}

export const ClientDemoScriptPage = () => <DemoScriptPage role="client" />;
export const ManagerDemoScriptPage = () => <DemoScriptPage role="manager" />;
export const AdminDemoScriptPage = () => <DemoScriptPage role="admin" />;
