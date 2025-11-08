
import React, { useState, useRef, useMemo } from 'react';
import { Vehicle, Part, Synergy } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { generateSynergyFromDescription } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';


declare const XLSX: any;

const VehicleManager: React.FC<{ vehicles: Vehicle[]; setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>> }> = ({ vehicles, setVehicles }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setFeedback(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    throw new Error("El archivo está vacío o no contiene datos válidos.");
                }

                const firstRowKeys = Object.keys(json[0]);
                const brandKey = firstRowKeys.find(k => k.trim().toLowerCase() === 'marca');
                const modelKey = firstRowKeys.find(k => k.trim().toLowerCase() === 'modelo');
                const segmentKey = firstRowKeys.find(k => k.trim().toLowerCase() === 'segmento');

                if (!brandKey || !modelKey) {
                    throw new Error("El archivo Excel debe contener las columnas 'marca' y 'modelo'. Verifique las cabeceras.");
                }

                const partColumns = firstRowKeys.filter(key => {
                    const lowerKey = key.trim().toLowerCase();
                    return lowerKey !== 'marca' && 
                           lowerKey !== 'modelo' && 
                           lowerKey !== 'segmento';
                });

                if (partColumns.length === 0) {
                    throw new Error("No se encontraron columnas de repuestos. Asegúrese de que el archivo tenga columnas para los repuestos después de 'marca', 'modelo' y 'segmento'.");
                }

                const newVehicles: Vehicle[] = [];
                json.forEach((row, rowIndex) => {
                    const brand = row[brandKey];
                    const model = row[modelKey];
                    const segment = segmentKey ? row[segmentKey] : undefined;

                    if (!brand || !model || String(brand).trim() === '' || String(model).trim() === '') {
                        console.warn(`Fila ${rowIndex + 2} ignorada por falta de valor en marca o modelo.`);
                        return;
                    }

                    const vehicleParts: Part[] = [];
                    partColumns.forEach((partName, partIndex) => {
                        const baseTimeValue = row[partName];
                        if (baseTimeValue !== null && baseTimeValue !== undefined && String(baseTimeValue).trim() !== '') {
                            const timeString = String(baseTimeValue).replace(',', '.');
                            const parsedTime = parseFloat(timeString);

                            if (!isNaN(parsedTime) && parsedTime > 0) {
                                vehicleParts.push({
                                    id: `p_import_${rowIndex}_${partIndex}_${partName.trim().replace(/\s+/g, '')}`,
                                    name: partName.trim(),
                                    baseTime: parsedTime,
                                });
                            }
                        }
                    });

                    if (vehicleParts.length > 0) {
                        newVehicles.push({
                            id: `v_import_${rowIndex}_${String(brand).trim().replace(/\s+/g, '')}_${String(model).trim().replace(/\s+/g, '')}`,
                            brand: String(brand).trim(),
                            model: String(model).trim(),
                            segment: segment ? String(segment).trim() : undefined,
                            parts: vehicleParts,
                        });
                    }
                });
                
                if (newVehicles.length === 0) {
                    throw new Error("No se pudo procesar ningún vehículo del archivo. Verifique el formato y los datos. Asegúrese de que las celdas de tiempo contengan números válidos (ej. 2.5 o 2,5).");
                }

                setVehicles(newVehicles);
                setFeedback({ type: 'success', message: `${newVehicles.length} vehículos y sus repuestos han sido importados exitosamente.` });

            } catch (error: any) {
                console.error("Error al procesar el archivo:", error);
                setFeedback({ type: 'error', message: error.message || 'Error al procesar el archivo. Verifique el formato y las columnas.' });
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };

        reader.onerror = () => {
             setFeedback({ type: 'error', message: 'Error al leer el archivo.' });
             setIsProcessing(false);
        }

        reader.readAsArrayBuffer(file);
    };
    
    const handleExport = () => {
        if (vehicles.length === 0) {
            setFeedback({ type: 'error', message: "No hay vehículos para exportar." });
            return;
        }
        setFeedback(null);

        try {
            const allPartNames = [...new Set(vehicles.flatMap(v => v.parts.map(p => p.name)))].sort();
            
            const dataToExport = vehicles.map(vehicle => {
                const row: {[key: string]: any} = {
                    'marca': vehicle.brand,
                    'modelo': vehicle.model,
                    'segmento': vehicle.segment || '',
                };
                
                const vehiclePartsMap = new Map(vehicle.parts.map(p => [p.name, p.baseTime]));
                
                for (const partName of allPartNames) {
                    row[partName] = vehiclePartsMap.get(partName) || '';
                }
                
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Vehiculos');
            
            XLSX.writeFile(wb, 'plantilla_vehiculos_repuestos.xlsx');
            setFeedback({ type: 'success', message: "Exportación completada exitosamente." });
        } catch (error) {
            console.error("Error al exportar el archivo:", error);
            setFeedback({ type: 'error', message: "Ocurrió un error durante la exportación." });
        }
    };

    return (
        <div className="p-4 bg-gray-800 rounded">
            <h3 className="text-xl font-bold mb-2 text-yellow-400">Gestionar Vehículos y Repuestos</h3>
            <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                <h4 className="font-semibold text-gray-200">Importar/Exportar desde Excel</h4>
                <p className="text-sm text-gray-400 mt-1 mb-4">
                    Reemplaza la base de datos actual al importar. El archivo debe tener las columnas: <code className="bg-gray-700 p-1 rounded text-xs">marca</code>, <code className="bg-gray-700 p-1 rounded text-xs">modelo</code>, <code className="bg-gray-700 p-1 rounded text-xs">segmento</code> (opcional), y una columna por cada repuesto. Exporte para generar una plantilla.
                </p>
                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileImport}
                        ref={fileInputRef}
                        className="hidden"
                        id="file-upload"
                        disabled={isProcessing}
                    />
                    <label
                        htmlFor="file-upload"
                        className={`inline-block cursor-pointer rounded-md px-4 py-2 font-semibold transition duration-150 ${isProcessing ? 'bg-gray-600 text-gray-400' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}
                    >
                        {isProcessing ? 'Procesando...' : 'Importar Archivo...'}
                    </label>
                    <button
                        onClick={handleExport}
                        className="inline-block cursor-pointer rounded-md px-4 py-2 font-semibold transition duration-150 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-600"
                        disabled={vehicles.length === 0}
                    >
                        Exportar a Excel
                    </button>
                </div>

                {feedback && (
                    <p className={`mt-4 text-sm font-medium ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.message}
                    </p>
                )}
            </div>
        </div>
    );
};

const SynergyModal: React.FC<{ 
    synergy: Partial<Synergy> | null; 
    allPartNames: string[];
    onClose: () => void;
    onSave: (synergy: Omit<Synergy, 'id'> & { id?: string }) => void;
}> = ({ synergy, allPartNames, onClose, onSave }) => {
    const [name, setName] = useState(synergy?.name || '');
    const [partNames, setPartNames] = useState<string[]>(synergy?.partNames || []);
    const [timeReduction, setTimeReduction] = useState(synergy?.timeReduction || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || partNames.length < 2 || timeReduction <= 0) {
            alert("Por favor, complete todos los campos. Se requieren al menos 2 repuestos y una reducción de tiempo mayor a cero.");
            return;
        }
        onSave({ id: synergy?.id, name, partNames, timeReduction });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl border border-yellow-400">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h4 className="text-xl font-bold text-yellow-400 mb-4">{synergy?.id ? 'Editar Sinergia' : 'Confirmar Nueva Sinergia'}</h4>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="synergy-name" className="block text-sm font-medium text-gray-300 mb-1">Nombre de la Sinergia</label>
                                <input id="synergy-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                            </div>
                            <div>
                                <label htmlFor="synergy-parts" className="block text-sm font-medium text-gray-300 mb-1">Repuestos Involucrados (Generado por IA, verifique la selección)</label>
                                <select id="synergy-parts" multiple value={partNames} onChange={e => setPartNames(Array.from(e.target.selectedOptions, option => option.value))} className="w-full h-48 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-400" >
                                    {allPartNames.map(partName => (
                                        <option key={partName} value={partName}>{partName}</option>
                                    ))}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="synergy-reduction" className="block text-sm font-medium text-gray-300 mb-1">Reducción de Tiempo (horas)</label>
                                <input id="synergy-reduction" type="number" step="0.01" min="0" value={timeReduction} onChange={e => setTimeReduction(parseFloat(e.target.value))} required className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Ej: 0.5"/>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 px-6 py-3 flex justify-end gap-4 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-gray-300 hover:bg-gray-700 transition">Cancelar</button>
                        <button type="submit" className="px-4 py-2 rounded-md bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AiSynergyCreator: React.FC<{
    allPartNames: string[];
    onSynergyGenerated: (synergyData: { name: string; partNames: string[] }) => void;
    onCancel: () => void;
}> = ({ allPartNames, onSynergyGenerated, onCancel }) => {
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        if (!description.trim()) {
            setError("Por favor, ingrese una descripción.");
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const result = await generateSynergyFromDescription(description, allPartNames);
            if (!result.partNames || result.partNames.length === 0) {
                 throw new Error("La IA no pudo identificar repuestos válidos en la descripción. Intente ser más específico o verifique los nombres.");
            }
            onSynergyGenerated(result);
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error al generar la sinergia.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-900 p-4 rounded-md border border-yellow-400 mt-4">
            <h4 className="font-semibold text-gray-200 flex items-center"><SparklesIcon className="w-5 h-5 mr-2 text-yellow-400"/>Crear Sinergia con IA</h4>
             <p className="text-sm text-gray-400 mt-1 mb-3">
                Describa la regla en lenguaje natural. La IA identificará los repuestos y creará un borrador de la regla para que usted la confirme.
            </p>
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ejemplo: Si se cambian los amortiguadores delanteros junto con las bieletas, se descuenta la mitad del tiempo de las bieletas."
                className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 h-24"
                disabled={isLoading}
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <div className="flex justify-end gap-4 mt-3">
                <button onClick={onCancel} disabled={isLoading} className="px-4 py-2 rounded-md text-gray-300 hover:bg-gray-700 transition">Cancelar</button>
                <button onClick={handleGenerate} disabled={isLoading} className="px-4 py-2 rounded-md bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition disabled:bg-gray-600">
                    {isLoading ? 'Generando...' : 'Generar Sinergia'}
                </button>
            </div>
        </div>
    );
}

const SynergyManager: React.FC<{ 
    synergies: Synergy[]; 
    setSynergies: React.Dispatch<React.SetStateAction<Synergy[]>>;
    vehicles: Vehicle[]
}> = ({ synergies, setSynergies, vehicles }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSynergy, setEditingSynergy] = useState<Partial<Synergy> | null>(null);
    const [isAiCreatorOpen, setIsAiCreatorOpen] = useState(false);

    const allPartNames = useMemo(() => {
        const uniquePartNames = new Set<string>();
        vehicles.forEach(v => v.parts.forEach(p => uniquePartNames.add(p.name)));
        return Array.from(uniquePartNames).sort();
    }, [vehicles]);

    const handleEdit = (synergy: Synergy) => {
        setEditingSynergy(synergy);
        setIsModalOpen(true);
    };

    const handleDelete = (synergyId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta sinergia?")) {
            setSynergies(prev => prev.filter(s => s.id !== synergyId));
        }
    };
    
    const handleAiSynergyGenerated = (data: { name: string; partNames: string[] }) => {
        const uniquePartNames = [...new Set(data.partNames)];

        if (uniquePartNames.length < 2) {
             alert("La IA no pudo encontrar al menos 2 repuestos válidos de la lista en su descripción. Por favor, intente de nuevo con nombres de repuestos más claros.");
             return;
        }

        setEditingSynergy({
            name: data.name,
            partNames: uniquePartNames,
        });
        setIsAiCreatorOpen(false);
        setIsModalOpen(true);
    };

    const handleSave = (synergyData: Omit<Synergy, 'id'> & { id?: string }) => {
        if (synergyData.id) {
            setSynergies(prev => prev.map(s => s.id === synergyData.id ? { ...s, ...synergyData } as Synergy : s));
        } else {
            setSynergies(prev => [...prev, { ...synergyData, id: `syn_${Date.now()}` }]);
        }
        setIsModalOpen(false);
        setEditingSynergy(null);
    };

    return <div className="p-4 bg-gray-800 rounded">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-yellow-400">Gestionar Sinergias (Predefinidas)</h3>
            <button onClick={() => setIsAiCreatorOpen(true)} className="px-4 py-2 rounded-md bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition">
                Agregar con IA
            </button>
        </div>
        
        {isAiCreatorOpen && (
            <AiSynergyCreator 
                allPartNames={allPartNames}
                onSynergyGenerated={handleAiSynergyGenerated}
                onCancel={() => setIsAiCreatorOpen(false)}
            />
        )}

        <div className="space-y-3 mt-4">
            {synergies.length > 0 ? (
                synergies.map(synergy => (
                    <div key={synergy.id} className="bg-gray-900 p-4 rounded-md border border-gray-700 flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-gray-100">{synergy.name}</h4>
                            <p className="text-sm text-yellow-400 mt-1">Reducción: <strong>{synergy.timeReduction}h</strong></p>
                            <ul className="list-disc pl-5 mt-2 text-sm text-gray-400">
                                {synergy.partNames.map(name => <li key={name}>{name}</li>)}
                            </ul>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-4">
                            <button onClick={() => handleEdit(synergy)} className="p-2 text-gray-400 hover:text-blue-400 transition" aria-label="Editar">
                                <PencilIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => handleDelete(synergy.id)} className="p-2 text-gray-400 hover:text-red-400 transition" aria-label="Eliminar">
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-6 bg-gray-900 rounded-md border border-gray-700">
                    <p className="text-gray-400">No hay sinergias predefinidas. Haga clic en "Agregar con IA" para crear una.</p>
                </div>
            )}
        </div>
        {isModalOpen && (
            <SynergyModal 
                synergy={editingSynergy}
                allPartNames={allPartNames}
                onClose={() => { setIsModalOpen(false); setEditingSynergy(null); }}
                onSave={handleSave}
            />
        )}
    </div>;
};

const FactoryResetManager: React.FC<{ onReset: (options: { vehicles: boolean; synergies: boolean }) => void }> = ({ onReset }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [resetVehicles, setResetVehicles] = useState(false);
    const [resetSynergies, setResetSynergies] = useState(false);

    const handleConfirm = () => {
        if (!resetVehicles && !resetSynergies) return;
        onReset({ vehicles: resetVehicles, synergies: resetSynergies });
        setIsModalOpen(false);
        setResetVehicles(false);
        setResetSynergies(false);
    };

    return (
        <div className="p-4 bg-gray-800 rounded">
            <h3 className="text-xl font-bold mb-2 text-yellow-400">Configuración General</h3>
            <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                <h4 className="font-semibold text-gray-200">Restaurar Valores de Fábrica</h4>
                <p className="text-sm text-gray-400 mt-1 mb-4">
                    Esta acción reemplazará los datos actuales con los datos originales de la aplicación.
                </p>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-block cursor-pointer rounded-md px-4 py-2 font-semibold transition duration-150 bg-red-600 text-white hover:bg-red-700"
                >
                    Restaurar...
                </button>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg border border-red-500">
                        <div className="p-6">
                            <h4 className="text-xl font-bold text-red-400 mb-2">Confirmar Restauración</h4>
                            <p className="text-gray-300 mb-4">Seleccione qué datos desea restaurar a los valores de fábrica. Esta acción es irreversible.</p>
                            <div className="space-y-3">
                                <label className="flex items-center text-gray-200 cursor-pointer">
                                    <input type="checkbox" checked={resetVehicles} onChange={() => setResetVehicles(v => !v)} className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-yellow-400 focus:ring-yellow-500"/>
                                    <span className="ml-3">Vehículos y Repuestos</span>
                                </label>
                                <label className="flex items-center text-gray-200 cursor-pointer">
                                    <input type="checkbox" checked={resetSynergies} onChange={() => setResetSynergies(v => !v)} className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-yellow-400 focus:ring-yellow-500"/>
                                    <span className="ml-3">Sinergias Predefinidas</span>
                                </label>
                            </div>
                        </div>
                         <div className="bg-gray-800 px-6 py-3 flex justify-end gap-4 rounded-b-lg">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-md text-gray-300 hover:bg-gray-700 transition">Cancelar</button>
                            <button onClick={handleConfirm} disabled={!resetVehicles && !resetSynergies} className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:bg-red-800 disabled:cursor-not-allowed">Restaurar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


interface AdminPanelProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  synergies: Synergy[];
  setSynergies: React.Dispatch<React.SetStateAction<Synergy[]>>;
  onFactoryReset: (options: { vehicles: boolean; synergies: boolean }) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ vehicles, setVehicles, synergies, setSynergies, onFactoryReset }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-6 shadow-xl border border-gray-700">
      <h2 className="text-3xl font-bold text-yellow-400 mb-6">Panel de Administración</h2>
      <div className="space-y-6">
        <VehicleManager vehicles={vehicles} setVehicles={setVehicles} />
        <SynergyManager synergies={synergies} setSynergies={setSynergies} vehicles={vehicles} />
        <FactoryResetManager onReset={onFactoryReset} />
      </div>
    </div>
  );
};