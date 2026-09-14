Scaffold a new screen for DesignFlow AI called: $ARGUMENTS

Follow CLAUDE.md conventions:
1. Check docs/PRODUCT_SPEC.md for the screen's intended content and place in the flow.
2. Create the page component under src/pages/, using existing pages as a style reference.
3. Add the route to src/routes/index.tsx if it isn't already there.
4. Pull data through a service function in src/services/ — never call supabase.from() directly
   from the component. Add the service function if it doesn't exist yet.
5. Model loading/success/error/empty states explicitly (AsyncState<T> from src/types/common.ts).
6. Reuse src/components/ui primitives; only add a new one if nothing fits.
7. Run `npm run typecheck` and `npm run lint` before reporting done.
8. Report which files you changed and anything left stubbed.
