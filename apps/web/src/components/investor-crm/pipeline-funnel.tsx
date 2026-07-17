import { TrendingUp, Users } from "lucide-react";

import { PIPELINE_STAGES } from "@/components/investor-crm/crm-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Investor } from "@/services/investor.service";

interface PipelineFunnelProps {
  investors: Investor[];
}

export function PipelineFunnel({ investors }: PipelineFunnelProps) {
  const pipelineData = PIPELINE_STAGES.map((stage) => {
    const matched = investors.filter((i) => i.status === stage.key);
    return {
      ...stage,
      count: matched.length,
      investors: matched,
    };
  });

  const totalPipelineCount = pipelineData.reduce((s, p) => s + p.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" />
          Investor Pipeline
        </CardTitle>
        <CardDescription>
          Distribution of investors across stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalPipelineCount === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center rounded-lg border
              border-dashed py-10
            `}
          >
            <Users className="text-muted-foreground/40 mb-2 size-8" />
            <p className="text-muted-foreground text-sm">
              No investors in the pipeline yet
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pipelineData.map((stage) => {
              const pct =
                totalPipelineCount > 0
                  ? (stage.count / totalPipelineCount) * 100
                  : 0;

              return (
                <div key={stage.key} className="group">
                  <div className={`mb-1.5 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`
                          size-2.5 rounded-full
                          ${stage.color}
                        `}
                      />
                      <span className={`text-foreground text-sm font-medium`}>
                        {stage.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-muted-foreground text-xs tabular-nums`}
                      >
                        {stage.count} investor
                        {stage.count !== 1 ? "s" : ""}
                      </span>
                      <span
                        className={`
                          text-foreground text-xs font-semibold tabular-nums
                        `}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div
                    className={`bg-muted h-2.5 overflow-hidden rounded-full`}
                  >
                    <div
                      className={`
                        h-full rounded-full transition-all duration-500
                        ${stage.color}
                      `}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
