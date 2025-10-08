
import React from 'react';
export default function Resume({ data }) {
  const b = data.basics || {};
  return (<html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{`Resume - ${b.name||''}`}</title>
    <style>{`
      body{font-family:system-ui,Arial,sans-serif;margin:40px;color:#111}
      .card{border:1px solid #eee;border-radius:8px;padding:12px;margin:10px 0;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04)}
      h1{margin:0} h2{margin-top:16px;font-size:16px;border-bottom:1px solid #eee}
    `}</style></head><body>
    <h1>{b.name}</h1><div>{b.title}</div>
    <h2>Summary</h2><div className="card">{(data.summary||'').trim()}</div>
  </body></html>);
}