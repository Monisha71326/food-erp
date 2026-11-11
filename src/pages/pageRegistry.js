/*
 * Page registry: sidebar label  ->  page component.
 * To add a new page: create the page folder, import it here, add one line.
 * Any sidebar label that is NOT listed here shows the "Coming soon" page.
 */
import DashboardPage from "./Dashboard/DashboardPage.jsx";

import CustomersPage from "./Sales/Customers/CustomersPage.jsx";
import QuotesPage from "./Sales/Quotes/QuotesPage.jsx";
import RetainerInvoicesPage from "./Sales/RetainerInvoices/RetainerInvoicesPage.jsx";
import SalesOrdersPage from "./Sales/SalesOrders/SalesOrdersPage.jsx";
import InvoicesPage from "./Sales/Invoices/InvoicesPage.jsx";
import RecurringInvoicesPage from "./Sales/RecurringInvoices/RecurringInvoicesPage.jsx";
import DeliveryChallansPage from "./Sales/DeliveryChallans/DeliveryChallansPage.jsx";
import PaymentsReceivedPage from "./Sales/PaymentsReceived/PaymentsReceivedPage.jsx";
import CreditNotesPage from "./Sales/CreditNotes/CreditNotesPage.jsx";
import CreditAgingReportPage from "./Sales/CreditAgingReport/CreditAgingReportPage.jsx"; // NEW

// Settings & Administration
import InvoiceTemplatesPage from "./Settings/InvoiceTemplates/InvoiceTemplatesPage.jsx";

// Order Hub module
import ClientDashboardPage from "./OrderHub/Client/ClientDashboard/ClientDashboardPage.jsx";
import PlaceOrderPage from "./OrderHub/Client/PlaceOrder/PlaceOrderPage.jsx";
import MyInvoicesPage from "./OrderHub/Client/MyInvoices/MyInvoicesPage.jsx";
import AccountStatementPage from "./OrderHub/Client/AccountStatement/AccountStatementPage.jsx";
import MyOffersPage from "./OrderHub/Client/MyOffers/MyOffersPage.jsx";
import MyDetailsPage from "./OrderHub/Client/MyDetails/MyDetailsPage.jsx";
import { ClientDemoScriptPage, ManagerDemoScriptPage, AdminDemoScriptPage } from "./OrderHub/DemoScript/DemoScriptPage.jsx";
import ManagerDashboardPage from "./OrderHub/Manager/ManagerDashboard/ManagerDashboardPage.jsx";
import RegisterVisitPage from "./OrderHub/Manager/RegisterVisit/RegisterVisitPage.jsx";
import ClientOrdersPage from "./OrderHub/Manager/ClientOrders/ClientOrdersPage.jsx";
import ClientInvoicesPage from "./OrderHub/Manager/ClientInvoices/ClientInvoicesPage.jsx";
import ManagerAccountStatementPage from "./OrderHub/Manager/ManagerAccountStatement/ManagerAccountStatementPage.jsx"; // NEW
import ManagerReportsPage from "./OrderHub/Manager/ManagerReports/ManagerReportsPage.jsx";
import PlaceOrderForClientPage from "./OrderHub/Manager/PlaceOrderForClient/PlaceOrderForClientPage.jsx";
import OrdersPage from "./OrderHub/Admin/Orders/OrdersPage.jsx";
import PodMatchingPage from "./OrderHub/Admin/PodMatching/PodMatchingPage.jsx";
import PodAutoMatchPage from "./OrderHub/Admin/PodAutoMatch/PodAutoMatchPage.jsx";
import BackordersPage from "./OrderHub/Admin/Backorders/BackordersPage.jsx";
import LiveManagersPage from "./OrderHub/Admin/LiveManagers/LiveManagersPage.jsx"; // NEW
import ShippingPage from "./OrderHub/Admin/Shipping/ShippingPage.jsx";
import ProductsPricingPage from "./OrderHub/Admin/ProductsPricing/ProductsPricingPage.jsx";
import PromotionsPage from "./OrderHub/Admin/Promotions/PromotionsPage.jsx";
import SalesReportingPage from "./OrderHub/Admin/SalesReporting/SalesReportingPage.jsx";
import AccountingInvoicesPage from "./OrderHub/Admin/AccountingInvoices/AccountingInvoicesPage.jsx";
import CreditControlPage from "./OrderHub/Admin/CreditControl/CreditControlPage.jsx";
import PurchaseOrdersPage from "./OrderHub/Admin/PurchaseOrders/PurchaseOrdersPage.jsx";
import GoodsReceiptingPage from "./OrderHub/Admin/GoodsReceipting/GoodsReceiptingPage.jsx";
import StockExpiryPage from "./OrderHub/Admin/StockExpiry/StockExpiryPage.jsx";
import DemandForecastingPage from "./OrderHub/Admin/DemandForecasting/DemandForecastingPage.jsx";
import AuditLogPage from "./OrderHub/Admin/AuditLog/AuditLogPage.jsx";
import AiIdeasPage from "./OrderHub/Admin/AiIdeas/AiIdeasPage.jsx";
import ContactSupportPage from "./OrderHub/Admin/ContactSupport/ContactSupportPage.jsx";

export const pageRegistry = {
  Dashboard: DashboardPage,

  // Sales module
  Customers: CustomersPage,
  Quotes: QuotesPage,
  "Retainer Invoices": RetainerInvoicesPage,
  "Sales Orders": SalesOrdersPage,
  Invoices: InvoicesPage,
  "Recurring Invoices": RecurringInvoicesPage,
  "Delivery Challans": DeliveryChallansPage,
  "Payments Received": PaymentsReceivedPage,
  "Customer Payments": PaymentsReceivedPage, // sidebar label (Sales > Customers group)
  "Credit Notes": CreditNotesPage,
  "Credit Aging Report": CreditAgingReportPage, // Sales & Invoice > Credit Aging Report
  "Client Credit Aging": CreditAgingReportPage, // Order Hub > Area Manager > Client Credit Aging (same page)

  // Order Hub - Client Portal
  "Client Dashboard": ClientDashboardPage,
  "Place Order": PlaceOrderPage,
  "My Invoices": MyInvoicesPage,
  "Account Statement": AccountStatementPage,
  "My Offers": MyOffersPage,
  "My Details": MyDetailsPage,
  "Client Demo Script": ClientDemoScriptPage,

  // Order Hub - Area Manager
  "Manager Dashboard": ManagerDashboardPage,
  "Register a Visit": RegisterVisitPage,
  "Client Orders": ClientOrdersPage,
  "Client Invoices": ClientInvoicesPage,
  "Client Account Statement": ManagerAccountStatementPage, // NEW: manager picks a client from a dropdown
  "Manager Reports": ManagerReportsPage, // NEW
  "Place Order for Client": PlaceOrderForClientPage,
  "Manager Demo Script": ManagerDemoScriptPage,

  // Order Hub - Fulfilment & Logistics
  Orders: OrdersPage,
  "POD Matching": PodMatchingPage,
  "POD Auto-Match (AI)": PodAutoMatchPage,
  "POD Auto-Match": PodAutoMatchPage, // the sidebar menu label is "POD Auto-Match" (without "(AI)")
  Backorders: BackordersPage,
  "Live Managers": LiveManagersPage, // NEW
  "Shipping (DPD)": ShippingPage,
  "Admin Demo Script": AdminDemoScriptPage,

  // Order Hub - Sales & Marketing
  "Products & Services": ProductsPricingPage, // sidebar label (renamed from "Products & Pricing")
  "Products & Pricing": ProductsPricingPage, // old name kept so anything still using it keeps working
  Promotions: PromotionsPage,
  "Sales Reporting": SalesReportingPage,

  // Order Hub - Finance & Credit
  "Accounting / Invoices": AccountingInvoicesPage,
  "Credit Control": CreditControlPage,

  // Order Hub - Supply Chain (Purchase Orders / Goods Received live under the existing Purchasing menu)
  "Purchase Orders": PurchaseOrdersPage,
  "Goods Received": GoodsReceiptingPage,
  "Stock & Expiry": StockExpiryPage,
  "Demand Forecasting (AI)": DemandForecastingPage,

  // Order Hub - System & Admin
  "Audit Log": AuditLogPage,
  "AI Automation Ideas": AiIdeasPage,
  "Contact Support": ContactSupportPage,

  // Settings & Administration
  "Invoice Templates": InvoiceTemplatesPage,
};