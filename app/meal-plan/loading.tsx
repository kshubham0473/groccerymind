export default function MealPlanLoading() {
  return (
    <div style={{ background: '#F5F4EF', minHeight: '100vh' }}>
      <div className="page-header" style={{ background: 'linear-gradient(160deg, #2E3320 0%, #4A5240 100%)', minHeight: 100 }} />
      <div className="page-body" style={{ paddingTop: 0 }}>
        <div style={{ display: 'flex', gap: 8, padding: '16px 0', marginBottom: 4 }}>
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="skeleton" style={{ flexShrink: 0, width: 58, height: 52, borderRadius: 12 }} />
          ))}
        </div>
        {[1,2].map(i => (
          <div key={i} className="card" style={{ marginBottom: 14, height: 160, overflow: 'hidden' }}>
            <div className="skeleton" style={{ height: 44, margin: 0, borderRadius: 0 }} />
            <div style={{ padding: 12 }}>
              <div className="skeleton" style={{ height: 12, width: '70%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 10, width: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
