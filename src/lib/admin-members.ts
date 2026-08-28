import { createAdminClient } from "@/lib/supabase/admin";

export const CMS_ROLES = ["owner", "editor", "reviewer"] as const;
export type CmsRole = (typeof CMS_ROLES)[number];

export type AdminMember = {
  userId: string;
  email: string;
  role: CmsRole;
  createdAt: string;
  updatedAt: string;
};

export function isCmsRole(value: string): value is CmsRole {
  return CMS_ROLES.includes(value as CmsRole);
}

export async function getAdminMembers(): Promise<AdminMember[]> {
  const supabase = createAdminClient();
  const [{ data: memberships, error: membershipError }, { data: users, error: usersError }] = await Promise.all([
    supabase
      .from("cms_members")
      .select("user_id, role, created_at, updated_at")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (membershipError) throw new Error(membershipError.message);
  if (usersError) throw new Error(usersError.message);

  const emailsByUserId = new Map(users.users.map((user) => [user.id, user.email || "Invited user"]));

  return (memberships ?? [])
    .filter((member): member is typeof member & { role: CmsRole } => isCmsRole(member.role))
    .map((member) => ({
      userId: member.user_id,
      email: emailsByUserId.get(member.user_id) || "Invited user",
      role: member.role,
      createdAt: member.created_at,
      updatedAt: member.updated_at,
    }));
}

export async function inviteCmsMember(email: string, role: CmsRole, redirectTo: string) {
  const supabase = createAdminClient();
  const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteError || !data.user) {
    throw new Error(inviteError?.message || "The invitation could not be created.");
  }

  const { error: membershipError } = await supabase
    .from("cms_members")
    .upsert({ user_id: data.user.id, role }, { onConflict: "user_id" });

  if (!membershipError) return;

  const { error: cleanupError } = await supabase.auth.admin.deleteUser(data.user.id);
  if (cleanupError) {
    throw new Error(
      "The invitation was created, but the CMS role could not be assigned. No CMS access was granted; remove the pending Auth user before retrying.",
    );
  }

  throw new Error("The CMS role could not be assigned, so the invitation was rolled back. Request a new invitation.");
}

export async function updateCmsMemberRole(userId: string, role: CmsRole) {
  const supabase = createAdminClient();
  const { data: members, error: membersError } = await supabase
    .from("cms_members")
    .select("user_id, role");

  if (membersError) throw new Error(membersError.message);

  const currentMember = members?.find((member) => member.user_id === userId);
  if (!currentMember) throw new Error("That user is not assigned to the CMS.");

  const ownerCount = members?.filter((member) => member.role === "owner").length ?? 0;
  if (currentMember.role === "owner" && role !== "owner" && ownerCount <= 1) {
    throw new Error("The last owner cannot be changed to another role.");
  }

  const { error } = await supabase.from("cms_members").update({ role }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setCmsMemberTemporaryPassword(userId: string, password: string) {
  const supabase = createAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("cms_members")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError || !member) throw new Error("That user is not assigned to the CMS.");
  if (member.role === "owner") throw new Error("Owner passwords are not managed from this control.");

  const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, { password });
  if (passwordError) throw new Error("The temporary password could not be set. Try again.");
}
