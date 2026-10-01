import { AppShell } from "@/components/sidebar/app-shell";

export default function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  return <AppShell>{children}</AppShell>;
}
