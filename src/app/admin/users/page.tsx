import { asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { db } from "@/db/client";
import { adminCredentials, roles, userIdentities, userRoles, users } from "@/db/schema";
import { CreateAdminForm } from "@/components/create-admin-form";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminUsersPage() {
  const actor = await requireAdmin();
  if (actor.role !== "super_admin") redirect("/admin");

  const accounts = await db.select({
    id: users.id,
    email: userIdentities.normalizedValue,
    role: roles.key,
    status: users.status,
    createdAt: adminCredentials.createdAt,
  }).from(adminCredentials)
    .innerJoin(users, eq(users.id, adminCredentials.userId))
    .innerJoin(userIdentities, eq(userIdentities.userId, users.id))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(inArray(roles.key, ["super_admin", "admin"]))
    .orderBy(asc(adminCredentials.createdAt));

  return <main className="admin-content"><div><h1 className="admin-heading">Admin users</h1><p className="admin-subtitle">Only the superadmin can provision accounts that can access this portal.</p></div><div className="dashboard-grid" style={{ marginTop: 28 }}><section className="card panel"><h2 className="panel-title">Authorized accounts</h2><table className="data-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.email}</strong></td><td><span className="status">{account.role === "super_admin" ? "SUPERADMIN" : "ADMIN"}</span></td><td>{account.status}</td><td>{account.createdAt.toLocaleDateString("en-PK")}</td></tr>)}</tbody></table></section><aside className="card panel"><ShieldCheck className="green" /><h2 className="panel-title" style={{ marginTop: 12 }}>Add an admin</h2><p className="muted">This account will be able to manage portal content, tournaments, matches, and gamers. It cannot create other admins.</p><CreateAdminForm /></aside></div></main>;
}
