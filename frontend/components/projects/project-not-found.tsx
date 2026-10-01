import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The one "not found" screen, shared by the detail page and settings. It is
 * what a non-member sees too — byte-identical to a bad id, because a 403 would
 * confirm the project exists. The sidebar deliberately stays in global scope.
 */
export function ProjectNotFound() {
  return (
    <div className="px-5 pt-10 pb-10 md:px-6.5">
      <Card
        className="mx-auto grid max-w-[520px] place-items-center gap-2.5 px-5 py-14 text-center"
        data-testid="project-not-found"
      >
        <SearchX className="size-9 text-muted-foreground" strokeWidth={1.6} />
        <h1 className="text-sm font-semibold">Project not found</h1>
        <p className="max-w-[40ch] text-xs text-muted-foreground">
          This project doesn&apos;t exist, or you don&apos;t have access to it. Ask the project
          owner to add you.
        </p>
        <Button variant="outline" size="sm" className="mt-1" asChild>
          <Link href="/projects">
            <ArrowLeft className="size-4" />
            Back to projects
          </Link>
        </Button>
      </Card>
    </div>
  );
}
