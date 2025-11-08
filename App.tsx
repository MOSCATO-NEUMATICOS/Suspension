
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Vehicle, Synergy, SelectedPartConfig } from './types';
import { FACTORY_VEHICLES, FACTORY_SYNERGIES } from './data/factoryData';
import { Header } from './components/Header';
import { VehicleSelector } from './components/VehicleSelector';
import { PartSelector } from './components/PartSelector';
import { TimeEstimator } from './components/TimeEstimator';
import { AdminPanel } from './components/AdminPanel';
import { ChatBot } from './components/ChatBot';

const App: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(FACTORY_VEHICLES);
  const [synergies, setSynergies] = useState<Synergy[]>(FACTORY_SYNERGIES);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedConfigs, setSelectedConfigs] = useState<Record<string, SelectedPartConfig>>({});
  const [showAdmin, setShowAdmin] = useState<boolean>(false);

  useEffect(() => {
    // Reset selections if the vehicle list changes
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedConfigs({});
  }, [vehicles]);


  const brands = useMemo(() => [...new Set(vehicles.map(v => v.brand))], [vehicles]);
  const models = useMemo(() => {
    if (!selectedBrand) return [];
    return vehicles.filter(v => v.brand === selectedBrand).map(v => v.model);
  }, [selectedBrand, vehicles]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.brand === selectedBrand && v.model === selectedModel);
  }, [selectedBrand, selectedModel, vehicles]);

  const handleConfigChange = useCallback((partGroupId: string, config: SelectedPartConfig | null) => {
    setSelectedConfigs(prev => {
      const newConfigs = { ...prev };
      if (config) {
        newConfigs[partGroupId] = config;
      } else {
        delete newConfigs[partGroupId];
      }
      return newConfigs;
    });
  }, []);
  
  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel('');
    setSelectedConfigs({});
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setSelectedConfigs({});
  };
  
  const handleFactoryReset = useCallback((options: { vehicles: boolean; synergies: boolean }) => {
    if (window.confirm("¿Estás seguro de que quieres restaurar los datos seleccionados a los valores de fábrica? Esta acción no se puede deshacer.")) {
        if (options.vehicles) {
            setVehicles(FACTORY_VEHICLES);
        }
        if (options.synergies) {
            setSynergies(FACTORY_SYNERGIES);
        }
    }
  }, []);
  
  const handleClearSelection = useCallback(() => {
    setSelectedConfigs({});
  }, []);


  return (
    <div className="min-h-screen bg-black" style={{ backgroundColor: '#101010' }}>
      <Header onToggleAdmin={() => setShowAdmin(prev => !prev)} />
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        {showAdmin ? (
          <AdminPanel
            vehicles={vehicles}
            setVehicles={setVehicles}
            synergies={synergies}
            setSynergies={setSynergies}
            onFactoryReset={handleFactoryReset}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <VehicleSelector
                brands={brands}
                selectedBrand={selectedBrand}
                onBrandChange={handleBrandChange}
                models={models}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
              />
              {selectedVehicle && (
                <PartSelector
                  parts={selectedVehicle.parts}
                  selectedConfigs={selectedConfigs}
                  onConfigChange={handleConfigChange}
                  onClearSelection={handleClearSelection}
                />
              )}
            </div>
            <div className="lg:col-span-1">
              <TimeEstimator
                vehicleParts={selectedVehicle ? selectedVehicle.parts : []}
                selectedConfigs={selectedConfigs}
                synergies={synergies}
              />
            </div>
          </div>
        )}
      </main>
      <ChatBot />
    </div>
  );
};

export default App;
