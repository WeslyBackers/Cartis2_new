import { format, subMonths, eachMonthOfInterval } from 'date-fns';

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

export function StatusChart({ tasks }: { tasks: any[] }) {
  const statusCounts = tasks.reduce((acc: any, task: any) => {
    const status = task.production_line_status || 'under_construction';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const data: ChartData[] = Object.entries(statusCounts).map(([label, value]) => ({
    label: label === 'completed' ? 'Afgerond' : label === 'rejected' ? 'Afgewezen' : 'In Behandeling',
    value: value as number,
    color: 
      label === 'completed' ? '#28a745' :
      label === 'rejected' ? '#dc3545' :
      '#ffc107'
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#343a40' }}>
        📊 Taak Status ({total})
      </h3>
      
      {total === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#6c757d' }}>
          Geen taken beschikbaar
        </div>
      ) : (
        <>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ margin: '0 auto' }}>
            {(() => {
              let currentAngle = 0;
              return data.map((item, index) => {
                if (item.value === 0) return null;
                const percentage = (item.value / total) * 100;
                const angle = (item.value / total) * 360;
                const startX = 100 + 90 * Math.cos((currentAngle * Math.PI) / 180);
                const startY = 100 + 90 * Math.sin((currentAngle * Math.PI) / 180);
                const endX = 100 + 90 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
                const endY = 100 + 90 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
                const largeArcFlag = angle > 180 ? 1 : 0;
                const pathData = `M 100 100 L ${startX} ${startY} A 90 90 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
                currentAngle += angle;
                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={item.color}
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{`${item.label}: ${item.value} (${percentage.toFixed(1)}%)`}</title>
                  </path>
                );
              });
            })()}
          </svg>
          
          <div style={{ marginTop: '1rem' }}>
            {data.map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: item.color, borderRadius: '3px', marginRight: '0.5rem' }} />
                <span style={{ fontSize: '0.9rem', color: '#343a40', flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#343a40' }}>
                  {item.value} ({((item.value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FlagsChart({ tasks }: { tasks: any[] }) {
  const data: ChartData[] = [
    { label: 'MSI Actief', value: tasks.filter((t: any) => t.msi_active).length, color: '#856404' },
    { label: 'Opvolging', value: tasks.filter((t: any) => t.needs_followup).length, color: '#004085' },
    { label: 'Extra Info', value: tasks.filter((t: any) => t.needs_extra_info).length, color: '#721c24' },
    { label: 'Geen Flags', value: tasks.filter((t: any) => !t.msi_active && !t.needs_followup && !t.needs_extra_info).length, color: '#28a745' },
  ];

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#343a40' }}>
        🚩 Taken per Flag
      </h3>
      
      {data.every(d => d.value === 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#6c757d' }}>
          Geen data beschikbaar
        </div>
      ) : (
        <div style={{ height: '250px', display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
          {data.map((item, index) => (
            <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '100%',
                  height: `${(item.value / maxValue) * 200}px`,
                  backgroundColor: item.color,
                  borderRadius: '4px 4px 0 0',
                  minHeight: item.value > 0 ? '4px' : '0',
                  transition: 'height 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                title={`${item.label}: ${item.value}`}
              >
                {item.value > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-25px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      color: '#343a40',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.value}
                  </span>
                )}
              </div>
              <span
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  color: '#6c757d',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
                title={item.label}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksOverTimeChart({ tasks }: { tasks: any[] }) {
  const monthlyData: { [key: string]: number } = {};
  const months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date()
  });

  months.forEach(month => {
    const key = format(month, 'yyyy-MM');
    monthlyData[key] = 0;
  });

  tasks.forEach((task: any) => {
    const taskDate = new Date(task.created_at);
    const key = format(taskDate, 'yyyy-MM');
    if (monthlyData.hasOwnProperty(key)) {
      monthlyData[key]++;
    }
  });

  const data = Object.entries(monthlyData).map(([date, value]) => ({ date, value }));
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#343a40' }}>
        📈 Taken in Tijd (laatste 12 maanden)
      </h3>
      
      {data.every(d => d.value === 0) ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#6c757d' }}>
          Geen data beschikbaar
        </div>
      ) : (
        <svg width="100%" height="200" viewBox="0 0 600 200" style={{ overflow: 'visible' }}>
          {[0, 25, 50, 75, 100].map((percent) => (
            <line
              key={percent}
              x1="0"
              y1={180 - (percent * 160) / 100}
              x2="600"
              y2={180 - (percent * 160) / 100}
              stroke="#e9ecef"
              strokeWidth="1"
            />
          ))}

          <polyline
            fill="none"
            stroke="#0066cc"
            strokeWidth="2"
            points={data.map((d, i) => {
              const x = (i / (data.length - 1 || 1)) * 580 + 10;
              const y = 180 - (d.value / maxValue) * 160;
              return `${x},${y}`;
            }).join(' ')}
          />

          {data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * 580 + 10;
            const y = 180 - (d.value / maxValue) * 160;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="#0066cc" cursor="pointer" />
                <title>{format(new Date(d.date), 'MMM yyyy')}: {d.value}</title>
              </g>
            );
          })}

          {data.map((d, i) => {
            const x = (i / (data.length - 1 || 1)) * 580 + 10;
            const monthDate = new Date(d.date);
            return (
              <text
                key={i}
                x={x}
                y="195"
                textAnchor="middle"
                fontSize="10"
                fill="#6c757d"
              >
                {format(monthDate, 'MMM')}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}