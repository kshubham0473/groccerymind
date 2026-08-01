export default function DiscoverLoading() {
  return (
    <div style={{ background: '#F3F8FA', minHeight: '100vh' }}>
      <div className="page-header" style={{ background: 'linear-gradient(160deg, #0F3D4A 0%, #1A6B7A 100%)', minHeight: 100 }} />
      <div className="page-body">
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="skeleton" style={{ height: 34, borderRadius: 10, width: 180, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 44, borderRadius: 12, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="skeleton" style={{ height: 28, width: 80, borderRadius: 99 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 44, borderRadius: 12 }} />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 11, width: '85%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: '65%', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 99 }} />
              <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
