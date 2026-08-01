// Renders instantly before dashboard JS hydrates — eliminates perceived navigation lag
export default function DashboardLoading() {
  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="page-header" style={{ minHeight: 100 }} />
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ height: 80 }}>
          <div className="skeleton" style={{ height: 12, width: '60%', margin: '16px 16px 8px' }} />
          <div className="skeleton" style={{ height: 10, width: '40%', margin: '0 16px' }} />
        </div>
        <div className="card" style={{ height: 100 }}>
          <div className="skeleton" style={{ height: 12, width: '40%', margin: '16px 16px 8px' }} />
          <div className="skeleton" style={{ height: 10, width: '70%', margin: '0 16px 8px' }} />
          <div className="skeleton" style={{ height: 10, width: '50%', margin: '0 16px' }} />
        </div>
        <div className="card" style={{ height: 80 }}>
          <div className="skeleton" style={{ height: 12, width: '30%', margin: '16px 16px 8px' }} />
          <div className="skeleton" style={{ height: 10, width: '55%', margin: '0 16px' }} />
        </div>
      </div>
    </div>
  )
}
