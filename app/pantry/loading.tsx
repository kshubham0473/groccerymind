export default function PantryLoading() {
  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh' }}>
      <div className="page-header" style={{ background: 'linear-gradient(160deg, #3A2A1E 0%, #5C4A3A 100%)', minHeight: 100 }} />
      <div className="page-body">
        <div className="skeleton" style={{ height: 44, borderRadius: 12, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 32, width: 80, borderRadius: 99 }} />)}
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="card" style={{ marginBottom: 16, padding: '12px 12px 20px' }}>
            <div className="skeleton" style={{ height: 10, width: '30%', marginBottom: 12 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[1,2,3,4].map(j => <div key={j} className="skeleton" style={{ height: 32, width: 80, borderRadius: 10 }} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
