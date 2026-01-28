# FUIK Application Architecture

## Unified Portal System (Implemented 2026-01-28)

### Overview
The application uses a **Portal Selector** pattern where users log in once and choose which departmental portal to access.

### User Flow
```
/auth → Login
  ↓
/select-portal → Choose Portal
  ↓
/distribution, /import, /production, /hr, /admin, /driver
```

### Available Portals

| Portal | Path | Description |
|--------|------|-------------|
| Distribution | `/distribution/*` | Orders, picking, invoicing, customers, WhatsApp/Email inbox |
| Import | `/import/*` | CIF calculations, shipment tracking, supplier management |
| Production | `/production/*` | Production planning, bakery input, manufacturing |
| HR & Logistics | `/hr/*` | Time & attendance, employees, documents |
| Admin | `/admin/*` | Executive dashboard, user management, settings, integrations |
| Driver | `/driver` | Standalone mobile PWA for drivers |

### Key Architecture Decisions

1. **Portal Selector as Entry Point**: After login, all users (except drivers) land on `/select-portal` to choose their workspace.

2. **Role-Based Redirects**: 
   - Drivers automatically redirect to `/driver` (mobile PWA)
   - Admins see additional Admin section in portal selector
   
3. **Each Portal Has Its Own Layout**: 
   - Distribution → `DistributionLayout`
   - Import → `ImportLayout`
   - Production → `ProductionLayout`
   - HR → `HRLayout`
   - Admin → `AdminLayout`
   - Logistics uses its own driver-specific layouts

4. **No Legacy Routes**: All old root-level routes (`/orders`, `/customers`, `/products`, etc.) have been removed. Each feature now lives under its portal namespace.

5. **Consistent Navigation**: All portals have a "Portal Selector" back button to return to the main portal chooser.

### Admin Routes
All administrative functions are consolidated under `/admin`:
- `/admin` - Executive Dashboard
- `/admin/users` - User Management
- `/admin/activity` - User Activity Logs
- `/admin/reports` - Report Library
- `/admin/scheduled-reports` - Scheduled Reports
- `/admin/settings` - System Settings
- `/admin/integrations` - Integration Hub (Gmail, WhatsApp, QuickBooks, etc.)

### Files Structure
```
src/
├── pages/
│   ├── PortalSelector.tsx     # Main portal selection page
│   ├── fnb/                   # Distribution portal pages
│   ├── hr/                    # HR portal pages
│   └── integrations/          # Admin integration pages
├── layouts/
│   ├── AdminLayout.tsx        # Admin portal layout
│   ├── DistributionLayout.tsx
│   ├── ImportLayout.tsx
│   ├── ProductionLayout.tsx
│   ├── HRLayout.tsx
│   └── LogisticsLayout.tsx
└── App.tsx                    # Clean route definitions
```

### Removed Files (Legacy)
- `src/pages/Index.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/DriverPortal.tsx`
- `src/components/mobile/BottomNavigation.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/AppSidebar.tsx`

### Next Steps for Native App
With the web version now having a single, consistent architecture:
1. All business logic is properly organized by department
2. Mobile-responsive layouts are in place for each portal
3. PWA features (offline, install prompts) already implemented
4. Ready for Capacitor wrapping for native iOS/Android

---

# Previous Plan: Enhanced Team Visibility for Dre WhatsApp System
(Completed - See FnbDreCommandCenter.tsx for implementation)
