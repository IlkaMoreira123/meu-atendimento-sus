import { Crosshair, MapPin } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { NEIGHBORHOODS } from '../data/demo'
import { onlyDigits } from '../lib/utils'
import { Button, inputClass } from './ui'

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Localização por GPS (com autorização) ou por bairro/CEP digitado. */
export function LocationPicker() {
  const { location, setLocation } = useApp()
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState<'gps' | 'manual' | null>(null)

  function useGps() {
    if (!('geolocation' in navigator)) {
      setMsg('Este aparelho não permite localização. Digite seu bairro ou CEP.')
      return
    }
    setLoading('gps')
    setMsg(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Sua localização atual', precise: true })
        setLoading(null)
      },
      () => {
        setMsg('Não recebemos autorização para usar sua localização. Digite seu bairro ou CEP.')
        setLoading(null)
      },
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  async function manual(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setLoading('manual')
    setMsg(null)
    let bairro = value
    const cep = onlyDigits(value)
    if (cep.length === 8) {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
        const data = (await r.json()) as { bairro?: string; erro?: boolean }
        if (data.erro || !data.bairro) {
          setMsg('CEP não encontrado. Confira os números ou digite o bairro.')
          setLoading(null)
          return
        }
        bairro = data.bairro
      } catch {
        setMsg('Não foi possível consultar o CEP agora. Digite o bairro.')
        setLoading(null)
        return
      }
    }
    const match = NEIGHBORHOODS.find((n) => normalize(n.name).includes(normalize(bairro)) || normalize(bairro).includes(normalize(n.name)))
    if (match) {
      setLocation({ lat: match.lat, lng: match.lng, label: match.name, precise: false })
      setText('')
    } else {
      setMsg(`Ainda não temos o bairro "${bairro}" na base de demonstração. Tente: ${NEIGHBORHOODS.slice(0, 3).map((n) => n.name).join(', ')}.`)
    }
    setLoading(null)
  }

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-linha">
      <p className="flex items-center gap-2 font-bold">
        <MapPin className="size-5 text-azul-500" aria-hidden /> Perto de: <span className="font-normal">{location.label}</span>
      </p>
      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <Button type="button" variant="secondary" onClick={useGps} loading={loading === 'gps'} className="md:w-auto">
          <Crosshair className="size-5" aria-hidden /> Usar minha localização
        </Button>
        <form onSubmit={manual} className="flex flex-1 gap-2">
          <label htmlFor="loc-text" className="sr-only">
            Bairro, endereço ou CEP
          </label>
          <input id="loc-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Bairro ou CEP" className={inputClass} />
          <Button type="submit" loading={loading === 'manual'}>
            Usar
          </Button>
        </form>
      </div>
      {msg && (
        <p className="mt-2 text-sm font-bold text-red-700" role="alert">
          {msg}
        </p>
      )}
    </div>
  )
}
