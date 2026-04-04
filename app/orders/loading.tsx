export default function OrdersLoading() {
  return (
    <div style={{ background: '#F5F8F8', minHeight: '100vh' }}>
      <div className="page-header" style={{ background: 'linear-gradient(160deg, #232E2E 0%, #3A4A4A 100%)', minHeight: 100 }} />
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3].map(i => (
          <div key={i} className="card" style={{ overflow: 'hidden' }}>
            <div className="skeleton" style={{ height: 44, borderRadius: 0 }} />
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(j => <div key={j} className="skeleton" style={{ height: 40, borderRadius: 10 }} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
