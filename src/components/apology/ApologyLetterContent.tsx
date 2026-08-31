import type { ReactNode } from "react";
import type { ApologyLetterDraft } from "@/lib/apologyLetterService";

type ApologyLetterContentProps = {
  content: ApologyLetterDraft;
  action?: ReactNode;
  preview?: boolean;
};

const sections: Array<{
  key: keyof Pick<
    ApologyLetterDraft,
    "apology" | "shouldHaveDone" | "whatImChanging"
  >;
  title: string;
}> = [
  { key: "apology", title: "I’m sorry." },
  { key: "shouldHaveDone", title: "What I should have done." },
  { key: "whatImChanging", title: "What I’m changing." }
];

export function ApologyLetterContent({
  action,
  content,
  preview = false
}: ApologyLetterContentProps) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] bg-[#fffdfb] shadow-[0_20px_55px_rgba(113,50,69,0.12)] ring-1 ring-rose-100/90">
      <header className="border-b border-rose-100/80 px-5 py-6 sm:px-7">
        {preview ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            Private preview
          </p>
        ) : null}
        <p className="text-sm font-medium text-stone-500">For Shosho</p>
        <h1 className="mt-1 font-[var(--font-display)] text-4xl leading-tight text-rose-950">
          I’m Sorry
        </h1>
        <p className="mt-2 text-sm text-stone-500">From Yuyu</p>
      </header>

      <div className="space-y-8 px-5 py-7 sm:px-7">
        {sections.map((section) => (
          <section key={section.key}>
            <h2 className="font-[var(--font-display)] text-2xl leading-tight text-rose-950">
              {section.title}
            </h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-[1.02rem] leading-8 text-stone-700">
              {content[section.key]}
            </p>
          </section>
        ))}

        <section>
          <h2 className="font-[var(--font-display)] text-2xl leading-tight text-rose-950">
            What I want to do better.
          </h2>
          <ol className="mt-4 space-y-4">
            {content.commitments.map((commitment, index) => (
              <li key={`${index}-${commitment}`} className="flex gap-3 text-[1.02rem] leading-7 text-stone-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-0.5">
                  {commitment}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-rose-100 pt-7">
          <p className="font-[var(--font-display)] text-2xl leading-snug text-rose-950">
            I don’t expect anything from you after reading this.
          </p>
          <div className="mt-4 space-y-3 text-base leading-7 text-stone-600">
            <p>You don’t have to forgive me today.</p>
            <p>You don’t have to reassure me.</p>
            <p>
              I wanted this to stay here because I don’t want my apology to disappear after one conversation.
            </p>
          </div>
          <p className="mt-6 font-semibold leading-7 text-rose-950">
            I know these words only matter if my actions match them.
          </p>
        </section>

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </article>
  );
}
