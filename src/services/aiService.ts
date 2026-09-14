import { supabase } from "@/lib/supabase";
import type {
  AITaskEnvelope,
  BudgetOptimizerRequest,
  BudgetOptimizerResponse,
  DesignConsultantRequest,
  DesignConsultantResponse,
  FloorPlanAnalysisRequest,
  FloorPlanAnalysisResponse,
  SpacePlanningRequest,
  SpacePlanningResponse,
} from "@/types";

/**
 * The ONLY place the frontend touches AI functionality. Every call goes
 * through the `ai-orchestrator` Supabase Edge Function — never directly to
 * Claude/Gemini/etc from the client (CLAUDE.md §5).
 */

async function invokeOrchestrator<TReq, TRes>(
  task: string,
  payload: TReq
): Promise<AITaskEnvelope<TRes>> {
  const { data, error } = await supabase.functions.invoke("ai-orchestrator", {
    body: { task, payload },
  });

  if (error) throw error;
  return data as AITaskEnvelope<TRes>;
}

export function analyzeFloorPlan(request: FloorPlanAnalysisRequest) {
  return invokeOrchestrator<FloorPlanAnalysisRequest, FloorPlanAnalysisResponse>(
    "floor_plan_analysis",
    request
  );
}

export function generateSpacePlan(request: SpacePlanningRequest) {
  return invokeOrchestrator<SpacePlanningRequest, SpacePlanningResponse>(
    "space_planning",
    request
  );
}

export function generateDesignConsultation(request: DesignConsultantRequest) {
  return invokeOrchestrator<DesignConsultantRequest, DesignConsultantResponse>(
    "design_consultant",
    request
  );
}

export function optimizeBudget(request: BudgetOptimizerRequest) {
  return invokeOrchestrator<BudgetOptimizerRequest, BudgetOptimizerResponse>(
    "budget_optimizer",
    request
  );
}
