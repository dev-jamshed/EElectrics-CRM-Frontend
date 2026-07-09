import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { DocumentsPage } from "@/features/documents/documents-page";
import { DocumentFormPage } from "@/features/documents/document-form-page";
import { DocumentDetailPage } from "@/features/documents/document-detail-page";
import { ClientsPage } from "@/features/clients/clients-page";
import { ClientDetailPage } from "@/features/clients/client-detail-page";
import { LoginPage } from "@/features/auth/login-page";
import { CustomMailPage } from "@/features/custom-mails/custom-mail-page";
import { BookingConfirmationPage } from "@/features/bookings/booking-confirmation-page";
import { MailboxPage } from "@/features/mailbox/mailbox-page";
import { SettingsPage } from "@/features/settings/settings-page";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/booking-confirmation/:token", element: <BookingConfirmationPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "clients/:id", element: <ClientDetailPage /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "documents/new/:type", element: <DocumentFormPage /> },
      { path: "documents/:id", element: <DocumentDetailPage /> },
      { path: "documents/:id/edit", element: <DocumentFormPage /> },
      { path: "custom-mails", element: <CustomMailPage /> },
      { path: "mailbox", element: <MailboxPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/:section", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);
