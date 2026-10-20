import L from 'leaflet'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { HealthUnit, QueueStatus } from '../lib/types'
import { CROWD, UNIT_TYPE_COLOR, UNIT_TYPE_LABEL, effectiveLevel } from '../lib/utils'

const LETTER: Record<HealthUnit['type'], string> = { UBS: 'U', UPA: '!', HOSPITAL: 'H', CLINICA: 'C', LABORATORIO: 'L' }

function icon(unit: HealthUnit, queue: QueueStatus | undefined) {
  const color = UNIT_TYPE_COLOR[unit.type]
  const crowd = CROWD[effectiveLevel(queue)].color
  return L.divIcon({
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
    html: `<div style="position:relative;width:36px;height:44px">
      <svg viewBox="0 0 36 44" width="36" height="44"><path d="M18 1C8.6 1 1 8.4 1 17.6 1 30 18 43 18 43s17-13 17-25.4C35 8.4 27.4 1 18 1Z" fill="${color}" stroke="#fff" stroke-width="2"/></svg>
      <span style="position:absolute;top:7px;left:0;width:36px;text-align:center;color:#fff;font:700 15px Lexend,sans-serif">${LETTER[unit.type]}</span>
      <span style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:99px;background:${crowd};border:2px solid #fff"></span>
    </div>`,
  })
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

export function UnitMap({
  units,
  queues,
  center,
  height = 320,
  zoom = 13,
}: {
  units: HealthUnit[]
  queues: QueueStatus[]
  center: { lat: number; lng: number }
  height?: number
  zoom?: number
}) {
  return (
    <div className="overflow-hidden rounded-3xl ring-1 ring-linha" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} aria-label="Mapa de unidades de saúde">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter lat={center.lat} lng={center.lng} />
        <CircleMarker center={[center.lat, center.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1D74C0', fillOpacity: 1 }} />
        {units.map((u) => {
          const q = queues.find((x) => x.unitId === u.id)
          return (
            <Marker key={u.id} position={[u.lat, u.lng]} icon={icon(u, q)} title={u.name}>
              <Popup>
                <strong>{u.name}</strong>
                <br />
                {UNIT_TYPE_LABEL[u.type]} · {CROWD[effectiveLevel(q)].label}
                <br />
                <Link to={`/unidades/${u.id}`}>Ver detalhes</Link>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export function MapLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-tinta-suave">
      {(Object.keys(UNIT_TYPE_LABEL) as HealthUnit['type'][]).map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full" style={{ background: UNIT_TYPE_COLOR[t] }} />
          {UNIT_TYPE_LABEL[t]}
        </li>
      ))}
    </ul>
  )
}
