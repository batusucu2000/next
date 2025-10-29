# AI Agent Instructions for physio-next

## Project Overview
This is a Next.js 16.0 application that integrates with Supabase as its backend database service. The project uses TypeScript and follows the Next.js 13+ App Router pattern.

## Key Architecture Components

### Frontend (Next.js)
- Uses App Router architecture (`app/` directory)
- Client components are marked with `'use client'` directive
- TailwindCSS is used for styling

### Backend Integration (Supabase)
- Supabase client is initialized in `lib/supabaseClient.js`
- Environment variables required:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Data Flow Patterns
1. Database queries are made directly from React components using the Supabase client
2. Example query pattern from `app/page.tsx`:
   ```typescript
   const { data, error } = await supabase.from('slots').select('*')
   ```

## Key Files and Their Purpose
- `app/page.tsx`: Main page component, demonstrates Supabase query pattern
- `lib/supabaseClient.js`: Supabase client configuration
- `app/layout.tsx`: Root layout component

## Development Workflow

### Local Development
```bash
npm run dev
```
The development server runs on http://localhost:3000

### Build Process
```bash
npm run build
npm start
```

## Project-Specific Conventions
1. **State Management**: Uses React's built-in hooks (useState, useEffect)
2. **Error Handling**: Errors are caught and displayed in UI with crimson color
3. **Loading States**: Components handle loading states explicitly

## TypeScript Configuration
- Strict mode is enabled
- Next.js types are included via `next-env.d.ts`

## Common Tasks
1. **Adding a New Page**:
   - Create new file in `app/` directory
   - Use `'use client'` for client components
   - Follow error/loading state pattern from `page.tsx`

2. **Database Queries**:
   - Import Supabase client: `import { supabase } from '@/lib/supabaseClient'`
   - Use in async functions with error handling
   - Remember to handle loading states

## Known Limitations
- Currently limited to fetching first 10 slots in main page query
- Turkish language strings are hardcoded in components

## Best Practices
1. Always handle loading and error states
2. Use TypeScript for type safety
3. Keep Supabase queries in client components
4. Follow existing error handling patterns