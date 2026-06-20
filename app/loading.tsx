export default function Loading() {
  return (
    <main className="loading-shell" aria-label="正在加载数据仪表盘">
      <div className="loading-rail" />
      <section className="loading-content">
        <div className="skeleton skeleton-title" />
        <div className="loading-cards">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton skeleton-card" key={index} />
          ))}
        </div>
        <div className="skeleton skeleton-chart" />
      </section>
    </main>
  );
}

