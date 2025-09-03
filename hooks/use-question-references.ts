import { useState, useCallback } from 'react';
import type { Question } from '@/types-updated';

interface QuestionReference {
  originalId: string;
  currentId: string;
  sectionId: string;
  references: {
    displayLogic: string[];
    skipLogic: string[];
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

  const updateLogicReferences = useCallback((logic: any): any => {
    if (!logic) return logic;

    const updatedLogic = { ...logic };

    // Actualizar referencias en condiciones de display logic
    if (updatedLogic.conditions) {
      updatedLogic.conditions = updatedLogic.conditions.map((condition: any) => ({
        ...condition,
        questionId: getUpdatedId(condition.questionId)
      }));
    }

    // Actualizar referencias en reglas de skip logic
    if (updatedLogic.rules) {
      updatedLogic.rules = updatedLogic.rules.map((rule: any) => ({
        ...rule,
        targetQuestionId: getUpdatedId(rule.targetQuestionId)
      }));
    }

    return updatedLogic;
  }, [getUpdatedId]);

  return {
    referenceMap,
    updateReference,
    registerQuestion,
    getUpdatedId,
    updateLogicReferences
  };
}
