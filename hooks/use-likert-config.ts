import { useState, useEffect } from "react";
import type { Question } from "@/types-updated";

export interface LikertScaleState {
  questionText: string;
  config: {
    min: number;
    max: number;
    step: number;
    startPosition: 'left' | 'center' | 'right';
    labels: {
      left: string;
      center?: string;
      right: string;
    };
    showZero: boolean;
    zeroLabel: string;
    showNumbers: boolean;
    showLabels: boolean;
    orientation: 'horizontal' | 'vertical';
    validation: {
      requireAnswer: boolean;
      allowZero: boolean;
    };
    appearance: {
      size: 'small' | 'medium' | 'large';
      color: string;
      showTicks: boolean;
      showValue: boolean;
    };
  }
}

const DEFAULT_LIKERT_CONFIG: LikertScaleState['config'] = {
  min: 1,
  max: 5,
  step: 1,
  startPosition: 'left',
  labels: {
    left: 'Totalmente en desacuerdo',
    right: 'Totalmente de acuerdo'
  },
  showZero: false,
  zeroLabel: 'No Sabe / No Responde',
  showNumbers: true,
  showLabels: true,
  orientation: 'horizontal',
  validation: {
    requireAnswer: true,
    allowZero: true,
  },
  appearance: {
    size: 'medium',
    color: '#4CAF50',
    showTicks: true,
    showValue: true,
  }
};

// Función para calcular similitud de texto
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const normalizedText1 = text1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedText2 = text2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let matches = 0;
  const maxLength = Math.max(normalizedText1.length, normalizedText2.length);
  
  for (let i = 0; i < Math.min(normalizedText1.length, normalizedText2.length); i++) {
    if (normalizedText1[i] === normalizedText2[i]) matches++;
  }
  
  return matches / maxLength;
};

const loadAndReconcileConfig = (question: Question): LikertScaleState['config'] => {
  try {
    // Intentar cargar la configuración guardada
    const savedStateString = localStorage.getItem(`likert_config_${question.id}`);
    if (savedStateString) {
      const savedState = JSON.parse(savedStateString) as LikertScaleState;
      
      // Si el texto coincide exactamente, usar la configuración guardada
      if (savedState.questionText === question.text) {
        console.log('✅ Configuración exacta encontrada:', savedState.config);
        return savedState.config;
      }
      
      // Si hay similitud suficiente, usar la configuración guardada pero actualizar el texto
      const similarity = calculateTextSimilarity(savedState.questionText, question.text);
      if (similarity > 0.8) {
        console.log('📝 Configuración similar encontrada (similitud:', similarity, ')');
        return savedState.config;
      }
    }
    
    // Si la pregunta ya tiene configuración de Likert en su propio config
    if (question.config?.likertScale) {
      console.log('📋 Usando configuración existente de la pregunta');
      return {
        ...DEFAULT_LIKERT_CONFIG,
        ...question.config.likertScale
      };
    }
    
    // Si es una pregunta nueva o sin configuración previa
    console.log('🆕 Creando nueva configuración Likert');
    return DEFAULT_LIKERT_CONFIG;
  } catch (error) {
    console.error('Error al cargar configuración Likert:', error);
    return DEFAULT_LIKERT_CONFIG;
  }
};

export const useLikertConfig = (question: Question) => {
  const [config, setConfig] = useState<LikertScaleState['config']>(() => 
    loadAndReconcileConfig(question)
  );
  
  // Guardar configuración cuando cambie
  useEffect(() => {
    if (question.type === 'likert') {
      const stateToSave: LikertScaleState = {
        questionText: question.text,
        config: config
      };
      localStorage.setItem(`likert_config_${question.id}`, JSON.stringify(stateToSave));
      console.log('💾 Configuración Likert guardada:', stateToSave);
    }
  }, [config, question.id, question.text, question.type]);
  
  // Limpiar configuración cuando la pregunta cambie a otro tipo
  useEffect(() => {
    if (question.type !== 'likert') {
      localStorage.removeItem(`likert_config_${question.id}`);
      console.log('🧹 Configuración Likert eliminada por cambio de tipo');
    }
  }, [question.type, question.id]);

  return {
    config,
    updateConfig: setConfig,
    resetConfig: () => setConfig(DEFAULT_LIKERT_CONFIG),
    validateConfig: () => {
      // Validar la configuración actual
      const isValid = 
        config.min === 1 && // Siempre debe ser 1
        config.step === 1 && // Siempre debe ser 1
        config.max >= 2 && // Debe ser al menos 2
        config.labels.left && // Debe tener etiqueta izquierda
        config.labels.right; // Debe tener etiqueta derecha
        
      return isValid;
    }
  };
};
