
import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
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


export const generateSynergyFromDescription = async (
    description: string,
    allPartNames: string[]
): Promise<{ name: string; partNames: string[] }> => {
    const uniquePartNames = [...new Set(allPartNames)];

    const prompt = `
        Actúa como un asistente experto para un sistema de gestión de talleres mecánicos.
        Tu tarea es analizar una descripción de una regla de sinergia de trabajo y extraer la información clave en formato JSON.

        Descripción de la regla del usuario:
        "${description}"

        Lista de repuestos disponibles en el sistema:
        ${uniquePartNames.join(', ')}

        Basado en la descripción, realiza lo siguiente:
        1.  Crea un nombre corto y descriptivo para la regla (ej. "Sinergia Axial y Extremo").
        2.  Identifica TODOS los repuestos mencionados en la regla. Tu respuesta DEBE usar los nombres exactos de la lista de repuestos proporcionada.
        3.  Devuelve un objeto JSON con el nombre de la regla y la lista de nombres de los repuestos.

        Ejemplo:
        Si la descripción es "Cuando cambias el axial y el extremo del mismo lado, el extremo no se cobra.", y la lista de repuestos incluye "Axial Izquierdo", "Axial Derecho", "Extremo Izquierdo", "Extremo Derecho", tu respuesta debería identificar que se refiere a los cuatro repuestos, ya que la regla se aplica a cualquier lado.

        IMPORTANTE: Solo incluye repuestos de la lista proporcionada. Si un repuesto mencionado no está en la lista, ignóralo. El resultado debe ser un JSON válido que se ajuste al esquema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: {
                            type: Type.STRING,
                            description: "Un nombre corto y descriptivo para la regla de sinergia.",
                        },
                        partNames: {
                            type: Type.ARRAY,
                            description: "Una lista de los nombres EXACTOS de los repuestos de la lista proporcionada que están involucrados en la regla.",
                            items: {
                                type: Type.STRING,
                            },
                        },
                    },
                    required: ["name", "partNames"],
                },
            },
        });

        const jsonText = response.text.trim();
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        const parsableText = jsonMatch ? jsonMatch[1] : jsonText;
        
        return JSON.parse(parsableText);

    } catch (error) {
        console.error("Error generating synergy from description:", error);
        throw new Error("La IA no pudo generar una regla de sinergia a partir de la descripción. Intenta ser más específico.");
    }
};
