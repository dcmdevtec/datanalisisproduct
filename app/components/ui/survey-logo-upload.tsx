import { useRef } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

export default function SurveyLogoUpload({ value, onChange }: { value: string | null, onChange: (b64: string | null) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <Input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
      {value && (
        <img src={value} alt="Logo encuesta" className="max-h-24 rounded border" />
      )}
      <Button type="button" variant="outline" onClick={() => onChange(null)} disabled={!value}>
        Quitar logo
      </Button>
    </div>
  );
}
