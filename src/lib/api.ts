import { supabase } from "./supabase";
import type { Applicant, ApplicantResult, ApplicantStatus, Assignment, Evaluation, EvaluatorProfile, Position } from "../types";

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
  // One applicant = one row = one grading sheet, even if they apply for
  // multiple positions. If a person with this name already exists, fold the
  // new position into other_positions instead of creating a duplicate row.
  const { data: existing, error: lookupError } = await supabase
    .from("applicants")
    .select("id, position_applied_id, other_positions, position_applied:positions!applicants_position_applied_id_fkey(name)")
    .ilike("full_name", input.full_name.trim())
    .maybeSingle();
  if (lookupError) throw lookupError;

  const { data: newPosition, error: posError } = await supabase
    .from("positions")
    .select("name")
    .eq("id", input.position_applied_id)
    .single();
  if (posError) throw posError;

  if (existing) {
    if (existing.position_applied_id === input.position_applied_id) return; // already applied here

    const otherPositions: string[] = (existing as any).other_positions ?? [];
    if (otherPositions.includes(newPosition.name)) return; // already recorded

    const { error } = await supabase
      .from("applicants")
      .update({ other_positions: [...otherPositions, newPosition.name] })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("applicants").insert({
    ...input,
    position_assigned_id: input.position_applied_id,
    status: "Pending",
  });
  if (error) throw error;
}

/**
 * Public lookup — no login required. Applicants type in their Applicant ID
 * (e.g. "APP-0001") to check their own status. Backed by a security-definer
 * RPC that only ever returns these few fields, never the full applicant row.
 */
export async function fetchApplicantResultByCode(code: string): Promise<ApplicantResult | null> {
  const { data, error } = await supabase
    .rpc("get_applicant_result", { p_code: code.trim() })
    .maybeSingle();
  if (error) throw error;
  return data as ApplicantResult | null;
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

/** Clears (deletes) a single panelist's submitted score sheet for an applicant. Commissioner-only. */
export async function deleteEvaluation(evaluationId: string) {
  const { error } = await supabase.from("evaluations").delete().eq("id", evaluationId);
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

/** Creates a new panel (evaluator) login. Commissioner-only — enforced server-side by the RPC. */
export async function createPanelAccount(input: {
  username: string;
  password: string;
  fullName: string;
}): Promise<EvaluatorProfile> {
  const { data, error } = await supabase
    .rpc("create_panel_account", {
      p_username: input.username.trim(),
      p_password: input.password,
      p_full_name: input.fullName.trim(),
    })
    .single();
  if (error) throw error;
  return data as EvaluatorProfile;
}

export async function fetchAssignedApplicantIdsForEvaluator(evaluatorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("applicant_evaluators")
    .select("applicant_id")
    .eq("evaluator_id", evaluatorId);
  if (error) throw error;
  return (data as { applicant_id: string }[]).map((r) => r.applicant_id);
}
