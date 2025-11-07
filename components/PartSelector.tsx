import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Part, SelectedPartConfig, PartSide } from '../types';
import { WrenchIcon } from './icons/WrenchIcon';
import { InfoIcon } from './icons/InfoIcon';
import { getPartInfo } from '../services/geminiService';
import { GroundingChunk } from '@google/genai';

interface PartSelectorProps {
  parts: Part[];
  selectedConfigs: Record<string, SelectedPartConfig>;
  onConfigChange: (partGroupId: string, config: SelectedPartConfig | null) => void;
}

interface PartGroup {
    id: string;
    displayName: string;
    hasSide: boolean;
    isBuje: boolean;
    isParrilla: boolean;
    isBujeParrilla: boolean;
    parts: Part[];
}

// Fix: Implemented the PartInfoModal to fetch and display data.
// The previous empty implementation caused a type error because it didn't return a ReactNode.
const PartInfoModal: React.FC<{ partName: string; onClose: () => void }> = ({ partName, onClose }) => {
    const [info, setInfo] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInfo = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await getPartInfo(partName);
                setInfo(response.text);
                const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
                if (groundingMetadata?.groundingChunks) {
                    setSources(groundingMetadata.groundingChunks);
                }
            } catch (err) {
                console.error("Error fetching part info:", err);
                setError("No se pudo cargar la información. Inténtalo de nuevo más tarde.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInfo();
    }, [partName]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl border border-yellow-400 m-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-yellow-400">Información sobre: {partName}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto pr-4 text-gray-300">
                    {isLoading && (
                        <div className="flex justify-center items-center h-32">
                             <div className="flex gap-1.5 items-center">
                                <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                                <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                                <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></span>
                            </div>
                        </div>
                    )}
                    {error && <p className="text-red-400">{error}</p>}
                    {info && (
                        <p className="whitespace-pre-wrap">{info}</p>
                    )}
                    {sources.length > 0 && (
                        <div className="mt-6 border-t border-gray-600 pt-4">
                            <h4 className="font-semibold text-gray-200 mb-2">Fuentes:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                {sources.map((chunk, index) => (
                                    chunk.web?.uri && (
                                        <li key={index}>
                                            <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                {chunk.web.title || chunk.web.uri}
                                            </a>
                                        </li>
                                    )
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PartControls: React.FC<{ group: PartGroup; config: SelectedPartConfig; onConfigChange: (id: string, config: SelectedPartConfig) => void; }> = ({ group, config, onConfigChange }) => {
    
    const maxQuantity = useMemo(() => {
        if (group.isBuje) return 8;
        if (group.hasSide) return 2;
        return 1; // Default max quantity for non-sided, non-buje parts
    }, [group]);
    
    const handleQuantityChange = (delta: number) => {
        const newQuantity = config.quantity + delta;
        
        if (newQuantity < 1 || newQuantity > maxQuantity) return;
        
        const newConfig = { ...config, quantity: newQuantity };
        
        if (group.hasSide) {
            newConfig.side = newQuantity === 2 ? 'ambos' : (config.side === 'ninguno' || config.side === 'ambos' ? 'izquierdo' : config.side);
        }
        
        onConfigChange(group.id, newConfig);
    };

    const handleSideChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSide = e.target.value as PartSide;
        onConfigChange(group.id, { ...config, side: newSide });
    };

    return (
        <div className="flex items-center gap-4 pl-11 mt-2">
            <div className="flex items-center border border-gray-600 rounded">
                <button onClick={() => handleQuantityChange(-1)} className="px-3 py-1 text-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50" disabled={config.quantity <= 1}>-</button>
                <span className="px-4 py-1 text-white font-semibold">{config.quantity}</span>
                <button onClick={() => handleQuantityChange(1)} className="px-3 py-1 text-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50" disabled={config.quantity >= maxQuantity}>+</button>
            </div>
            {group.hasSide && config.quantity === 1 && (
                <select value={config.side} onChange={handleSideChange} className="bg-gray-800 border border-gray-600 rounded-md py-1 px-2 text-white focus:outline-none focus:bg-gray-700 focus:border-yellow-400">
                    <option value="izquierdo">Izquierdo</option>
                    <option value="derecho">Derecho</option>
                </select>
            )}
            {group.hasSide && config.quantity === 2 && (
                <span className="bg-gray-700 text-white rounded-md py-1 px-3 text-sm font-medium">Ambos</span>
            )}
        </div>
    );
};


export const PartSelector: React.FC<PartSelectorProps> = ({ parts, selectedConfigs, onConfigChange }) => {
    const [infoModalPart, setInfoModalPart] = useState<string | null>(null);

    const partGroups = useMemo((): PartGroup[] => {
        const groups = new Map<string, PartGroup>();
        const sideRegex = /\s(izquierdo|derecho|izquierda|derecha)$/i;

        parts.forEach(part => {
            const baseName = part.name.replace(sideRegex, '').trim();
            const lowerBaseName = baseName.toLowerCase();

            if (!groups.has(baseName)) {
                groups.set(baseName, {
                    id: baseName,
                    displayName: baseName,
                    hasSide: false,
                    isBuje: lowerBaseName.includes('bujes'),
                    isParrilla: lowerBaseName === 'parrilla',
                    isBujeParrilla: lowerBaseName === 'bujes parrilla',
                    parts: []
                });
            }
            
            const group = groups.get(baseName)!;
            group.parts.push(part);
            if (sideRegex.test(part.name)) {
                group.hasSide = true;
            }
        });

        return Array.from(groups.values());
    }, [parts]);
    
    const isParrillaSelected = useMemo(() => Object.keys(selectedConfigs).some(key => key.toLowerCase() === 'parrilla'), [selectedConfigs]);
    const isBujeParrillaSelected = useMemo(() => Object.keys(selectedConfigs).some(key => key.toLowerCase() === 'bujes parrilla'), [selectedConfigs]);

    const handleCheckChange = (group: PartGroup, isChecked: boolean) => {
        if (isChecked) {
            onConfigChange(group.id, {
                quantity: 1,
                side: group.hasSide ? 'izquierdo' : 'ninguno'
            });
        } else {
            onConfigChange(group.id, null);
        }
    };

  return (
    <div className="bg-slate-800 rounded-lg p-6 shadow-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center">
        <WrenchIcon className="w-6 h-6 mr-3" />
        2. Seleccionar Repuestos
      </h2>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {partGroups.map(group => {
          const config = selectedConfigs[group.id];
          const isDisabled = (group.isParrilla && isBujeParrillaSelected) || (group.isBujeParrilla && isParrillaSelected);
          const labelClasses = `flex items-center flex-grow ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`;

          return (
            <div key={group.id} className={`p-4 rounded-md transition duration-150 ease-in-out ${isDisabled ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-700'}`}>
              <div className="flex items-center justify-between">
                <label htmlFor={`part-${group.id}`} className={labelClasses}>
                  <input
                    id={`part-${group.id}`}
                    type="checkbox"
                    checked={!!config}
                    onChange={(e) => handleCheckChange(group, e.target.checked)}
                    className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-yellow-400 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isDisabled}
                  />
                  <span className="ml-4 text-gray-200">{group.displayName}</span>
                </label>
                <button onClick={() => setInfoModalPart(group.displayName)} className="ml-4 text-gray-400 hover:text-yellow-400" title={`Obtener información sobre ${group.displayName}`}>
                    <InfoIcon className="w-5 h-5"/>
                </button>
              </div>
              {config && <PartControls group={group} config={config} onConfigChange={onConfigChange as any}/>}
            </div>
          )
        })}
      </div>
      {infoModalPart && <PartInfoModal partName={infoModalPart} onClose={() => setInfoModalPart(null)} />}
    </div>
  );
};
