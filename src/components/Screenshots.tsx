import { useRef } from 'react';
import { useBlobUrl } from '../app/hooks';
import { addBlob, deleteBlob } from '../app/store';

function Thumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { url, name } = useBlobUrl(id);
  return (
    <figure className="relative w-28">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={name ?? 'スクリーンショット'} className="h-20 w-28 rounded-lg border border-gray-300 object-cover" />
        </a>
      ) : (
        <div className="h-20 w-28 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs leading-[5rem] text-gray-500">読み込み中</div>
      )}
      <figcaption className="truncate text-xs text-gray-600" title={name}>
        {name}
      </figcaption>
      <button type="button" className="absolute -right-1 -top-1 rounded-full border border-gray-400 bg-white px-1.5 text-xs" aria-label="このスクリーンショットを外す" onClick={onRemove}>
        ×
      </button>
    </figure>
  );
}

/** スクリーンショット（画像）の添付。Blob は IndexedDB に保存 */
export function Screenshots({ caseId, itemId, ids, onChange, label = 'スクリーンショットを添付' }: { caseId: string; itemId: string; ids: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {ids.map((id) => (
            <Thumb
              key={id}
              id={id}
              onRemove={async () => {
                if (!window.confirm('このスクリーンショットを外しますか？（ファイルも消えます）')) return;
                await deleteBlob(id);
                onChange(ids.filter((x) => x !== id));
              }}
            />
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          const added: string[] = [];
          for (const f of files) {
            const row = await addBlob(caseId, itemId, f, f.name);
            added.push(row.id);
          }
          onChange([...ids, ...added]);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <button type="button" className="btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
        ＋ {label}
      </button>
    </div>
  );
}
