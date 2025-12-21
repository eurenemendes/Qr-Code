
import { GoogleGenAI } from "@google/genai";

export const analyzeQRContent = async (content: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise o seguinte conteúdo de um QR Code e me diga o que é de forma muito concisa (máximo 2 frases). Se for um link, verifique se parece malicioso ou oficial. Conteúdo: "${content}"`,
      config: {
        systemInstruction: "Você é um especialista em segurança digital. Sua missão é analisar dados de QR Codes e explicar em Português do Brasil o que eles representam, alertando sobre possíveis riscos de phishing em links desconhecidos ou explicando o formato dos dados (ex: VCard, JSON, texto puro).",
        temperature: 0.4,
      },
    });
    return response.text || "Análise concluída, mas sem observações adicionais.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Não foi possível completar a análise de IA no momento. Por favor, verifique manualmente.";
  }
};
