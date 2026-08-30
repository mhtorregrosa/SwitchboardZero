import type { DistrictStatus, LineStatus, SimulationState } from '../domain/types'

const statusLabel: Record<DistrictStatus, string> = {
  online: 'ONLINE',
  brownout: 'BROWNOUT',
  offline: 'OFFLINE',
}

const lineLabel: Record<LineStatus, string> = {
  online: 'energized',
  standby: 'standby',
  faulted: 'faulted',
  isolated: 'isolated',
}

export function GridMap({ state }: { state: SimulationState }) {
  return (
    <div className="map-frame" aria-label="Live fictional city power grid">
      <div className="map-toolbar">
        <span className="eyebrow">LIVE NETWORK</span>
        <span className="map-clock">T+{String(state.minute).padStart(2, '0')}:00</span>
      </div>
      <svg className="grid-map" viewBox="0 0 800 540" role="img" aria-labelledby="grid-title grid-description">
        <title id="grid-title">Switchboard Zero city grid</title>
        <desc id="grid-description">A fictional power network showing energy sources, district status and a damaged East Ring feeder.</desc>
        <defs>
          <pattern id="small-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" className="map-grid-small" />
          </pattern>
          <pattern id="large-grid" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect width="120" height="120" fill="url(#small-grid)" />
            <path d="M 120 0 L 0 0 0 120" className="map-grid-large" />
          </pattern>
          <filter id="soft-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="storm-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#ff5c5c" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ff5c5c" stopOpacity="0.24" />
            <stop offset="1" stopColor="#ff5c5c" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="800" height="540" rx="18" fill="url(#large-grid)" />
        <path d="M0 52 C180 88 250 22 410 55 S690 104 800 58" className="storm-band" />
        <text x="34" y="42" className="map-sector-label">SECTOR 04 / FICTIONAL MUNICIPAL GRID</text>

        <g className="grid-lines">
          {state.lines.map((line) => (
            <g key={line.id}>
              <path
                d={line.path}
                className={`grid-line grid-line--${line.status}`}
                aria-label={`${line.label}: ${lineLabel[line.status]}`}
              />
              {line.status === 'online' && <path d={line.path} className="grid-line-flow" />}
            </g>
          ))}
        </g>

        <g className="source source--turbine" transform="translate(105 145)">
          <circle r="31" className="source-halo source-halo--online" />
          <circle r="20" className="source-core source-core--online" />
          <path d="M-8 6 L0-10 L8 6 Z" className="source-glyph" />
          <text y="45" textAnchor="middle" className="node-label">HARBOR</text>
          <text y="58" textAnchor="middle" className="node-sub">52 MW</text>
        </g>

        <g className="source source--battery" transform="translate(112 407)">
          <circle r="31" className={`source-halo source-halo--${state.sources.find((item) => item.id === 'battery')?.status}`} />
          <rect x="-18" y="-14" width="36" height="28" rx="5" className={`source-core source-core--${state.sources.find((item) => item.id === 'battery')?.status}`} />
          <rect x="18" y="-5" width="5" height="10" rx="2" className="source-glyph-fill" />
          <path d="M-7 1 L1-10 L0-2 L8-2 L-1 10 L0 2 L-7 2 Z" className="source-glyph" />
          <text y="45" textAnchor="middle" className="node-label">RESERVE</text>
          <text y="58" textAnchor="middle" className="node-sub">24 MW</text>
        </g>

        <g className="source source--solar" transform="translate(745 505)">
          <circle r="24" className={`source-halo source-halo--${state.sources.find((item) => item.id === 'solar')?.status}`} />
          <circle r="13" className={`source-core source-core--${state.sources.find((item) => item.id === 'solar')?.status}`} />
          <path d="M0-20V-27M0 20V27M-20 0H-27M20 0H27M-14-14L-19-19M14 14L19 19M14-14L19-19M-14 14L-19 19" className="source-rays" />
          <text x="-36" y="-34" textAnchor="middle" className="node-label">SOLAR</text>
        </g>

        <g className="substation" transform="translate(260 255)">
          <circle r="35" className="substation-ring" />
          <circle r="14" className="substation-core" filter="url(#soft-glow)" />
          <path d="M-7-3H7M-7 3H7M0-10V10" className="substation-glyph" />
          <text y="52" textAnchor="middle" className="node-label">CORE BUS</text>
        </g>

        {state.districts.map((district) => (
          <g
            key={district.id}
            className={`district district--${district.status}`}
            transform={`translate(${district.x} ${district.y})`}
          >
            <circle r="29" className="district-pulse" />
            <circle r="22" className="district-node" />
            {district.critical && <path d="M0-12 L10-6 L8 8 L0 14 L-8 8 L-10-6 Z" className="critical-shield" />}
            {!district.critical && <circle r="6" className="district-dot" />}
            <g transform="translate(-47 34)">
              <rect width="94" height="37" rx="6" className="district-label-bg" />
              <text x="47" y="15" textAnchor="middle" className="district-name">{district.shortName}</text>
              <text x="47" y="29" textAnchor="middle" className="district-status">{statusLabel[district.status]}</text>
            </g>
          </g>
        ))}

        <g transform="translate(350 497)" className="legend">
          <circle cx="0" cy="0" r="5" className="legend-online" /><text x="11" y="4">ONLINE</text>
          <circle cx="84" cy="0" r="5" className="legend-brownout" /><text x="95" y="4">BROWNOUT</text>
          <circle cx="194" cy="0" r="5" className="legend-offline" /><text x="205" y="4">OFFLINE</text>
          <path d="M280 0 H304" className="legend-fault" /><text x="313" y="4">FAULT</text>
        </g>
      </svg>
      <div className="map-coordinate">47.219° N / SIMULATION ONLY</div>
    </div>
  )
}
