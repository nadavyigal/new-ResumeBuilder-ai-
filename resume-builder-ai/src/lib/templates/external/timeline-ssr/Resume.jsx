
import React from 'react';
export default function Resume({ data }) {
  const b = data.basics || {};
  return (<html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{`Resume - ${b.name||''}`}</title>
    <style>{`
      body{font-family:system-ui,Arial,sans-serif;margin:40px}
      .line{border-left:3px solid #333;margin-left:10px;padding-left:16px}
      .item{margin:12px 0}
    `}</style></head><body>
    <h1>{b.name}</h1><div>{b.title}</div>
    <h2>Timeline</h2>
    <div className="line">
      {(data.experience||[]).map((e,i)=>(<div className="item" key={i}><strong>{e.start}–{e.end||'Present'}</strong> — {e.company}</div>))}
    </div>
  </body></html>);
}