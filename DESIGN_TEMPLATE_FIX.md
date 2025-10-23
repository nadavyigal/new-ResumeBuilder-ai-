# Design Template Fix Summary

## Problem
The external resume templates (card-ssr, minimal-ssr, sidebar-ssr, timeline-ssr) return full HTML documents with `<html>`, `<head>`, and `<body>` tags. These cannot be rendered directly in a React component without causing:

1. React hydration errors
2. Hooks count mismatch errors when switching between templates
3. "Cannot destructure property 'data'" errors when props are null

## Root Causes
1. **Templates designed for PDF generation**: These templates were designed for server-side rendering to generate complete HTML pages for PDF conversion, not for embedding in React apps.
2. **Hooks violations**: Attempting to use iframe rendering with `useEffect` and conditional returns violated React's Rules of Hooks.
3. **Props handling**: Templates don't have default parameters for `data` and `customization` props.

## Solutions Attempted
1. ✅ Added default parameters `data = {}` and `customization = {}` to source templates
2. ❌ Tried rendering with iframe using `renderToStaticMarkup` - caused hooks violations
3. ❌ Fixed hooks order - still causing errors during template switching

## Recommended Solution
Create wrapper components for external templates that extract only the body content and render it without the `<html>/<head>/<body>` tags.

Or use server-side rendering API endpoint to generate HTML and display in iframe without client-side React rendering.

## Status
- 406 Error: ✅ FIXED
- Template default parameters: ✅ FIXED in source
- Template rendering: ❌ STILL BROKEN - needs wrapper components or server-side approach
