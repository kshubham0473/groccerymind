export default function DiscoverLoading() {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header" style={{ minHeight: 100 }} />
      <div className="page-body">
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="skeleton" style={{ height: 44, borderRadius: 12, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 28, width: 90, borderRadius: 99 }} />)}
          </div>
          <div className="skeleton" style={{ height: 44, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  )
}
