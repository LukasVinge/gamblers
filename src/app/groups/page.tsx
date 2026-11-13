import { redirect } from "next/navigation";

// There's only one group now – old /groups links go to the tip feed.
export default function GroupsPage() {
  redirect("/");
}
