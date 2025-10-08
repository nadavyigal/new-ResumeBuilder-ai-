
import React from 'react';
export default function Resume({ data }) {
  const b = data.basics || {};
  return (<html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{`Resume - ${b.name||''}`}</title>
    <style>{`
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 40px; color: #111; }
      h1 { margin: 0; font-size: 28px; } h2 { margin-top: 18px; font-size: 18px; border-bottom: 1px solid #ddd; }
    `}</style></head><body>
    <h1>{b.name}</h1><div>{b.title}</div>
    <h2>Summary</h2><p>{(data.summary || '').trim()}</p>
  </body></html>);
}