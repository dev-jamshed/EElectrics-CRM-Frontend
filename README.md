# E Electrics CRM - Modern Frontend

> React 18 Single Page Application built with Vite, TypeScript, Tailwind CSS, TanStack React Query, and an Apple-inspired glassmorphism design system.

---

## 1. Overview & Architecture

The frontend provides an intuitive, high-performance interface for managing electrical contracting operations:
- **Dashboard:** Interactive KPI cards, 12-month revenue chart, and daily work queue.
- **Documents:** Full lifecycle management for Bookings, Quotations, and Invoices with line item editors and live pricing calculations.
- **Clients:** Directory of clients with linked case files and document history.
- **Mailbox:** Integrated desktop-grade email client with thread browsing, reply composer, and real-time SSE stream for instant inbox alerts.
- **Settings:** Company identity management (NAPIT accreditation, address, phone), profile editing, and team user management.
- **Public Booking Confirmation:** Customer-facing portal allowing clients to review and confirm bookings.

---

## 2. Directory Layout

```
EElectrics-CRM-Frontend/
├── src/
│   ├── main.tsx                # Entry point, QueryClientProvider, router setup
│   ├── index.css               # Apple design system CSS variables & base styles
│   ├── app/
│   │   ├── router.tsx          # React Router v6 route configuration
│   │   └── shell.tsx           # Frosted glass sidebar and sticky top header
│   ├── components/
│   │   ├── ui/                 # Reusable Shadcn UI primitives (button, badge, dialog, etc.)
│   │   ├── compose-email-dialog.tsx
│   │   ├── pdf-preview-dialog.tsx
│   │   └── notification-toaster.tsx
│   ├── features/
│   │   ├── auth/               # Login page & AuthProvider token context
│   │   ├── dashboard/          # DashboardPage & OverviewPage
│   │   ├── documents/          # Documents list, editor form, detail view
│   │   ├── clients/            # Client list & ClientDetailPage
│   │   ├── mailbox/            # Webmail client (threads, reply composer)
│   │   ├── bookings/           # BookingConfirmationPage (public portal)
│   │   ├── settings/           # SettingsPage (profile, NAPIT, team accounts)
│   │   └── templates/          # Canned response snippets
│   ├── lib/
│   │   ├── api.ts              # Axios instance and typed crmApi methods
│   │   └── utils.ts            # Class name helper (clsx + twMerge)
│   └── types/
│       └── crm.ts              # Core TypeScript types (Document, Client, LineItem...)
```

---

## 3. Environment Configuration

Check `EElectrics-CRM-Frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```
*(Ensure the port matches your running backend instance).*

---

## 4. Running the Frontend

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 5. UI & Design System

The application uses a custom **Apple-Inspired Design Language**:
- **Canvas:** Soft off-white `#f5f5f7`.
- **Card Surfaces:** Translucent cards with `bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl shadow-apple`.
- **Brand Red Accent:** `#ef1228` used for key action buttons and active navigation states.
- **Status Badges:** Low-saturation translucent pills (`bg-emerald-500/10 text-emerald-600 border border-emerald-500/20`).

For the complete UI guide and component patterns, see [`../UI_DESIGN_SYSTEM.md`](../UI_DESIGN_SYSTEM.md).
