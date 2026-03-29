# **App Name**: Go Motel Management System (Hotel Du Manolo)

## Core Features:

- **Room Panel & Check-In/Out**: Manage room check-ins, extensions, and walk-ins. Track real-time availability (Occupied, Cleaning, Available, Maintenance).
- **POS & Billing system**: Integrated Point of Sale for direct staff purchases. Calculates bills based on room rates, ordered services, taxes, splitting payment methods (Cash, SINPE, Card).
- **Public TV Menu & Auto-Serve**: Digital public menu for in-room TVs. Auto-serve, QR-based mobile ordering system for tables and rooms with real-time tracking of item preparation status.
- **Kitchen & Bar Queue System**: Dedicated screens for preparation staff to manage incoming orders, track preparation times, and deliver items efficiently.
- **Inventory & Catalog Management**: Centralized catalog of products and services. Automatic stock deduction upon sales. Registration of supplier purchase invoices.
- **Administration & Settings Command Center**: High-level settings dashboard to establish Room Types, manage Business Information, customize the Public Landing Page (CMS), configure global Tax settings, set custom Alarm Sounds, and control general system features (like Dark Mode overrides).
- **Realtime Sync**: Firebase Firestore integration for reactive, instantaneous updates across all screens (POS, Kitchen, Room Dashboard, and Public Client devices) without refreshing.
- **Role-based Auth**: Restricts views dynamically based on user role (Administrator, Reception, Kitchen/Bar, Concierge, Accountant).

## Style & UX Guidelines:

- **Primary aesthetic**: Premium Dark Theme focusing on sleekness, luxury, and contrast. Uses deep neutrals (Tailwind `neutral-900`, `neutral-950`) as primary backgrounds.
- **Accent Color**: Vivid Purple/Primary (e.g., `#8B5CF6`) applied to interactive elements like buttons, active states, and glowing accents to convey a modern, neon-like premium hospitality vibe.
- **Typography**: Clean, robust sans-serif (Inter) using heavy font-weights (`font-black`) for headers and titles (`uppercase tracking-widest`) to create a structured, "high-level" layout.
- **Glassmorphism & Shadows**: Heavy use of semi-transparent backgrounds (`bg-neutral-900/40 backdrop-blur`), subtle inner rings/borders (`ring-white/5`), and smooth glowing hover transitions (`hover:shadow-primary/20`) to create depth.
- **Interactive Feedback**: Every actionable element (cards, buttons, items) must possess tactile micro-animations (`hover:scale-[1.02]`, `active:scale-95`, smooth `transition-all duration-300`) to enrich the user experience and feel responsive.
- **Responsiveness**: All interfaces from the POS to the Public Order menu must gracefully adapt to ultra-narrow mobile viewports (e.g. 280px width) up to ultra-wide desktop monitors, leveraging fluid grid layouts and Tailwind utility states.