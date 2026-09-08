import { Bot, Lock } from 'lucide-react';
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import { calculateNextModelIndex } from './calculateNextModelIndex';
import {
  formatUnavailableModelReason,
  MODEL_ORDER,
  modelDetail,
  modelLabel,
} from './chatbotModels';
import type { FlytChatbotModel } from './types';

export function ModelPills({
  activeModel,
  isModelUsable,
  modelActions,
  modelReasons,
  onModelChange,
}: {
  activeModel: FlytChatbotModel | null;
  isModelUsable: (model: FlytChatbotModel) => boolean;
  modelActions: Partial<Record<FlytChatbotModel, string | null>>;
  modelReasons: Partial<Record<FlytChatbotModel, string | null>>;
  onModelChange: (model: FlytChatbotModel) => void;
}) {
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusableIndex = MODEL_ORDER.findIndex((model) =>
    activeModel === null ? isModelUsable(model) : model === activeModel,
  );

  const buildUnusableReason = (model: FlytChatbotModel) =>
    formatUnavailableModelReason(model, modelReasons, modelActions);

  return (
    <div
      aria-label="Choose model"
      aria-orientation="horizontal"
      className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5"
      role="radiogroup"
    >
      {MODEL_ORDER.map((model, modelIndex) => {
        const usable = isModelUsable(model);
        const selected = model === activeModel;
        const detail = modelDetail[model];
        const name = usable
          ? detail
            ? `${modelLabel[model]}, ${detail}`
            : modelLabel[model]
          : `${modelLabel[model]}, ${buildUnusableReason(model)}`;
        return (
          <button
            aria-checked={selected}
            aria-label={name}
            className={cn(
              'relative inline-flex min-h-8 shrink-0 items-center gap-1.5 radius-field border px-2.5 type-caption-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              "after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']",
              selected
                ? 'border-primary-50 bg-primary-5 text-primary-90'
                : 'border-border text-secondary-80',
              usable
                ? 'cursor-pointer hover:border-primary-30 hover:bg-primary-5 hover:text-primary-90'
                : 'cursor-not-allowed border-border bg-muted text-muted-foreground',
            )}
            disabled={!usable}
            key={model}
            onClick={() => onModelChange(model)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
              const nextIndex = calculateNextModelIndex(
                event.key,
                modelIndex,
                MODEL_ORDER,
                isModelUsable,
              );
              if (nextIndex === null) return;

              const nextModel = MODEL_ORDER[nextIndex];
              if (!nextModel || !isModelUsable(nextModel)) return;

              event.preventDefault();
              onModelChange(nextModel);
              pillRefs.current[nextIndex]?.focus();
            }}
            ref={(element) => {
              pillRefs.current[modelIndex] = element;
            }}
            role="radio"
            tabIndex={modelIndex === focusableIndex ? 0 : -1}
            title={
              usable && detail
                ? `${modelLabel[model]} · ${detail}`
                : usable
                  ? modelLabel[model]
                  : `${modelLabel[model]} · ${buildUnusableReason(model)}`
            }
            type="button"
          >
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center justify-center [&_svg]:icon-xs"
            >
              <ModelMark model={model} />
            </span>
            <span className="whitespace-nowrap">{modelLabel[model]}</span>
            {usable ? null : (
              <Lock
                aria-hidden="true"
                className="icon-sm shrink-0 text-muted-foreground"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ModelMark({ model }: { model: FlytChatbotModel }) {
  if (model === 'chatgpt') return <ChatGPTMark />;
  if (model === 'deepseek') return <DeepSeekMark />;

  return <Bot aria-hidden="true" strokeWidth={1.8} />;
}

function DeepSeekMark() {
  return (
    <svg
      aria-hidden="true"
      className="icon-xs"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" />
    </svg>
  );
}

function ChatGPTMark() {
  return (
    <svg
      aria-hidden="true"
      className="icon-sm"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.911 6.047 6.047 0 0 0-6.51-2.899A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.997 2.9 6.047 6.047 0 0 0 .742 7.096 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.998-2.9 6.056 6.056 0 0 0-.748-7.073Zm-9.022 12.608a4.476 4.476 0 0 1-2.876-1.041l.142-.08 4.778-2.759a.795.795 0 0 0 .393-.681v-6.737l2.02 1.169a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.494Zm-9.661-4.125a4.471 4.471 0 0 1-.534-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .781 0l5.843-3.369v2.333a.08.08 0 0 1-.034.061L9.74 19.95a4.499 4.499 0 0 1-6.141-1.646ZM2.341 7.896a4.485 4.485 0 0 1 2.365-1.973V11.6a.766.766 0 0 0 .388.676l5.814 3.354-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.787a4.504 4.504 0 0 1-1.646-4.116Zm16.596 3.856L13.104 8.364l2.015-1.164a.076.076 0 0 1 .071 0l4.83 2.792a4.494 4.494 0 0 1-.676 8.104v-5.677a.79.79 0 0 0-.407-.667Zm2.011-3.024-.142-.085-4.774-2.782a.775.775 0 0 0-.785 0L9.41 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.499 4.499 0 0 1 6.681 4.66ZM8.307 12.863l-2.02-1.164a.08.08 0 0 1-.038-.056V6.074a4.499 4.499 0 0 1 7.376-3.454l-.142.081-4.784 2.758a.795.795 0 0 0-.392.682v6.722Zm1.098-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
    </svg>
  );
}
