
import { useState, useEffect, useMemo } from 'react'
import {
  Warehouse,
  Search,
  QrCode,
  Layers,
  X,
  Plus,
  Minus,
  Trash2,
  WrenchIcon
} from 'lucide-react'

// =============================
// RoomCRIB — Refactor v2 (IDs globales por material + ubicaciones múltiples)
// =============================
export default function App() {
  // -----------------------------
  // 1) Carga / Migración de datos
  // -----------------------------

  const migrateFromV1IfNeeded = () => {
    const v2MaterialsRaw = localStorage.getItem('roomcrib-materials')
    const v2StorageRaw = localStorage.getItem('roomcrib-storage-v2')

    // Si ya existe v2, úsalo y sal
    if (v2MaterialsRaw && v2StorageRaw) {
      try {
        return {
          materials: JSON.parse(v2MaterialsRaw) ?? {},
          storage: JSON.parse(v2StorageRaw) ?? {},
        }
      } catch {
        // Si falla el parseo, continúa para regenerar estructura limpia
      }
    }


    
    // Si existe el esquema antiguo, migrar
    const legacyRaw = localStorage.getItem('roomcrib-storage')
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw)
        /**
         * legacy:
         * {
         *   'NEGRO-1': [ { id, name, current, ideal }, ... ],
         *   ...
         * }
         *
         * v2:
         * materials: { MAT-0001: { id, name, ideal }, ... }
         * storage:   { 'NEGRO-1': [ { materialId: 'MAT-0001', current }, ... ] }
         */
        const nameToId = new Map()
        const materials = {}
        const storage = {}
        let seq = Number(localStorage.getItem('last-mat-id') || 0)

        const getIdForName = (name, ideal) => {
          if (nameToId.has(name)) return nameToId.get(name)
          seq += 1
          const id = `MAT-${String(seq).padStart(4, '0')}`
          nameToId.set(name, id)
          materials[id] = { id, name, ideal: Number(ideal) || 0 }
          return id
        }

        Object.entries(legacy).forEach(([locId, items]) => {
          storage[locId] = (items || []).map((m) => ({
            materialId: getIdForName(m?.name ?? 'SIN NOMBRE', m?.ideal ?? 0),
            current: Number(m?.current) || 0,
          }))
        })

        localStorage.setItem('last-mat-id', String(seq))
        localStorage.setItem('roomcrib-materials', JSON.stringify(materials))
        localStorage.setItem('roomcrib-storage-v2', JSON.stringify(storage))

        return { materials, storage }
      } catch {
        // Si falla la migración, seguimos a semilla por defecto
      }
    }

    // Semilla por defecto (similar a tu demo original)
    const materials = {}
    const storage = {
      'NEGRO-1': [],
      'NEGRO-2': [],
      'NEGRO-3': [],
      'NEGRO-4': [],
      'GRIS-1': [],
      'GRIS-2': [],
      'BLANCO-1': [],
      'BLANCO-2': [],
      'BLANCO-3': [],
    }

    // Creamos algunos materiales de ejemplo y los ubicamos en gabinetes
    const seed = [
      { name: 'Tornillos M8', ideal: 500, locs: [['NEGRO-1', 450]] },
      { name: 'Tuercas M8',  ideal: 500, locs: [['NEGRO-2', 120]] },
      { name: 'Cable Cobre 2mm', ideal: 50, locs: [['GRIS-1', 15]] },
      { name: 'Interruptores', ideal: 25, locs: [['GRIS-2', 30]] },
      { name: 'Pintura Blanca 5L', ideal: 10, locs: [['BLANCO-1', 12]] },
      { name: 'Disolvente', ideal: 15, locs: [['BLANCO-2', 3]] },
    ]

    let seq = Number(localStorage.getItem('last-mat-id') || 0)
    const makeId = () => {
      seq += 1
      const id = `MAT-${String(seq).padStart(4, '0')}`
      return id
    }

    seed.forEach(s => {
      const id = makeId()
      materials[id] = { id, name: s.name, ideal: s.ideal }
      s.locs.forEach(([loc, qty]) => {
        storage[loc].push({ materialId: id, current: qty })
      })
    })

    localStorage.setItem('last-mat-id', String(seq))
    localStorage.setItem('roomcrib-materials', JSON.stringify(materials))
    localStorage.setItem('roomcrib-storage-v2', JSON.stringify(storage))

    return { materials, storage }
  }

  const initial = useMemo(migrateFromV1IfNeeded, [])

  const [materials, setMaterials] = useState(initial.materials)
  const [storage, setStorage] = useState(initial.storage)



  
  // Persistencia
  useEffect(() => {
    localStorage.setItem('roomcrib-materials', JSON.stringify(materials))
  }, [materials])
  useEffect(() => {
    localStorage.setItem('roomcrib-storage-v2', JSON.stringify(storage))
  }, [storage])

  // -----------------------------
  // 2) UI state
  // -----------------------------
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [logs, setLogs] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMaterial, setNewMaterial] = useState({ name: '', current: 'actual', ideal: 'meta' })
  const [existingIdToAdd, setExistingIdToAdd] = useState('')

  const addLog = (message, type = 'change') => {
    const logEntry = {
      time: new Date().toLocaleTimeString(),
      msg: message,
      type,
    }
    setLogs((prev) => [logEntry, ...prev].slice(0, 8))
  }

  // -----------------------------
  // 3) Utilidades
  // -----------------------------
  const generateMaterialId = () => {
    const last = Number(localStorage.getItem('last-mat-id') || 0) + 1
    localStorage.setItem('last-mat-id', String(last))
    return `MAT-${String(last).padStart(4, '0')}`
  }

// Usa la meta local (por gaveta) si existe; si no, cae a la global del material
const getIdealFor = (locItem) => {
  if (locItem && Object.prototype.hasOwnProperty.call(locItem, 'ideal')) {
    return Math.max(0, Number(locItem.ideal) || 0);
  }
  const m = getMaterial(locItem.materialId);
  return Math.max(0, Number(m?.ideal) || 0);
};
  
  const getMaterial = (materialId) => materials[materialId]

  const getProgress = (locItem) => {
  const ideal = getIdealFor(locItem);
  if (!ideal) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((Number(locItem.current) / Number(ideal)) * 100))
  );
};

const getStockColor = (locItem) => {
  const ideal = getIdealFor(locItem);
  if (!ideal) return 'text-white';
  const ratio = Number(locItem.current) / Number(ideal);
  if (ratio <= 0.3) return 'text-red-400';
  if (ratio < 1) return 'text-amber-300';
  return 'text-emerald-400';
};

  const findMaterialLocations = (materialId) => {
    return Object.entries(storage)
      .filter(([_, items]) => (items || []).some((i) => i.materialId === materialId))
      .map(([cab]) => cab)
  }

  // -----------------------------
  // 4) Acciones
  // -----------------------------
  const handleScanSimulation = () => {
    setIsScanning(true)
    setSearchTerm('')
    setTimeout(() => {
      const allLocations = Object.keys(storage)
      const randomLoc = allLocations[Math.floor(Math.random() * allLocations.length)]
      setSelectedLocation(randomLoc)
      setSearchTerm(randomLoc)
      setIsScanning(false)
      addLog(`QR Detectado: ${randomLoc}`, 'info')
    }, 1000)
  }

  const updateStock = (locId, materialId, amount) => {
    setStorage((prev) => {
      const list = prev[locId] || []
      const updated = list.map((entry) => {
        if (entry.materialId === materialId) {
          const newCount = Math.max(0, Number(entry.current) + Number(amount))
          const m = getMaterial(materialId)
          addLog(`${amount > 0 ? 'Entrada' : 'Salida'}: ${m?.name ?? materialId}`)
          return { ...entry, current: newCount }
        }
        return entry
      })
      return { ...prev, [locId]: updated }
    })
  }

const updateMaterialIdeal = (materialId, newIdeal) => {
  const value = Math.max(0, Number(newIdeal) || 0)
  setMaterials(prev => ({
    ...prev,
    [materialId]: {               // ✅ clave dinámica
      ...prev[materialId],        // ✅ mantenemos el resto de propiedades del material
      ideal: value,               // ✅ actualizamos meta global
    },
  }))
  addLog(`Meta actualizada (${materialId}) = ${value}`)
}  

  const addNewMaterialToLoc = () => {
    if (!newMaterial.name || !selectedLocation) return

    const id = generateMaterialId()

    // 1) catálogo global
    setMaterials((prev) => ({
      ...prev,
      [id]: {
        id,
        name: newMaterial.name,
        ideal: Math.max(0, Number(newMaterial.ideal) || 0),
      },
    }))

    

    // 2) relación en gabinete
    setStorage((prev) => ({
      ...prev,
      [selectedLocation]: [
        ...(prev[selectedLocation] || []),
        { materialId: id, current: Math.max(0, Number(newMaterial.current) || 0) },
      ],
    }))

    addLog(`Nuevo material ${id} en ${selectedLocation}`)
    setNewMaterial({ name: '', current: 0, ideal: 0 })
    setShowAddForm(false)
  }

  const addExistingMaterialToLoc = () => {
    const id = existingIdToAdd.trim().toUpperCase()
    if (!id || !materials[id] || !selectedLocation) return

    setStorage((prev) => ({
      ...prev,
      [selectedLocation]: [
        ...(prev[selectedLocation] || []),
        { materialId: id, current: 0 },
      ],
    }))
    addLog(`Material existente ${id} vinculado a ${selectedLocation}`)
    setExistingIdToAdd('')
  }

  const deleteMaterialFromCabinet = (locId, materialId) => {
    setStorage((prev) => ({
      ...prev,
      [locId]: (prev[locId] || []).filter((i) => i.materialId !== materialId),
    }))
    addLog(`Item removido de ${locId}`, 'warning')
  }

  const updateLocationIdeal = (locId, materialId, newIdeal) => {
  const value = Math.max(0, Number(newIdeal) || 0);
  setStorage((prev) => {
    const list = prev[locId] ?? [];
    const updated = list.map((entry) => (
      entry.materialId === materialId ? { ...entry, ideal: value } : entry
    ));
    return { ...prev, [locId]: updated };
  });
  addLog(`Meta local actualizada (${materialId} @ ${locId}) = ${value}`);
};

  // -----------------------------
  // 5) Secciones/gabinetes
  // -----------------------------
  const cabinetSections = [
    { title: 'Gabinetes Negros', color: 'bg-black', text: 'text-gray-300', count: 4, prefix: 'NEGRO' },
    { title: 'Gabinetes Grises', color: 'bg-gray-700', text: 'text-gray-100', count: 2, prefix: 'GRIS' },
    { title: 'Maquinas CoilShop', color: 'bg-white', text: 'text-gray-800', count: 3, prefix: 'BLANCO' },
  ]

  // -----------------------------
  // 6) Búsqueda (por gabinete, por nombre o por ID MAT-xxxx)
  // -----------------------------
  const term = (searchTerm || '').trim().toLowerCase()

  const materialMatches = useMemo(() => {
    if (!term) return []
    // Busca en catálogo global
    return Object.values(materials)
      .filter(m => (m.name || '').toLowerCase().includes(term) || (m.id || '').toLowerCase().includes(term))
      .map(m => ({ material: m, locations: findMaterialLocations(m.id) }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, materials, storage])

  // -----------------------------
  // 7) Render
  // -----------------------------
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0b0c0f] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center opacity-10 select-none"
      >
        <img
          src="/Carrier_amarillo_WOB.png"
          alt="carrier watermark"
          className="wm-animate w-[50vmin]"
          style={{ animation: 'watermarkPulse 8s ease-in-out infinite' }}
        />
      </div>

      {/* Background FX */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.06] [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:22px_22px]" />
        {/* animated gradient blobs */}
        <div className="absolute -top-20 -left-20 w-[40rem] h-[40rem] rounded-full blur-3xl opacity-30 bg-gradient-to-tr from-yellow-500/40 via-amber-400/20 to-transparent animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-[42rem] h-[42rem] rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-amber-500/30 via-yellow-400/10 to-transparent animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      {/* Local styles */}
      <style>{`
        ::selection{ background: rgba(250, 204, 21, 0.25); }
        .glass{ backdrop-filter: blur(14px); background: rgba(17,17,19,0.55); }
        .glass-strong{ backdrop-filter: blur(18px); background: rgba(17,17,19,0.7); }
        .neon-border{ box-shadow: 0 0 0 1px rgba(253, 224, 71, 0.16), 0 0 24px rgba(253, 224, 71, 0.18); }
        .neon-border-strong{ box-shadow: 0 0 0 1px rgba(253, 224, 71, 0.35), 0 0 36px rgba(253, 224, 71, 0.35); }
        .lift{ transition: transform .25s ease, box-shadow .25s ease; }
        .lift:hover{ transform: translateY(-4px) scale(1.02); }
        .tilt:hover{ transform: perspective(900px) rotateX(1.5deg) rotateY(-1.5deg) scale(1.02); }
        /* Minimal scrollbar */
        .custom-scrollbar{ scrollbar-width: thin; scrollbar-color: #3f3f46 transparent; }
        .custom-scrollbar::-webkit-scrollbar{ width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track{ background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb{ background: #3f3f46; border-radius: 9999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover{ background: #52525b; }
        @keyframes watermarkPulse {
          0% { transform: scale(0.97); opacity: 1.10; }
          50% { transform: scale(1.73); opacity: 1.65; }
          100% { transform: scale(0.97); opacity: 1.10; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wm-animate { animation: none !important; }
        }
      `}</style>

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="glass neon-border rounded-3xl p-6 md:p-7 mb-8 border border-yellow-400/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-5">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-400 p-3 rounded-2xl shadow-[0_0_24px_rgba(253,224,71,0.55)]">
                <WrenchIcon className="w-8 h-8 text-gray-900" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight italic">
                  Room<span className="text-yellow-400 not-italic">CRIB</span>
                </h1>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.3em]">
                  ToolRoom CMX-G
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar por gabinete, material o ID (p.ej. MAT-0003)"
                  className="w-full glass-strong border border-yellow-400/10 text-white text-sm rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-300/40"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button
                onClick={handleScanSimulation}
                className={`relative overflow-hidden flex items-center gap-2 px-5 py-3 rounded-xl font-black transition-all lift ${
                  isScanning
                    ? 'bg-amber-600 text-white animate-pulse'
                    : 'bg-gradient-to-tr from-yellow-400 to-amber-300 text-gray-900 hover:to-yellow-300'
                }`}
              >
                <div className="absolute inset-0 opacity-0 hover:opacity-30 transition-opacity bg-[radial-gradient(120px_60px_at_var(--x,50%)_var(--y,50%),rgba(255,255,255,0.6),transparent_60%)]" />
                <QrCode className="w-5 h-5" />
                <span className="hidden sm:inline">{isScanning ? 'ESCANEANDO...' : 'SCAN QR'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Cabinets */}
          <div className="lg:col-span-8 space-y-8">
            {cabinetSections.map((section) => {
              const filteredCabinets = Array.from({ length: section.count })
                .map((_, i) => `${section.prefix}-${i + 1}`)
                .filter((id) => {
                  if (!term) return true

                  // 1) Coincide por ID de gabinete
                  const matchCabinet = id.toLowerCase().includes(term)

                  // 2) Coincide por materiales contenidos
                  const items = storage[id] || []
                  const matchMaterial = items.some((locItem) => {
                    const m = getMaterial(locItem.materialId) || {}
                    return (
                      (m.name || '').toLowerCase().includes(term) ||
                      (m.id || '').toLowerCase().includes(term)
                    )
                  })

                  return matchCabinet || matchMaterial
                })

              if (filteredCabinets.length === 0) return null

              return (
                <div key={section.title} className="glass border border-yellow-400/10 neon-border rounded-2xl p-6">
                  <h2 className="text-sm font-black flex items-center gap-3 text-yellow-400 uppercase italic mb-6">
                    <Layers className="w-4 h-4" /> {section.title}
                  </h2>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {filteredCabinets.map((id) => (
                      <button
                        key={id}
                        onClick={() => setSelectedLocation(id)}
                        className={`relative h-32 rounded-2xl border transition-all tilt ${
                          selectedLocation === id
                            ? 'border-yellow-400/60 ring-2 ring-yellow-400/40 scale-[1.02] shadow-[0_0_35px_rgba(253,224,71,0.25)]'
                            : 'border-yellow-400/10 hover:border-yellow-400/30 hover:shadow-[0_0_20px_rgba(253,224,71,0.15)]'
                        } ${section.color} ${section.text}`}
                      >
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-black/30 mix-blend-overlay" />
                        <div className="absolute top-2 left-3 text-[9px] font-black uppercase opacity-50">
                          {id}
                        </div>
                        <div className="flex flex-col items-center justify-center h-full relative z-[1]">
                          <span className="font-black text-3xl text-white drop-shadow">{(storage[id] || []).length}</span>
                          <span className="text-[9px] uppercase font-bold tracking-widest mt-1 opacity-70">Materiales</span>
                        </div>
                        <div className="absolute -inset-px rounded-2xl pointer-events-none border border-yellow-400/10" />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: Detail + Logs */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-strong rounded-2xl border border-yellow-400/10 neon-border-strong shadow-2xl sticky top-4 min-h-[300px]">
              {selectedLocation ? (
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-yellow-400/10 pb-4">
                    <h3 className="text-xl font-black italic">
                      CRIB <span className="text-yellow-400">{selectedLocation}</span>
                    </h3>
                    <button onClick={() => setSelectedLocation(null)} className="p-1 hover:bg-white/5 rounded-full">
                      <X className="w-6 h-6 text-gray-400" />
                    </button>
                  </div>


                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {(storage[selectedLocation] || []).length > 0 ? (
                      (storage[selectedLocation] || []).map((locItem) => {
                        const m = getMaterial(locItem.materialId)
                        return (
                          <div key={`${selectedLocation}-${locItem.materialId}`} className="rounded-xl border border-yellow-400/10 bg-black/40 p-4 group">
                            <div className="flex justify-between mb-2">
                              <div>
                                <h4 className="font-black text-yellow-400 text-sm uppercase">{m?.name ?? locItem.materialId}</h4>
                                <p className="text-[10px] text-gray-500">ID: {m?.id ?? locItem.materialId}</p>
                              </div>
                              <button onClick={() => deleteMaterialFromCabinet(selectedLocation, locItem.materialId)} className="text-gray-600 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-end justify-between mb-3">
  <span className={`text-3xl font-black ${getStockColor(locItem)}`}>
    {locItem.current}
  </span>

  {/* Editor de meta (ideal) */}
  <div className="flex items-center gap-2">
    <label className="text-xs text-gray-400">Meta:</label>
    <input
      type="number"
      className="w-20 bg-black/50 border border-white/10 rounded p-1 text-white text-xs text-right focus:ring-2 focus:ring-yellow-400/40"
      value={getIdea(locItem.materialId)?.ideal ?? 0}
      onChange={(e) => updateMaterialIdeal(locItem.materialId, e.target.value)}
      min={0}
    />
  </div>
</div>

{/* Editor de meta (ideal) — usa meta local */}
<div className="flex items-center gap-2">
  <label className="text-xs text-gray-400">Meta:</label>
  <input
    type="number"
    className="w-20 bg-black/50 border border-white/10 rounded p-1 text-white text-xs text-right focus:ring-2 focus:ring-yellow-400/40"
    value={getIdealFor(locItem)}
    onChange={(e) => updateLocationIdeal(selectedLocation, locItem.materialId, e.target.value)}
    min={0}
  />
</div>





                            {/* Progress */}
                            <div className="w-full bg-gray-800/70 rounded-full h-2">
                              <div
                                className="h-2 bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400 rounded-full transition-all"
                                style={{ width: `${getProgress(locItem)}%` }}
                              />
                            </div>

                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => updateStock(selectedLocation, locItem.materialId, 1)}
                                className="flex-1 bg-gradient-to-tr from-yellow-400 to-amber-300 text-gray-900 p-2 rounded-lg flex justify-center font-bold hover:to-yellow-300 transition-colors"
                              >
                                
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateStock(selectedLocation, locItem.materialId, -1)}
                                className="flex-1 bg-white/5 p-2 rounded-lg border border-white/10 flex justify-center hover:bg-white/10 transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })
                      
                    ) : (
                      <div className="text-center py-10 text-gray-500 font-black uppercase text-[10px] tracking-[0.2em] border-2 border-dashed border-white/10 rounded-xl">
                        Vacío
                      </div>
                    )}
                  </div>



                  {!showAddForm ? (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="w-full border-2 border-dashed border-yellow-400/20 p-4 rounded-xl text-gray-400 hover:text-yellow-300 font-black text-[10px] uppercase"
                    >
                      Nuevo Item
                    </button>
                  ) : (
                    <div className="bg-white/5 border border-white/10 p-5 rounded-xl space-y-4">
                      <input
                        className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs outline-none focus:ring-2 focus:ring-yellow-400/40"
                        placeholder="Nombre..."
                        value={newMaterial.name}
                        onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs focus:ring-2 focus:ring-yellow-400/40"
                          placeholder="Actual"
                          value={newMaterial.current}
                          onChange={(e) => setNewMaterial({ ...newMaterial, current: e.target.value })}
                        />
                        <input
                          type="number"
                          className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs focus:ring-2 focus:ring-yellow-400/40"
                          placeholder="Meta de stock"
                          value={newMaterial.ideal}
                          onChange={(e) => setNewMaterial({ ...newMaterial, ideal: e.target.value })}
                        />
                      </div>
                      <button
                        onClick={addNewMaterialToLoc}
                        className="w-full bg-gradient-to-tr from-yellow-400 to-amber-300 text-gray-900 p-2 rounded font-black text-xs uppercase hover:to-yellow-300"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => { setShowAddForm(false); setNewMaterial({ name: '', current: 0, ideal: 0 }) }}
                        className="w-full mt-2 bg-white/5 p-2 rounded font-black text-xs uppercase border border-white/10 hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Vincular material existente por ID */}
                  <div className="bg-white/5 border border-white/10 p-5 rounded-xl space-y-3">
                    <p className="text-xs text-gray-400">Agregar material existente por ID (p.ej. MAT-0001)</p>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-black/50 border border-white/10 rounded p-2 text-white text-xs outline-none focus:ring-2 focus:ring-yellow-400/40"
                        placeholder="ID del material"
                        value={existingIdToAdd}
                        onChange={(e) => setExistingIdToAdd(e.target.value)}
                      />
                      <button
                        onClick={addExistingMaterialToLoc}
                        className="bg-gradient-to-tr from-yellow-400 to-amber-300 text-gray-900 px-3 rounded font-black text-xs uppercase hover:to-yellow-300"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  {/* Resultados de búsqueda por material */}
                  {term && materialMatches.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Resultados</h3>
                      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {materialMatches.map(({ material, locations }) => (
                          <div key={material.id} className="rounded-xl border border-yellow-400/10 bg-black/40 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-black text-yellow-400 text-sm uppercase">{material.name}</h4>
                                <p className="text-[10px] text-gray-500">ID: {material.id} • Meta: {material.ideal}</p>
                              </div>
                            </div>
                            <div className="mt-3 text-xs text-gray-400">Ubicado en:</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {locations.length > 0 ? (
                                locations.map((loc) => (
                                  <button
                                    key={`${material.id}-${loc}`}
                                    onClick={() => setSelectedLocation(loc)}
                                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                                  >
                                    {loc}
                                  </button>
                                ))
                              ) : (
                                <span className="text-[11px] text-amber-300">Sin ubicación</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center opacity-80">
                      <Warehouse className="w-16 h-16 text-yellow-400 drop-shadow-[0_0_24px_rgba(253,224,71,0.45)]" />
                      <p className="font-black uppercase text-[10px] tracking-[0.4em] mt-4 text-gray-300">RoomCRIB Ready</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="glass rounded-2xl border border-yellow-400/10 p-5">
              <h3 className="text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Registro</h3>
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`text-[11px] border-l-2 pl-3 py-1 ${
                      log.type === 'info' ? 'border-blue-500/60' : 'border-yellow-400/80'
                    }`}
                  >
                    <span className="text-gray-500 mr-2 font-mono">{log.time}</span>
                    <span className="text-gray-200 font-semibold uppercase tracking-wide">{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

