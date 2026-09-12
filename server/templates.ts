
export type MobileTemplate = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  capabilities: string[];
};

export const MOBILE_TEMPLATES: MobileTemplate[] = [
  { id: "business-dashboard", name: "Business Dashboard", description: "KPI dashboard with authentication, role-aware navigation, charts, and activity.", prompt: "Build a production-ready business dashboard mobile app with secure login, role-aware navigation, KPI cards, charts, notifications, and an audit-friendly activity feed.", capabilities: ["Auth", "Analytics", "Notifications"] },
  { id: "inventory-pos", name: "Inventory + POS", description: "Fast retail workflow with products, stock, sales, customers, and offline-first UX planning.", prompt: "Build a retail inventory and POS mobile app with products, barcode scanning, stock levels, sales checkout, customers, receipts, offline-first behavior, and sync-safe data rules.", capabilities: ["Camera", "Offline", "Data"] },
  { id: "crm", name: "CRM", description: "Leads, contacts, tasks, notes, follow-ups, and pipeline management.", prompt: "Build a CRM mobile app with contacts, leads, pipeline stages, tasks, reminders, notes, search, filtering, and role-based access.", capabilities: ["CRM", "Search", "Reminders"] },
  { id: "booking", name: "Booking", description: "Service discovery, availability, booking, reminders, and customer history.", prompt: "Build a service booking mobile app with service catalog, provider availability, booking flow, rescheduling, cancellations, reminders, and customer history.", capabilities: ["Calendar", "Notifications", "Auth"] },
  { id: "school", name: "School Manager", description: "Students, attendance, fees, classes, notices, and parent communication.", prompt: "Build a school management mobile app with students, classes, attendance, fees, notices, parent communication, role-based access, and reporting.", capabilities: ["Roles", "Reports", "Messaging"] },
  { id: "fitness", name: "Fitness Tracker", description: "Plans, workouts, progress, reminders, and device-aware activity flows.", prompt: "Build a fitness tracking mobile app with onboarding, workout plans, progress tracking, reminders, charts, profile settings, and optional native device integrations behind verified contracts.", capabilities: ["Charts", "Reminders", "Native APIs"] },
];


