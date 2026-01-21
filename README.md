# LeadZupply AI

AI-powered catalog management system built with React + Vite + TypeScript + Tailwind CSS + shadcn/ui.

## Getting Started

```bash
npm install
npm run dev
```

## Supabase Configuration

Create a `.env` file with:

```
VITE_SUPABASE_URL=https://mhzpwpnjucrymblvjeno.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

## Edge Functions

Edge functions are in `supabase/functions/` and deployed to Supabase project ID: `mhzpwpnjucrymblvjeno`

### Required Secrets (in Supabase Dashboard)
- `LOVABLE_API_KEY` - For AI normalization features

## Deploy

This project is configured for Vercel deployment. Simply connect your GitHub repo to Vercel.
