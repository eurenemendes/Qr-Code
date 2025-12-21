
import { GoogleGenAI } from "@google/genai";

export const analyzeQRContent = async (content: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise o seguinte conteúdo extraído de um QR Code e explique de forma curta e útil o que ele é. Se for um link, descreva o possível destino. Se for texto, resuma. Conteúdo: "${content}"`,
      config: {
        systemInstruction: "Você é um assistente de segurança digital e produtividade que ajuda usuários a entenderem o conteúdo de QR Codes antes de clicarem ou usarem os dados.",
        temperature: 0.7,
      },
    });
    return response.text || "Não foi possível analisar o conteúdo.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Erro ao conectar com o serviço de IA.";
  }
};
