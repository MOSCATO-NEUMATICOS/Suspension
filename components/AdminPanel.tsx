import React, { useState, useRef } from 'react';
import { Vehicle, Part, Synergy } from '../types';

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

                // Find main column keys robustly from the first row's keys
                const firstRowKeys = Object.keys(json[0]);
                const brandKey = firstRowKeys.find(k => k.trim().toLowerCase() === 'marca');
                const modelKey = firstRowKeys.find(k => k.trim().toLowerCase() === 'modelo');
                const segmentKey = firstRowKeys.find(k => k.trim().toLowerCase() === 'segmento');

                if (!brandKey || !modelKey) {
                    throw new Error("El archivo Excel debe contener las columnas 'marca' y 'modelo'. Verifique las cabeceras.");
                }

                // The rest of the columns are parts
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

                    // Skip row if brand or model is missing/empty
                    if (!brand || !model || String(brand).trim() === '' || String(model).trim() === '') {
                        console.warn(`Fila ${rowIndex + 2} ignorada por falta de valor en marca o modelo.`);
                        return;
                    }

                    const vehicleParts: Part[] = [];
                    partColumns.forEach((partName, partIndex) => {
                        const baseTimeValue = row[partName];
                        if (baseTimeValue !== null && baseTimeValue !== undefined && String(baseTimeValue).trim() !== '') {
                            // Handle both dot and comma as decimal separators
                            const timeString = String(baseTimeValue).replace(',', '.');
                            const parsedTime = parseFloat(timeString);

                            // Add part only if time is a valid positive number
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

    return (
        <div className="p-4 bg-gray-800 rounded">
            <h3 className="text-xl font-bold mb-2 text-yellow-400">Gestionar Vehículos y Repuestos</h3>
            <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                <h4 className="font-semibold text-gray-200">Importar desde Excel</h4>
                <p className="text-sm text-gray-400 mt-1 mb-4">
                    Reemplaza la base de datos actual. El archivo debe tener las columnas: <code className="bg-gray-700 p-1 rounded text-xs">marca</code>, <code className="bg-gray-700 p-1 rounded text-xs">modelo</code>, <code className="bg-gray-700 p-1 rounded text-xs">segmento</code> (opcional), y luego una columna por cada repuesto. El valor en cada celda debe ser el tiempo en horas.
                </p>
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
                    {isProcessing ? 'Procesando...' : 'Seleccionar archivo...'}
                </label>

                {feedback && (
                    <p className={`mt-4 text-sm font-medium ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.message}
                    </p>
                )}
            </div>
        </div>
    );
};

const SynergyManager: React.FC<{ synergies: Synergy[]; setSynergies: React.Dispatch<React.SetStateAction<Synergy[]>> }> = ({ synergies, setSynergies }) => {
    return <div className="p-4 bg-gray-800 rounded">
        <h3 className="text-xl font-bold mb-2 text-yellow-400">Gestionar Sinergias</h3>
        <p className="text-gray-400">La interfaz para gestionar las reglas de sinergia se implementaría aquí.</p>
    </div>;
};


interface AdminPanelProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  synergies: Synergy[];
  setSynergies: React.Dispatch<React.SetStateAction<Synergy[]>>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ vehicles, setVehicles, synergies, setSynergies }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-6 shadow-xl border border-gray-700">
      <h2 className="text-3xl font-bold text-yellow-400 mb-6">Panel de Administración</h2>
      <div className="space-y-6">
        <VehicleManager vehicles={vehicles} setVehicles={setVehicles} />
        <SynergyManager synergies={synergies} setSynergies={setSynergies} />
      </div>
    </div>
  );
};
