# Netlify Function Billing Investigation

## Problem Summary
- **Billing Period**: Function overage charge of $25.00
- **Total Invocations**: 906,701 function executions
- **Free Tier**: 125,000 invocations included
- **Overage**: 781,701 invocations (906,701 - 125,000)
- **Site ID**: `fb0513ca-dddd-4891-a9a2-934b0ce4f56b` (Note: This appears to be the site ID, not a specific function ID)

## Functions Analysis

### High-Frequency Functions (Most Likely Culprits)

1. **`getVisitorCount`** - Called on every page load
   - Location: `src/bridges/RetroCounterWrapper.jsx`
   - Has client-side caching (24 hours)
   - **Risk**: If cache fails or is cleared, this could be called frequently
   - **MongoDB Query**: Aggregation pipeline to count unique visitors

2. **`getVisitorDocuments`** - Called on every simulation start
   - Location: `src/App.svelte` line 312-315
   - Has server-side caching (6 hours)
   - **Risk**: If many users start simulations, this could add up quickly
   - **MongoDB Query**: Complex aggregation pipeline

3. **`createVisitorDocument`** - Called on page load and restart
   - Location: `src/App.svelte` line 181 and 616
   - **Risk**: Called twice per user session (page load + restart)
   - **MongoDB Query**: Simple insert operation

4. **`updateVisitorDocument`** - Called once per simulation end
   - Location: `src/App.svelte` line 500
   - **Risk**: One call per completed simulation
   - **MongoDB Query**: Update operation

### Other Functions (Lower Frequency)

- `validateUser` - Called on page load if user is logged in
- `getHighScore` - Called when needed
- `setHighScore` - Called when user submits high score
- `getLeaderboard` - Called when viewing leaderboard (has 6-hour cache)
- `getUserStats` - Called when viewing stats page
- `getAllUsers` - Called when viewing stats page

## Recommendations

### Immediate Actions

1. **Add Response Caching Headers** to reduce function invocations:
   - `getVisitorCount` should have a longer cache (24+ hours server-side)
   - Consider using Netlify's Edge Functions or CDN caching

2. **Implement Rate Limiting** or request deduplication for:
   - `getVisitorCount` - Very unlikely to change frequently
   - `getVisitorDocuments` - Already has 6-hour cache, but could be improved

3. **Check for Bot Traffic**:
   - 906,701 invocations suggests ~30,000 invocations per day
   - If you have 1,000 daily visitors, that's 30 invocations per visitor
   - This seems high - check for bots, crawlers, or polling

### Code Improvements

1. **`getVisitorCount` Optimization**:
   ```javascript
   // Add longer cache headers
   headers: {
     'Cache-Control': 'public, max-age=86400', // 24 hours
     'X-Cache-Date': new Date().toISOString()
   }
   ```

2. **Reduce `getVisitorDocuments` calls**:
   - Only call when chart data is actually needed
   - Consider lazy loading instead of pre-fetching on simulation start

3. **Add Request Deduplication**:
   - Use a simple in-memory cache with TTL for frequently called functions
   - Prevent multiple simultaneous requests for the same data

### Monitoring

1. **Enable Netlify Analytics** to see which functions are called most
2. **Add logging** to track function invocation patterns
3. **Set up alerts** for function invocation spikes

## Next Steps

1. Check Netlify dashboard analytics to identify the exact function causing the overage
2. Review server logs for patterns (bots, polling, etc.)
3. Implement caching improvements
4. Consider upgrading to Functions Pro if usage is legitimate and expected

## Notes

The billing message shows a site ID (`fb0513ca-dddd-4891-a9a2-934b0ce4f56b`) rather than a specific function ID. This suggests Netlify may be aggregating all function invocations for the site. To identify the specific function:

1. Check Netlify Dashboard → Functions → Analytics
2. Review function logs: `netlify logs:function <function-name>`
3. Look for patterns in invocation times and frequencies

