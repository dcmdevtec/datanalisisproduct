import { useState, useCallback } from 'react';
import type { Question } from '@/types-updated';

interface QuestionReference {
  originalId: string;
  currentId: string;
  sectionId: string;
  previousSectionId?: string;
  references: {
    displayLogic: string[];
    skipLogic: string[];
  };
  metadata?: {
    questionType: string;
    isRequired: boolean;
    config: any;
  }
}

function extractReferences(logic: any): string[] {
  const refs: string[] = [];
  
  if (!logic) return refs;

  // Extract from display logic conditions
  if (logic.conditions) {
    logic.conditions.forEach((condition: any) => {
      if (condition.questionId) {
        refs.push(condition.questionId);
      }
    });
  }

  // Extract from skip logic rules
  if (logic.rules) {
    logic.rules.forEach((rule: any) => {
      if (rule.targetQuestionId) {
        refs.push(rule.targetQuestionId);
      }
    });
  }

  return refs;
}

export function useQuestionReferences() {
  const [referenceMap, setReferenceMap] = useState(new Map<string, QuestionReference>());

  const updateReference = useCallback((oldId: string, newId: string) => {
    setReferenceMap(prev => {
      const newMap = new Map(prev);
      
      // Actualizar la referencia principal
      const reference = newMap.get(oldId);
      if (reference) {
        reference.currentId = newId;
        newMap.set(newId, reference);
        newMap.delete(oldId);
      }

      // Actualizar referencias en otras preguntas
      newMap.forEach(ref => {
        ref.references.displayLogic = ref.references.displayLogic.map(id => 
          id === oldId ? newId : id
        );
        ref.references.skipLogic = ref.references.skipLogic.map(id => 
          id === oldId ? newId : id
        );
      });

      return newMap;
    });
  }, []);

  const registerQuestion = useCallback((question: Question, sectionId: string) => {
    setReferenceMap(prev => {
      const newMap = new Map(prev);
      
      const reference: QuestionReference = {
        originalId: question.config?.originalId || question.id,
        currentId: question.id,
        sectionId: sectionId,
        references: {
          displayLogic: extractReferences(question.config?.displayLogic),
          skipLogic: extractReferences(question.config?.skipLogic)
        }
      };

      newMap.set(question.id, reference);
      return newMap;
    });
  }, []);

  const getUpdatedId = useCallback((originalId: string): string => {
    for (const [, reference] of referenceMap.entries()) {
      if (reference.originalId === originalId) {
        return reference.currentId;
      }
    }
    return originalId;
  }, [referenceMap]);

  const handleSectionChange = useCallback((questionId: string, newSectionId: string) => {
    setReferenceMap(prev => {
      const newMap = new Map(prev);
      const reference = newMap.get(questionId);
      
      if (reference) {
        reference.previousSectionId = reference.sectionId;
        reference.sectionId = newSectionId;
        newMap.set(questionId, reference);
      }

      return newMap;
    });
  }, []);

  const trackQuestionMetadata = useCallback((question: Question, sectionId: string) => {
    setReferenceMap(prev => {
      const newMap = new Map(prev);
      const reference = newMap.get(question.id);
      
      if (reference) {
        reference.metadata = {
          questionType: question.type,
          isRequired: question.required,
          config: question.config
        };
        newMap.set(question.id, reference);
      }

      return newMap;
    });
  }, []);

  const validateReferences = useCallback((questionId: string): { valid: boolean; brokenReferences: string[] } => {
    const reference = referenceMap.get(questionId);
    if (!reference) return { valid: true, brokenReferences: [] };

    const brokenReferences = [];

    // Check display logic references
    for (const refId of reference.references.displayLogic) {
      const refQuestion = Array.from(referenceMap.values()).find(r => r.currentId === refId);
      if (!refQuestion) {
        brokenReferences.push(`Display Logic: Referencia perdida a pregunta ${refId}`);
      }
    }

    // Check skip logic references
    for (const refId of reference.references.skipLogic) {
      const refQuestion = Array.from(referenceMap.values()).find(r => r.currentId === refId);
      if (!refQuestion) {
        brokenReferences.push(`Skip Logic: Referencia perdida a pregunta ${refId}`);
      }
    }

    return {
      valid: brokenReferences.length === 0,
      brokenReferences
    };
  }, [referenceMap]);

  const updateLogicReferences = useCallback((logic: any): any => {
    if (!logic) return logic;

    const updatedLogic = { ...logic };

    // Actualizar referencias en condiciones de display logic
    if (updatedLogic.conditions) {
      updatedLogic.conditions = updatedLogic.conditions.map((condition: any) => {
        const updatedId = getUpdatedId(condition.questionId);
        // Verificar que la referencia actualizada existe
        const referenceExists = Array.from(referenceMap.values()).some(r => r.currentId === updatedId);
        
        return {
          ...condition,
          questionId: referenceExists ? updatedId : condition.questionId,
          isValid: referenceExists
        };
      }).filter((condition: { isValid: boolean }) => condition.isValid);
    }

    // Actualizar referencias en reglas de skip logic
    if (updatedLogic.rules) {
      updatedLogic.rules = updatedLogic.rules.map((rule: any) => {
        const updatedId = getUpdatedId(rule.targetQuestionId);
        // Verificar que la referencia actualizada existe
        const referenceExists = Array.from(referenceMap.values()).some(r => r.currentId === updatedId);
        
        return {
          ...rule,
          targetQuestionId: referenceExists ? updatedId : rule.targetQuestionId,
          isValid: referenceExists
        };
      }).filter((rule: { isValid: boolean }) => rule.isValid);
    }

    return updatedLogic;
  }, [getUpdatedId, referenceMap]);

  return {
    referenceMap,
    updateReference,
    registerQuestion,
    getUpdatedId,
    updateLogicReferences,
    handleSectionChange,
    trackQuestionMetadata,
    validateReferences
  };
}
