
import React, { useMemo, useState } from 'react';
import { Part, Synergy, SelectedPartConfig } from '../types';
import { ClockIcon } from './icons/ClockIcon';
import { SynergyIcon } from './icons/SynergyIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { getSynergyAnalysis } from '../services/geminiService';
import { TagIcon } from './icons/TagIcon';

interface TimeEstimatorProps {
  vehicleParts: Part[];
  selectedConfigs: Record<string, SelectedPartConfig>;
  synergies: Synergy[];
}

const ThinkingModeAnalysis: React.FC<{ parts: Part[] }> = ({ parts }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState('');
    const [error, setError] = useState('');

    const handleAnalysis = async () => {
        setIsLoading(true);
        setError('');
        setAnalysis('');
        try {
            const result = await getSynergyAnalysis(parts);
            setAnalysis(result);
        } catch (err) {
            setError('Falló el análisis.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-6">
            <button
                onClick={handleAnalysis}
                disabled={isLoading || parts.length < 2}
                className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition duration-150"
            >
                <SparklesIcon className="w-5 h-5 mr-2" />
                {isLoading ? 'Pensando...' : 'Ejecutar Análisis de Sinergia Avanzado'}
            </button>
            {analysis && (
                <div className="mt-4 p-4 bg-gray-900 rounded-md border border-blue-500">
                    <h4 className="font-bold text-blue-400 mb-2">Resultado del Análisis Avanzado:</h4>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{analysis}</p>
                </div>
            )}
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
    );
};


export const TimeEstimator: React.FC<TimeEstimatorProps> = ({ vehicleParts, selectedConfigs, synergies }) => {
    const { 
        totalTime, 
        synergySavings, 
        appliedSynergies, 
        breakdownItems, 
        analysisParts, 
        dynamicSynergySavings, 
        appliedDynamicSynergies,
        volumeDiscount,
        volumeDiscountPercentage,
        partCount,
    } = useMemo(() => {
        const initialResult = { totalTime: 0, synergySavings: 0, appliedSynergies: [], breakdownItems: [], analysisParts: [], dynamicSynergySavings: 0, appliedDynamicSynergies: [], volumeDiscount: 0, volumeDiscountPercentage: 0, partCount: 0 };
        if (Object.keys(selectedConfigs).length === 0) {
            return initialResult;
        }

        const breakdownItems: { id: string; name: string; time: string; originalTime: number }[] = [];
        const analysisParts: Part[] = [];
        const sideRegex = /\s(izquierdo|derecho|izquierda|derecha)$/i;
        
        // Step 1: Populate breakdown and analysis parts from configs, giving each part instance a unique ID
        for (const groupId in selectedConfigs) {
            const config = selectedConfigs[groupId];
            const isBuje = groupId.toLowerCase().includes('bujes');
            const hasSide = !isBuje && vehicleParts.some(p => p.name.replace(sideRegex, '').trim() === groupId && sideRegex.test(p.name));

            if (config.side === 'ambos' && hasSide) {
                const leftPart = vehicleParts.find(p => p.name.replace(sideRegex, '').trim() === groupId && (p.name.toLowerCase().includes('izquierdo') || p.name.toLowerCase().includes('izquierda')));
                const rightPart = vehicleParts.find(p => p.name.replace(sideRegex, '').trim() === groupId && (p.name.toLowerCase().includes('derecho') || p.name.toLowerCase().includes('derecha')));
                
                let groupTime = 0;
                if (leftPart) { groupTime += leftPart.baseTime; analysisParts.push(leftPart); }
                if (rightPart) { groupTime += rightPart.baseTime; analysisParts.push(rightPart); }
                if (groupTime > 0) { breakdownItems.push({ id: groupId, name: `${groupId} (x2, Ambos)`, time: `${groupTime.toFixed(2)} h`, originalTime: groupTime }); }
            } else if ((config.side === 'izquierdo' || config.side === 'derecho') && hasSide) {
                const sideTerm = config.side === 'izquierdo' ? 'izquierdo' : 'derecho';
                const sideTermAlt = config.side === 'izquierdo' ? 'izquierda' : 'derecha';
                const part = vehicleParts.find(p => p.name.replace(sideRegex, '').trim() === groupId && (p.name.toLowerCase().includes(sideTerm) || p.name.toLowerCase().includes(sideTermAlt)));
                
                if (part) { analysisParts.push(part); breakdownItems.push({ id: part.id, name: part.name, time: `${part.baseTime.toFixed(2)} h`, originalTime: part.baseTime }); }
            } else {
                 const part = vehicleParts.find(p => p.name.replace(sideRegex, '').trim() === groupId);
                if (part) {
                    for(let i=0; i < config.quantity; i++) {
                        // Give each instance a unique ID for synergy tracking
                        analysisParts.push({ ...part, id: `${part.id}_${i}` });
                    }
                    const partTime = part.baseTime * config.quantity;
                    breakdownItems.push({ id: part.id, name: `${groupId}${config.quantity > 1 ? ` (x${config.quantity})` : ''}`, time: `${partTime.toFixed(2)} h`, originalTime: partTime });
                }
            }
        }
        
        let baseTotal = breakdownItems.reduce((acc, item) => acc + item.originalTime, 0);

        // Step 2: Calculate predefined synergies
        const selectedPartIds = new Set(analysisParts.map(p => p.id));
        let currentSynergySavings = 0;
        const currentAppliedSynergies: Synergy[] = [];
        const usedPartsForSynergy = new Set<string>();

        const applicableSynergies = synergies.filter(synergy =>
            synergy.partIds.every(id => selectedPartIds.has(id))
        );

        // Sort synergies by the highest reduction first to prioritize them.
        // This ensures that when synergies conflict (share parts), the one with the biggest saving is applied.
        applicableSynergies.sort((a, b) => b.timeReduction - a.timeReduction);

        applicableSynergies.forEach(synergy => {
            // Check if any part in this synergy has already been "claimed" by a higher-priority synergy.
            const isConflicting = synergy.partIds.some(partId => usedPartsForSynergy.has(partId));

            if (!isConflicting) {
                currentSynergySavings += synergy.timeReduction;
                currentAppliedSynergies.push(synergy);
                // Mark all parts of this synergy as used to prevent them from being part of another, smaller synergy saving.
                synergy.partIds.forEach(partId => usedPartsForSynergy.add(partId));
            }
        });
        
        // Step 3: Calculate dynamic synergies
        const discountedParts = new Map<string, number>(); // Part ID -> max discount %
        
        const nonSidedUsage = {
            'bujes parrilla': {
                parts: analysisParts.filter(p => p.name.toLowerCase() === 'bujes parrilla'),
                used: 0,
            },
            'rodamiento rueda': {
                parts: analysisParts.filter(p => p.name.toLowerCase() === 'rodamiento rueda'),
                used: 0,
            },
        };

        const findPart = (name: string, side?: 'izquierdo' | 'derecho') => 
            analysisParts.some(p => p.name.toLowerCase().includes(name) && (side ? p.name.toLowerCase().includes(side) : true));

        for (const side of ['izquierdo', 'derecho'] as const) {
            // Axial + Extremo
            if (findPart('axial', side) && findPart('extremo', side)) {
                const part = analysisParts.find(p => p.name.toLowerCase().includes('extremo') && p.name.toLowerCase().includes(side))!;
                discountedParts.set(part.id, Math.max(discountedParts.get(part.id) || 0, 1.0));
            }
            // Amortiguador delantero synergy
            if (findPart('amortiguadores delanteros', side)) {
                ['bieleta', 'extremo', 'axial', 'homocinetica'].forEach(name => {
                    if (findPart(name, side)) {
                       const part = analysisParts.find(p => p.name.toLowerCase().includes(name) && p.name.toLowerCase().includes(side))!;
                       discountedParts.set(part.id, Math.max(discountedParts.get(part.id) || 0, 0.5));
                    }
                });

                // Amortiguador -> Rodamiento Rueda (non-sided, tracked)
                const rodamientoData = nonSidedUsage['rodamiento rueda'];
                if (rodamientoData.used < rodamientoData.parts.length) {
                    const rodamientoToDiscount = rodamientoData.parts[rodamientoData.used];
                    discountedParts.set(rodamientoToDiscount.id, Math.max(discountedParts.get(rodamientoToDiscount.id) || 0, 0.5));
                    rodamientoData.used++;
                }
            }
            
            // Rótula <-> Parrilla/Bujes synergy (FIXED to prevent time decrease)
            const hasRotulaOnSide = findPart('rotula', side);
            
            if (hasRotulaOnSide) {
                const rotulaPart = analysisParts.find(p => p.name.toLowerCase().includes('rotula') && p.name.toLowerCase().includes(side))!;
                
                // Synergy with Parrilla
                if (findPart('parrilla', side)) {
                    const parrillaPart = analysisParts.find(p => p.name.toLowerCase().includes('parrilla') && p.name.toLowerCase().includes(side))!;
                    // If both are being replaced, the labor for the one with less time is redundant.
                    // We give a 100% discount to the part with less baseTime to be safe.
                    if (parrillaPart.baseTime <= rotulaPart.baseTime) {
                        discountedParts.set(parrillaPart.id, Math.max(discountedParts.get(parrillaPart.id) || 0, 1.0));
                    } else {
                        discountedParts.set(rotulaPart.id, Math.max(discountedParts.get(rotulaPart.id) || 0, 1.0));
                    }
                }
                
                // Synergy with Bujes Parrilla
                const bujesData = nonSidedUsage['bujes parrilla'];
                if (bujesData.used < bujesData.parts.length) {
                    const bujePartToUse = bujesData.parts[bujesData.used];
                    // Discount the cheaper part of the pair to prevent negative time.
                    if (bujePartToUse.baseTime <= rotulaPart.baseTime) {
                         discountedParts.set(bujePartToUse.id, Math.max(discountedParts.get(bujePartToUse.id) || 0, 1.0));
                    } else {
                        discountedParts.set(rotulaPart.id, Math.max(discountedParts.get(rotulaPart.id) || 0, 1.0));
                    }
                    bujesData.used++;
                }
            }
        }
        
        // Espárrago synergy (not side-specific)
        if (findPart('esparrago de rueda') && analysisParts.length > 1) {
            analysisParts.forEach(part => {
                if (part.name.toLowerCase().includes('esparrago de rueda')) {
                    discountedParts.set(part.id, Math.max(discountedParts.get(part.id) || 0, 1.0));
                }
            });
        }
        
        let dynamicSavings = 0;
        const dynamicSynergiesApplied: { name: string, saving: number }[] = [];
        discountedParts.forEach((discount, partId) => {
            const part = analysisParts.find(p => p.id === partId)!;
            const saving = part.baseTime * discount;
            dynamicSavings += saving;
            const synergyName = `Sinergia en ${part.name.replace(sideRegex, '').trim()} (${(discount * 100).toFixed(0)}%)`;
            dynamicSynergiesApplied.push({ name: synergyName, saving });
        });
        
        const totalSynergySavings = currentSynergySavings + dynamicSavings;
        const timeAfterSynergies = baseTotal - totalSynergySavings;

        // Step 4: Calculate Volume Discount
        const partCount = analysisParts.length;
        let currentVolumeDiscountPercentage = 0;
        if (partCount >= 7) {
            currentVolumeDiscountPercentage = 0.15;
        } else if (partCount >= 5) {
            currentVolumeDiscountPercentage = 0.10;
        } else if (partCount >= 3) {
            currentVolumeDiscountPercentage = 0.05;
        }
        
        const currentVolumeDiscount = timeAfterSynergies * currentVolumeDiscountPercentage;
        const finalTotal = Math.max(0, timeAfterSynergies - currentVolumeDiscount);

        return { 
            totalTime: finalTotal, 
            synergySavings: currentSynergySavings, 
            appliedSynergies: currentAppliedSynergies, 
            breakdownItems, 
            analysisParts,
            dynamicSynergySavings: dynamicSavings,
            appliedDynamicSynergies: dynamicSynergiesApplied,
            volumeDiscount: currentVolumeDiscount,
            volumeDiscountPercentage: currentVolumeDiscountPercentage,
            partCount: partCount
        };
    }, [vehicleParts, selectedConfigs, synergies]);

    return (
        <div className="sticky top-8 bg-slate-800 rounded-lg p-6 shadow-xl border border-gray-700">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center">
                <ClockIcon className="w-6 h-6 mr-3" />
                3. Estimación de Tiempo
            </h2>
          
            {breakdownItems.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Seleccione repuestos para ver una estimación.</p>
            ) : (
                <div className="space-y-4">
                    <div className="text-center my-4">
                        <p className="text-gray-300 text-lg">Tiempo Total Estimado</p>
                        <p className="text-5xl font-bold text-yellow-400">{totalTime.toFixed(2)}</p>
                        <p className="text-gray-300">Horas</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg text-gray-200 border-b border-gray-600 pb-2 mb-2">Desglose del Cálculo</h3>
                        {breakdownItems.map(item => (
                            <div key={item.name} className="flex justify-between text-gray-300">
                                <span>{item.name}</span>
                                <span>{item.time}</span>
                            </div>
                        ))}
                    </div>

                    {(synergySavings > 0 || dynamicSynergySavings > 0 || volumeDiscount > 0) && (
                        <div className="space-y-2 pt-2 border-t border-gray-600">
                             {synergySavings > 0 && (
                                <>
                                    <div className="flex justify-between items-center text-green-400 font-semibold">
                                        <span className="flex items-center"><SynergyIcon className="w-5 h-5 mr-2" />Ahorro por Sinergia (Predefinida)</span>
                                        <span>- {synergySavings.toFixed(2)} h</span>
                                    </div>
                                    <ul className="pl-5 text-sm text-gray-400">
                                        {appliedSynergies.map(s => <li key={s.id}>- {s.name}</li>)}
                                    </ul>
                                </>
                             )}
                             {dynamicSynergySavings > 0 && (
                                <>
                                    <div className="flex justify-between items-center text-teal-400 font-semibold mt-2">
                                        <span className="flex items-center"><SynergyIcon className="w-5 h-5 mr-2" />Ahorros por Sinergia Dinámica</span>
                                        <span>- {dynamicSynergySavings.toFixed(2)} h</span>
                                    </div>
                                    <ul className="pl-5 text-sm text-gray-400">
                                        {appliedDynamicSynergies.map((s, index) => <li key={`${s.name}-${index}`}>- {s.name} (-{s.saving.toFixed(2)}h)</li>)}
                                    </ul>
                                </>
                             )}
                             {volumeDiscount > 0 && (
                                <div className="flex justify-between items-center text-purple-400 font-semibold mt-2">
                                    <span className="flex items-center"><TagIcon className="w-5 h-5 mr-2" />Descuento por Volumen ({partCount} repuestos, {volumeDiscountPercentage * 100}%)</span>
                                    <span>- {volumeDiscount.toFixed(2)} h</span>
                                </div>
                             )}
                        </div>
                    )}
                    <ThinkingModeAnalysis parts={analysisParts} />
                </div>
            )}
        </div>
    );
};
