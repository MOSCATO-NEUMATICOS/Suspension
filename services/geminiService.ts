
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Part } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

let chatInstance: Chat | null = null;

function getChatInstance(): Chat {
  if (!chatInstance) {
    chatInstance = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "Eres un asistente útil para un taller mecánico de automóviles. Te especializas en sistemas de suspensión. Tu nombre es 'Bot Pro de Suspensión'. Mantén tus respuestas concisas y útiles para los mecánicos. Tu esquema de colores es azul y amarillo Goodyear sobre un fondo oscuro.",
      },
    });
  }
  return chatInstance;
}

export const getChatResponseStream = async (history: ChatMessage[], newMessage: string) => {
  const chat = getChatInstance();
  
  // Note: The history param is for potential future use if we need to rebuild chat state.
  // The SDK's chat object maintains its own history. We just send the latest message.
  return chat.sendMessageStream({ message: newMessage });
};


export const getPartInfo = async (partName: string): Promise<GenerateContentResponse> => {
  const prompt = `Proporciona un resumen breve y actualizado para un mecánico sobre el repuesto de suspensión: "${partName}". Incluye síntomas de falla comunes y consideraciones típicas para el reemplazo.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{googleSearch: {}}],
    },
  });
  
  return response;
};

export const getSynergyAnalysis = async (parts: Part[]): Promise<string> => {
  if (parts.length < 2) {
    return "Seleccione al menos dos repuestos para el análisis de sinergia.";
  }

  const partList = parts.map(p => `- ${p.name} (Zona: ${p.zone || 'No especificada'}, Tiempo Base: ${p.baseTime}h)`).join('\n');

  const prompt = `
    Como mecánico experto en suspensiones, analiza la siguiente lista de repuestos seleccionados para un trabajo de reparación.
    Identifica sinergias de trabajo no obvias, posibles ventas adicionales o componentes adicionales necesarios que no estén en esta lista.
    Proporciona tu análisis en un formato conciso de lista con viñetas.

    Repuestos Seleccionados:
    ${partList}

    Tu análisis debe centrarse en proporcionar consejos prácticos para el mecánico.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: { 
        thinkingConfig: { thinkingBudget: 32768 } 
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching synergy analysis:", error);
    return "Ocurrió un error al analizar las sinergias. Por favor, inténtalo de nuevo.";
  }
};