import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** memberCount - memberNames.length is the +N chip; the API caps names at 3. */
export function MemberStack({ names, count }: { names: string[]; count: number }) {
  const overflow = count - names.length;

  return (
    <span className="flex items-center" data-testid="member-stack">
      {names.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          title={name}
          className="size-7 border-2 border-card not-first:-ml-2"
        >
          <AvatarFallback className="bg-muted text-[10px]">{initials(name)}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span className="-ml-2 grid size-7 place-items-center rounded-[10px] border-2 border-card bg-secondary text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </span>
      )}
    </span>
  );
}
