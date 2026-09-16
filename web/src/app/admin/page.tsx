import type { Metadata } from "next";
import { AdminUsers } from "@/components/admin-users";

export const metadata: Metadata = {
  title: "Access · betterUWWorks",
};

// Only a shell: what it shows comes from /api/admin/*, which only the owner may read.
export default function AdminPage() {
  return <AdminUsers />;
}
