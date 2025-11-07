import React from 'react';
import { CarIcon } from './icons/CarIcon';

interface VehicleSelectorProps {
  brands: string[];
  selectedBrand: string;
  onBrandChange: (brand: string) => void;
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className="w-full bg-slate-900 border border-slate-700 rounded-md py-3 px-4 text-white text-center leading-tight focus:outline-none focus:bg-slate-800 focus:border-yellow-400 transition duration-150 ease-in-out"
  />
);

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  brands,
  selectedBrand,
  onBrandChange,
  models,
  selectedModel,
  onModelChange,
}) => {
  return (
    <div className="bg-slate-800 rounded-lg p-6 shadow-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center">
        <CarIcon className="w-8 h-8 mr-3" />
        1. Seleccionar Vehículo
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="brand-select" className="block text-sm font-medium text-blue-300 mb-2">
            Marca
          </label>
          <SelectInput id="brand-select" value={selectedBrand} onChange={(e) => onBrandChange(e.target.value)}>
            <option value="">-- Seleccione Marca --</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </SelectInput>
        </div>
        <div>
          <label htmlFor="model-select" className="block text-sm font-medium text-blue-300 mb-2">
            Modelo
          </label>
          <SelectInput id="model-select" value={selectedModel} onChange={(e) => onModelChange(e.target.value)} disabled={!selectedBrand}>
            <option value="">-- Seleccione Modelo --</option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </SelectInput>
        </div>
      </div>
    </div>
  );
};
