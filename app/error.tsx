"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">DATA INTERRUPTED</p>
      <h1>数据暂时没有准备好</h1>
      <p>请稍后重试，或重新执行本地数据同步。</p>
      <button onClick={reset}>重新加载</button>
    </main>
  );
}

