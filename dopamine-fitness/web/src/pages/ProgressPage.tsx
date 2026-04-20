import { useState } from "react";
import { Card } from "../components/ui/Card";
import { ProgressChart } from "../components/charts/ProgressChart";
import { StatsPeriod, useProgress } from "../features/progress/useProgress";
import { Button } from "../components/ui/Button";

export function ProgressPage() {
  const [period, setPeriod] = useState<StatsPeriod>("week");
  const { data, isLoading } = useProgress(period);

  return (
    <Card>
      <h2>Прогресс</h2>
      <div className="row">
        <Button onClick={() => setPeriod("week")}>7 дней</Button>
        <Button onClick={() => setPeriod("month")}>30 дней</Button>
        <Button onClick={() => setPeriod("3months")}>3 месяца</Button>
        <Button onClick={() => setPeriod("year")}>12 месяцев</Button>
      </div>
      {isLoading ? <p>Загрузка...</p> : <ProgressChart points={data?.points ?? []} />}
    </Card>
  );
}
