import { supabase } from "./supabase";
import type { Applicant, ApplicantStatus, Assignment, Evaluation, EvaluatorProfile, Position } from "../types";

export async function fetchPositions(): Promise<Position[]> {
  const { data, error } = await supabase.from("positions").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return data as Position[];
}

export async function fetchApplicants(): Promise<Applicant[]> {
  const { data, error } = await supabase
    .from("applicants")
    .select(
      "*, position_applied:positions!applicants_position_applied_id_fkey(*), position_assigned:positions!applicants_position_assigned_id_fkey(*)"
    )
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data as unknown as Applicant[];
}

export async function fetchApplicant(id: string): Promise<Applicant> {
  const { data, error } = await supabase
    .from("applicants")
    .select(
      "*, position_applied:positions!applicants_position_applied_id_fkey(*), position_assigned:positions!applicants_position_assigned_id_fkey(*)"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as Applicant;
}

export async function reassignApplicant(applicantId: string, positionId: string) {
  const { error } = await supabase
    .from("applicants")
    .update({ position_assigned_id: positionId })
    .eq("id", applicantId);
  if (error) throw error;
}

export async function updateApplicantStatus(applicantId: string, status: ApplicantStatus) {
  const { error } = await supabase.from("applicants").update({ status }).eq("id", applicantId);
  if (error) throw error;
}

export async function createApplicant(input: {
  full_name: string;
  email?: string;
  course?: string;
  year_level?: string;
  position_applied_id: string;
}) {
  const { error } = await supabase.from("applicants").insert({
    ...input,
    position_assigned_id: input.position_applied_id,
    status: "Pending",
  });
  if (error) throw error;
}

export async function fetchEvaluationsForApplicant(applicantId: string): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*, evaluator:evaluator_id(full_name)")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]).map((row) => ({
    ...row,
    evaluator_name: row.evaluator?.full_name ?? "Panelist",
  })) as Evaluation[];
}

export async function fetchMyEvaluation(applicantId: string, evaluatorId: string): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("applicant_id", applicantId)
    .eq("evaluator_id", evaluatorId)
    .maybeSingle();
  if (error) throw error;
  return data as Evaluation | null;
}

export async function upsertEvaluation(payload: Omit<Evaluation, "id" | "created_at" | "evaluator_name">) {
  const { error } = await supabase
    .from("evaluations")
    .upsert(payload, { onConflict: "applicant_id,evaluator_id" });
  if (error) throw error;
}

export async function fetchAllEvaluations(): Promise<Evaluation[]> {
  const { data, error } = await supabase.from("evaluations").select("*");
  if (error) throw error;
  return data as Evaluation[];
}

// ---------------------------------------------------------------------
// Evaluators & assignments
// ---------------------------------------------------------------------

export async function fetchEvaluators(): Promise<EvaluatorProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, role")
    .eq("role", "evaluator")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data as EvaluatorProfile[];
}

export async function fetchAllAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase.from("applicant_evaluators").select("applicant_id, evaluator_id");
  if (error) throw error;
  return data as Assignment[];
}

export async function fetchAssignedEvaluatorIds(applicantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("applicant_evaluators")
    .select("evaluator_id")
    .eq("applicant_id", applicantId);
  if (error) throw error;
  return (data as { evaluator_id: string }[]).map((r) => r.evaluator_id);
}

/** Replaces the full set of evaluators assigned to an applicant with `evaluatorIds`. */
export async function setAssignedEvaluators(applicantId: string, evaluatorIds: string[]) {
  const { error: deleteError } = await supabase
    .from("applicant_evaluators")
    .delete()
    .eq("applicant_id", applicantId);
  if (deleteError) throw deleteError;

  if (evaluatorIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("applicant_evaluators")
    .insert(evaluatorIds.map((evaluator_id) => ({ applicant_id: applicantId, evaluator_id })));
  if (insertError) throw insertError;
}

export async function fetchAssignedApplicantIdsForEvaluator(evaluatorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("applicant_evaluators")
    .select("applicant_id")
    .eq("evaluator_id", evaluatorId);
  if (error) throw error;
  return (data as { applicant_id: string }[]).map((r) => r.applicant_id);
}
