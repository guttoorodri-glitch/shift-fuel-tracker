import type { Tank } from "@/lib/store";

export type DailySalesSummary = {
  fuels: { id: string; name: string; liters: number }[];
  totalGeralLitros: number;
  mixAditivada: number | null;
};

export function calculateDailySalesSummary(
  tanks: Tank[],
  getSale: (shift: number, tankId: string) => number | null | undefined,
): DailySalesSummary {
  const fuels = tanks.map((tank) => ({
    id: tank.id,
    name: tank.name,
    liters: [1, 2, 3].reduce((total, shift) => total + (getSale(shift, tank.id) ?? 0), 0),
  }));
  const totalGeralLitros = fuels.reduce((total, fuel) => total + fuel.liters, 0);
  const commonGasoline = fuels.find((fuel) =>
    fuel.name.toLocaleLowerCase("pt-BR").includes("gasolina comum"),
  );
  const additiveGasoline = fuels.find((fuel) =>
    fuel.name.toLocaleLowerCase("pt-BR").includes("gasolina aditivada"),
  );
  const totalGasoline = (commonGasoline?.liters ?? 0) + (additiveGasoline?.liters ?? 0);
  const mixAditivada =
    commonGasoline && additiveGasoline && totalGasoline > 0
      ? (additiveGasoline.liters / totalGasoline) * 100
      : commonGasoline && additiveGasoline
        ? 0
        : null;

  return { fuels, totalGeralLitros, mixAditivada };
}
