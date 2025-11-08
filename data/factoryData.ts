
import { Vehicle, Synergy, Part } from '../types';
import { vehicleCatalogData } from './vehicleCatalog';

// Function to transform the raw catalog data into the application's data structure
const transformCatalogToVehicles = (catalog: any): Vehicle[] => {
  const vehicles: Vehicle[] = [];
  // Keywords to identify parts that have left/right versions
  const sidedPartKeywords = [
    'amortiguador', 'axial', 'bieleta', 'extremo', 'rotula', 'parrilla', 'homocinetica'
  ];
  const nonSidedExactMatches = [
    'bujes parrilla', 'rodamiento rueda'
  ];
  let vehicleIdCounter = 1;
  let partIdCounter = 1;

  // Capitalize helper that keeps certain acronyms in uppercase
  const capitalize = (s: string) => {
      if (s.toUpperCase() === 'EJE') return 'EJE';
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  for (const brand in catalog.brands) {
    if (Object.prototype.hasOwnProperty.call(catalog.brands, brand)) {
      for (const model in catalog.brands[brand].models) {
        if (Object.prototype.hasOwnProperty.call(catalog.brands[brand].models, model)) {
          const vehicleParts: Part[] = [];
          const modelData = catalog.brands[brand].models[model];

          for (const partName in modelData.parts) {
            if (Object.prototype.hasOwnProperty.call(modelData.parts, partName)) {
              const baseTime = modelData.parts[partName];
              const lowerPartName = partName.toLowerCase();
              
              const displayName = partName.split(' ').map(capitalize).join(' ');
              
              const isNonSidedByName = nonSidedExactMatches.includes(lowerPartName);
              const isSided = !isNonSidedByName && sidedPartKeywords.some(keyword => lowerPartName.includes(keyword));

              if (isSided) {
                vehicleParts.push({
                  id: `p${partIdCounter++}`,
                  name: `${displayName} Izquierdo`,
                  baseTime: baseTime,
                });
                vehicleParts.push({
                  id: `p${partIdCounter++}`,
                  name: `${displayName} Derecho`,
                  baseTime: baseTime,
                });
              } else {
                vehicleParts.push({
                  id: `p${partIdCounter++}`,
                  name: displayName,
                  baseTime: baseTime,
                });
              }
            }
          }
          vehicles.push({
            id: `v${vehicleIdCounter++}`,
            brand: brand,
            model: model,
            parts: vehicleParts,
          });
        }
      }
    }
  }
  return vehicles;
};

// Generate the vehicle list from the catalog
export const FACTORY_VEHICLES: Vehicle[] = transformCatalogToVehicles(vehicleCatalogData);

// The factory default synergies are now managed here.
// Users can add more, and reset to this list.
// The complex dynamic synergies from TimeEstimator are too complex for this simple model
// and are better handled by the AI-powered synergy analysis. We'll start with an empty list
// to encourage users to add their own shop-specific synergies using the new AI tool.
export const FACTORY_SYNERGIES: Synergy[] = [];
