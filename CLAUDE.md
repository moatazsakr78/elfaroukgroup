# POS System Commands & Configuration

## Development Commands
- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks
- `npm run typecheck` - Run TypeScript checks

## Project Structure
```
pos-sys/
├── app/                    # Next.js 14 App Router
│   ├── (dashboard)/       # Dashboard layout group
│   │   ├── pos/          # POS page
│   │   ├── products/     # Products management page
│   │   ├── inventory/    # Inventory management page
│   │   ├── customers/    # Customers page
│   │   ├── suppliers/    # Suppliers page  
│   │   ├── records/      # Records dashboard page
│   │   ├── reports/      # Reports page (custom design)
│   │   └── permissions/  # Permissions page (custom design)
│   ├── components/       # Reusable components
│   │   ├── ui/          # Base UI components
│   │   ├── layout/      # Layout components
│   │   └── tables/      # Table components
│   ├── lib/             # Utility libraries
│   │   ├── supabase/    # Supabase client and utilities
│   │   ├── hooks/       # Custom React hooks
│   │   └── utils/       # Helper functions
│   ├── types/           # TypeScript type definitions
│   ├── globals.css      # Global styles with Tailwind
│   ├── layout.tsx       # Root layout with RTL support
│   └── page.tsx         # Homepage
├── ui-designs/           # UI design reference images
└── ...config files
```

## Database Schema
- **Supabase Project ID**: `qtixpwjpothwrosgorkn` (omelarosa)
- **Region**: eu-central-1
- **Status**: ACTIVE_HEALTHY
- **Database Version**: PostgreSQL 17.6.1.032

### Key Tables (27 total):
- `products` - Product catalog with pricing, barcodes, categories
- `customers` - Customer information with loyalty points, credit limits
- `suppliers` - Supplier management with account balances
- `sales` - Sales transactions with totals, tax, discounts
- `sale_items` - Individual items within sales transactions
- `inventory` - Stock tracking by product and branch
- `branches` - Store branch locations
- `categories` - Product categories
- `warehouses` - Warehouse management
- `orders` - Order management system
- `purchase_invoices` - Purchase transactions from suppliers
- `customer_payments` - Customer payment tracking
- `supplier_payments` - Supplier payment tracking
- `expenses` - Business expense tracking
- `records` - General record keeping
- `user_profiles` - User management and roles

**IMPORTANT**: No schema modifications allowed - read-only integration only.

## UI Design Requirements
- **Theme**: Dark theme with blue accents (#3B82F6)
- **Language**: Arabic RTL interface throughout
- **Font**: Cairo Arabic font family
- **Colors**:
  - Primary Dark: #2B3544
  - Darker: #1F2937
  - Blue: #3B82F6
  - Green: #10B981 (active status)
  - Red: #EF4444 (inactive status)
  - Orange: #F59E0B (warning)
  - Gray: #6B7280

### Design Compliance:
- **Exact pixel-perfect match** required for all pages
- Reference designs located in `/ui-designs/*.png`
- 7 provided designs: pos, menu, products, inventory, customers, suppliers, records
- 3 custom designs needed: dashboard, reports, permissions

### Scrollbar Styling:
- **All vertical scrollbars must be hidden** but remain functional
- Use `scrollbar-hide` class or equivalent CSS
- Apply to all containers with `overflow-y-auto`
- Maintain scrolling functionality without visual scrollbar
- Examples: `overflow-y-auto scrollbar-hide`

### Button Behavior:
- **All buttons must remain inactive** (visual only)
- No functionality until modal designs are provided
- Maintain proper styling and hover states
- Display placeholder text where appropriate

### Layout Restrictions:
- **IMPORTANT**: Do not use the blue TopHeader stripe in any store/admin product management pages
- The TopHeader component should be hidden for all admin product pages (`/admin/products`)
- Only use TopHeader for POS system pages, not for customer-facing store pages
- This ensures proper visibility of page-specific header designs (like the red header in admin products)

## Real-time Requirements
- **Visibility-aware subscriptions**: Handle browser tab minimize/restore
- **Reconnection logic**: Automatic reconnection on connection loss
- **Memory-only caching**: No localStorage or IndexedDB usage
- **CRUD stability**: All operations must work in all scenarios

## Egress Optimization Strategy
- Use `.webp` image formats only
- Selective field fetching from Supabase
- Implement pagination and lazy loading
- Memory-only caching with TTL limits
- Avoid unnecessary polling or redundant listeners
- Connection pooling and request batching
- Minimize subscription payload sizes

## Development Stages

### Stage 1: Foundation & Setup ✅
- [x] Next.js project initialization  
- [x] Supabase integration setup
- [x] Base component architecture
- [x] Real-time foundation

### Stage 2: Core Pages (UI Only)
- [ ] POS page with product table
- [ ] Inventory management page
- [ ] Navigation sidebar component

### Stage 3: Data Management Pages  
- [ ] Customers page
- [ ] Suppliers page
- [ ] Records dashboard page
- [ ] Data table components

### Stage 4: Missing Pages (Custom Design)
- [ ] Dashboard (analytics overview)
- [ ] Reports (sales/inventory reports)  
- [ ] Permissions (user access control)

### Stage 5: Real-time Integration
- [ ] Live data subscriptions
- [ ] Visibility-aware reconnection
- [ ] Optimized caching layer
- [ ] Performance optimization

## Environment Variables
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing Commands
```bash
# Run development server
npm run dev

# Check TypeScript compilation
npm run typecheck

# Lint code
npm run lint

# Build for production
npm run build
```

## Common Issues & Solutions

### RTL Layout Issues
- Ensure `dir="rtl"` is set on html element
- Use Tailwind RTL utilities (`mr-` instead of `ml-` for margins)
- Check Arabic font loading in browser dev tools

### Real-time Connection Issues
- Verify Supabase credentials in environment variables
- Check browser network tab for WebSocket connections
- Implement proper error handling and reconnection logic

### Performance Issues
- Monitor bundle size with `npm run build`  
- Check for memory leaks in React DevTools
- Optimize image sizes and formats

## Website Integration Architecture

### Dual System Approach
- **POS System**: High-performance admin/staff interface with real-time features
- **Website**: Customer-facing e-commerce with optimized egress and PWA support

### Device-Responsive Architecture
- **Server-side device detection** using User-Agent in getServerSideProps
- **Component mapping**:
  - Desktop: DesktopHome component
  - Tablet: TabletHome component  
  - Mobile: MobileHome component
- **PWA Support**: Offline capability, app-like experience on mobile devices

### Performance Strategy
- **Optimistic UI**: Instant visual feedback without real-time subscriptions
- **Minimal data fetching**: Only essential user data (name, email, cart contents)
- **Memory-only state**: No localStorage, optimized for 50k monthly users
- **Egress optimization**: Selective queries, efficient caching, minimal payloads

### Technical Implementation
- Pages Router for website (separate from App Router admin system)
- Device-specific components with shared business logic
- State management via useState/React Context for cart operations
- Server-side rendering for initial data loading

## PWA Configuration
- **Manifest**: App metadata, icons, theme colors
- **Service Worker**: Offline caching, background sync
- **Installable**: Add to homescreen functionality
- **Responsive**: Works across all device types

## Architecture Notes
- Uses Next.js 14 App Router (not Pages Router) for admin system
- Uses Pages Router for public website (separate architecture)
- TypeScript strict mode enabled
- Tailwind CSS with custom POS theme
- Supabase for real-time database operations
- Component-based architecture with reusable UI elements
- Memory-optimized for minimal resource usage