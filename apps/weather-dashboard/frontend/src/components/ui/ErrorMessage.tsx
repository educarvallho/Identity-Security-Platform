import { AlertTriangle } from "lucide-react";

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
