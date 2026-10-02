"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, FilePlus2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectNotFound } from "@/components/projects/project-not-found";
import { BlockFormDialog } from "@/components/context/block-form-dialog";
import { ContextEmpty } from "@/components/context/context-empty";
import { DocumentsCard } from "@/components/context/documents-card";
import { KnowledgePage } from "@/components/context/knowledge-page";
import {
  ProposalBar,
  ProposalQueue,
  SourcePanel,
} from "@/components/context/proposal-queue";
import { TextPromptDialog } from "@/components/context/text-prompt-dialog";
import { UploadDialog } from "@/components/context/upload-dialog";
import { confirmArchiveDocument, confirmDeleteBlock } from "@/constants/confirm";
import { useConfirm } from "@/hooks/use-confirm";
import {
  useArchiveDocument,
  useContextDocuments,
  useRenameDocument,
  useRereadDocument,
  useUploadDocument,
} from "@/hooks/use-context-documents";
import {
  useCreateBlock,
  useDeleteBlock,
  useKnowledge,
  useRegenerateBrief,
  useUpdateBlock,
} from "@/hooks/use-knowledge";
import { useAcceptProposal, useProposals, useRejectProposal } from "@/hooks/use-proposals";
import { useProject } from "@/hooks/use-project";
import type { BlockFormValues } from "@/components/context/block-schema";
import type { KnowledgeBlockDto, ProjectDocumentDto, ProposalItemDto } from "@/types/api";

export default function ProjectContextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useProject(id);

  // A malformed uuid is a 400 and a not-mine project is a 404. To a user those
  // are one situation, so both render here — same as the overview page.
  if (project.isError) return <ProjectNotFound />;

  return <ContextScreen projectId={id} archived={project.data?.status === "archived"} />;
}

function ContextScreen({ projectId, archived }: { projectId: string; archived: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();

  // UI-only state, never field values (frontend/CLAUDE.md).
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeBlockDto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [renaming, setRenaming] = useState<ProjectDocumentDto | undefined>();
  const [writingOwn, setWritingOwn] = useState<ProposalItemDto | undefined>();

  const documents = useContextDocuments(projectId);
  const knowledge = useKnowledge(projectId);
  const proposals = useProposals(projectId);

  const upload = useUploadDocument(projectId);
  const rename = useRenameDocument(projectId);
  const reread = useRereadDocument(projectId);
  const archiveDocument = useArchiveDocument(projectId);
  const createBlock = useCreateBlock(projectId);
  const updateBlock = useUpdateBlock(projectId);
  const deleteBlock = useDeleteBlock(projectId);
  const regenerateBrief = useRegenerateBrief(projectId);
  const accept = useAcceptProposal(projectId);
  const reject = useRejectProposal(projectId);

  // The queue is not a route: ?review=<documentId> keeps it linkable and keeps
  // the back button working.
  const reviewing = search.get("review");
  const group = proposals.data?.find((row) => row.documentId === reviewing);

  const setReview = (documentId: string | null) => {
    const next = new URLSearchParams(search.toString());
    if (documentId) next.set("review", documentId);
    else next.delete("review");
    router.push(`/projects/${projectId}/context${next.size ? `?${next}` : ""}`);
  };

  const resolving = accept.isPending || reject.isPending;
  const rows = documents.data ?? [];
  const nothingYet = !documents.isPending && rows.length === 0;

  const submitBlock = async (values: BlockFormValues) => {
    const body = {
      ...values,
      refs: values.refs.map((ref) => ({ ...ref, locator: ref.locator || null })),
    };
    if (editing) {
      await updateBlock.mutateAsync({ blockId: editing.id, body });
      toast.success("Block saved — it is now marked as yours");
    } else {
      await createBlock.mutateAsync(body);
      toast.success("Block added");
    }
    setFormOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="px-5 pt-4 pb-10 md:px-6.5 md:pt-0">
      <div className="hidden h-[58px] items-center gap-1.5 text-sm md:flex">
        <Link href="/projects" className="text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <Link
          href={`/projects/${projectId}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Overview
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-semibold">Context</span>
      </div>

      {archived && (
        <div
          data-testid="archived-ribbon"
          className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[12px] border border-warning/35 bg-warning/10 px-3.5 py-2.5"
        >
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <span className="text-xs text-foreground">
            This project is archived and read-only. Documents and citations still download.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold tracking-tight md:text-[22px]">
            Context
            <Badge variant="outline">
              {rows.length} {rows.length === 1 ? "document" : "documents"}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What Clarivo knows about this project, and the documents it learned it from.
          </p>
        </div>

        {!archived && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <FilePlus2 className="size-4" />
              Add a note
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Upload documents
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5">
        {!group && (
          <ProposalBar groups={proposals.data ?? []} onReview={(documentId) => setReview(documentId)} />
        )}

        <div className="grid items-start gap-4 md:grid-cols-[1.55fr_1fr]">
          {group ? (
            <ProposalQueue
              group={group}
              busy={resolving}
              onClose={() => setReview(null)}
              onAccept={(proposal, body) =>
                accept.mutate({ blockId: proposal.id, body }, { onSuccess: onResolved })
              }
              onReject={(proposal) => reject.mutate(proposal.id, { onSuccess: onResolved })}
              onAcceptAllAdds={async (adds) => {
                for (const proposal of adds) {
                  await accept.mutateAsync({ blockId: proposal.id });
                }
                toast.success(`${adds.length} proposals accepted`);
              }}
              onWriteOwn={(proposal: ProposalItemDto) => setWritingOwn(proposal)}
            />
          ) : nothingYet && !knowledge.data?.sections.some((s) => s.blocks.length) ? (
            <ContextEmpty
              action={
                !archived && (
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="size-4" />
                    Upload documents
                  </Button>
                )
              }
            />
          ) : (
            <KnowledgePage
              page={knowledge.data}
              isPending={knowledge.isPending}
              readOnly={archived}
              isRegenerating={regenerateBrief.isPending}
              onRegenerateBrief={() =>
                regenerateBrief.mutate(undefined, {
                  onSuccess: () => toast.success("A new brief is waiting in the review queue"),
                })
              }
              onEditBlock={(block) => {
                setEditing(block);
                setFormOpen(true);
              }}
              onDeleteBlock={(block) =>
                confirm({
                  ...confirmDeleteBlock(),
                  onConfirm: async () => {
                    await deleteBlock.mutateAsync(block.id);
                    toast.success("Block deleted");
                  },
                })
              }
            />
          )}

          {group ? (
            <SourcePanel group={group} />
          ) : (
            <DocumentsCard
              documents={rows}
              isPending={documents.isPending}
              readOnly={archived}
              onUpload={() => setUploadOpen(true)}
              onRename={(document) => setRenaming(document)}
              onReread={(document) =>
                reread.mutate(document.id, {
                  onSuccess: () => toast.success("Reading again — proposals will appear shortly"),
                })
              }
              onArchive={(document) =>
                confirm({
                  ...confirmArchiveDocument(document.title),
                  onConfirm: async () => {
                    await archiveDocument.mutateAsync(document.id);
                    toast.success("Document archived");
                  },
                })
              }
            />
          )}
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={(file, onProgress) => upload.mutateAsync({ file, onProgress })}
      />

      <TextPromptDialog
        open={Boolean(renaming)}
        title="Rename this document"
        description="Only the title changes. The file, its citations and its blocks stay exactly as they are."
        label="Title"
        initialValue={renaming?.title ?? ""}
        confirmLabel="Rename"
        busy={rename.isPending}
        onClose={() => setRenaming(undefined)}
        onSubmit={(title) =>
          rename.mutate(
            { documentId: renaming!.id, title },
            {
              onSuccess: () => {
                setRenaming(undefined);
                toast.success("Document renamed");
              },
            },
          )
        }
      />

      <TextPromptDialog
        open={Boolean(writingOwn)}
        title="Write your own statement"
        description="Neither side's wording survives, but both sources stay recorded — the proposal is rejected and the block on the page is superseded."
        label="Statement"
        initialValue={writingOwn?.statement ?? ""}
        confirmLabel="Use my wording"
        multiline
        busy={accept.isPending}
        onClose={() => setWritingOwn(undefined)}
        onSubmit={(statement) =>
          accept.mutate(
            { blockId: writingOwn!.id, body: { resolution: "write_own", statement } },
            {
              onSuccess: () => {
                setWritingOwn(undefined);
                onResolved();
              },
            },
          )
        }
      />

      <BlockFormDialog
        open={formOpen}
        block={editing}
        documents={rows}
        busy={createBlock.isPending || updateBlock.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={submitBlock}
      />
    </div>
  );

  function onResolved() {
    toast.success("Proposal resolved");
  }
}
