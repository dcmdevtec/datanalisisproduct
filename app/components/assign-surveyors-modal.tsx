"use client"

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Zone, Surveyor } from '@/types';
import { EmailAutocompleteInput } from './EmailAutocompleteInput';

interface AssignSurveyorsModalProps {
  zone: Zone | null;
  isOpen: boolean;
  onClose: () => void;
  onAssignmentUpdate: (zoneId: string, surveyorIds: string[]) => void;
}

export function AssignSurveyorsModal({ 
  zone, 
  isOpen, 
  onClose, 
  onAssignmentUpdate 
}: AssignSurveyorsModalProps) {
  const [selectedSurveyors, setSelectedSurveyors] = useState<Surveyor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const { toast } = useToast();

  const fetchAssignedSurveyors = useCallback(async () => {
    if (!zone) return;

    const { data, error } = await supabase
      .from('zone_surveyors')
      .select('surveyor_id, surveyors(id, email, full_name)')
      .eq('zone_id', zone.id);

    if (error) {
      console.error('Error fetching assigned surveyors:', error);
      return;
    }

    const assigned = data.map((item: any) => ({
      id: item.surveyor_id,
      email: item.surveyors.email,
      full_name: item.surveyors.full_name,
    }));
    setSelectedSurveyors(assigned);
  }, [zone, supabase]);

  useEffect(() => {
    if (isOpen) {
      fetchAssignedSurveyors();
    }
  }, [isOpen, fetchAssignedSurveyors]);

  const handleAddSurveyor = (surveyor: Surveyor) => {
    if (!selectedSurveyors.find(s => s.id === surveyor.id)) {
      setSelectedSurveyors(prev => [...prev, surveyor]);
    }
  };

  const handleRemoveSurveyor = (surveyorId: string) => {
    setSelectedSurveyors(prev => prev.filter(s => s.id !== surveyorId));
  };

  const handleSaveChanges = async () => {
    if (!zone) return;
    setIsLoading(true);

    const currentSurveyorIds = selectedSurveyors.map(s => s.id);

    // Fetch current assignments to compare
    const { data: existingAssignments, error: fetchError } = await supabase
      .from('zone_surveyors')
      .select('surveyor_id')
      .eq('zone_id', zone.id);

    if (fetchError) {
      toast({ title: 'Error', description: 'No se pudieron obtener las asignaciones existentes.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const existingSurveyorIds = existingAssignments.map(a => a.surveyor_id);

    const toAdd = currentSurveyorIds.filter(id => !existingSurveyorIds.includes(id));
    const toRemove = existingSurveyorIds.filter(id => !currentSurveyorIds.includes(id));

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('zone_surveyors')
        .delete()
        .eq('zone_id', zone.id)
        .in('surveyor_id', toRemove);
      if (deleteError) {
        toast({ title: 'Error', description: 'No se pudieron eliminar los encuestadores.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
    }

    if (toAdd.length > 0) {
      const newAssignments = toAdd.map(surveyor_id => ({ zone_id: zone.id, surveyor_id }));
      const { error: insertError } = await supabase
        .from('zone_surveyors')
        .insert(newAssignments);
      if (insertError) {
        toast({ title: 'Error', description: 'No se pudieron asignar los nuevos encuestadores.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
    }

    toast({ title: 'Éxito', description: 'Encuestadores actualizados correctamente.' });
    onAssignmentUpdate(zone.id, currentSurveyorIds);
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Encuestadores a {zone?.name}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <EmailAutocompleteInput onSurveyorSelected={handleAddSurveyor} />

          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-500">Encuestadores Asignados</h3>
            {selectedSurveyors.length > 0 ? (
              <ul className="border rounded-md p-2 space-y-2">
                {selectedSurveyors.map(s => (
                  <li key={s.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-sm text-gray-500">{s.email}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveSurveyor(s.id)}>Eliminar</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No hay encuestadores asignados.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSaveChanges} disabled={isLoading}>
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}