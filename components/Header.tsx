import React from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import { GoodyearWingfootIcon } from './icons/GoodyearWingfootIcon';

interface HeaderProps {
  onToggleAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleAdmin }) => {
  return (
    <header className="bg-gray-900 shadow-lg border-b-4 border-yellow-400">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <GoodyearWingfootIcon className="h-8 w-12 text-yellow-400 mr-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
              Estimador Moscato Suspensión
            </h1>
          </div>
          <button
            onClick={onToggleAdmin}
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white transition duration-150 ease-in-out"
            aria-label="Configuración de Administrador"
          >
            <SparklesIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
};
