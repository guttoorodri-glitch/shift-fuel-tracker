import { AlertTriangle } from "lucide-react";

export function ConfirmModal({
  open,
  titulo,
  onSim,
  onNao,
}: {
  open: boolean;
  titulo: string;
  onSim: () => void;
  onNao: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        aria-labelledby="confirm-modal-title"
        aria-modal="true"
        className="w-full max-w-[380px] animate-in rounded-2xl bg-white p-7 shadow-2xl fade-in zoom-in"
        role="dialog"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
            <AlertTriangle className="size-5 text-white" />
          </div>
          <h2 id="confirm-modal-title" className="text-lg font-bold text-gray-800">
            {titulo}
          </h2>
        </div>
        <p className="mb-7 ml-1 text-gray-500">Deseja continuar?</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onNao}
            className="rounded-xl bg-gray-100 px-6 py-2.5 font-medium transition-all hover:bg-gray-200"
          >
            Não
          </button>
          <button
            type="button"
            onClick={onSim}
            className="rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-200 transition-all hover:opacity-90"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}
