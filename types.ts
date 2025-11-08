
export interface Part {
  id: string;
  name: string;
  baseTime: number;
  zone?: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  segment?: string;
  parts: Part[];
}

export interface Synergy {
  id: string;
  name: string;
  partNames: string[];
  timeReduction: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type PartSide = 'izquierdo' | 'derecho' | 'ambos' | 'ninguno';

export interface SelectedPartConfig {
  quantity: number;
  side: PartSide;
}