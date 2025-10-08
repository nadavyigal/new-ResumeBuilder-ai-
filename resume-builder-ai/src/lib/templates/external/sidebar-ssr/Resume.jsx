
import React from 'react';
export default function Resume({ data }) {
  const b = data.basics || {};
  return (<html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{`Resume - ${b.name||''}`}</title>
    <style>{`
      body{margin:0;display:grid;grid-template-columns:280px 1fr;min-height:100vh;font-family:system-ui,Arial,sans-serif}
      aside{background:#f7f7f8;padding:24px} main{padding:32px}
      h1{margin:0 0 4px} h2{margin:16px 0 8px;border-bottom:1px solid #eee}
    `}</style></head><body>
    <aside><h1>{b.name}</h1><div>{b.title}</div></aside>
    <main><h2>Summary</h2><p>{(data.summary||'').trim()}</p></main>
  </body></html>);
}