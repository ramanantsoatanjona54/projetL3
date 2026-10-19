import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  erreur?: string;
  type?: string;
  placeholder?: string;
  aide?: string;
}

export function ChampTexte({ id, label, value, onChange, erreur, type = 'text', placeholder, aide }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-base">{label}</Label>
      <Input
        id={id} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!erreur} aria-describedby={erreur ? `${id}-erreur` : undefined}
        className="h-11 text-base"
      />
      {aide && !erreur && <p className="text-sm text-muted-foreground">{aide}</p>}
      {erreur && <p id={`${id}-erreur`} className="text-sm text-destructive">{erreur}</p>}
    </div>
  );
}