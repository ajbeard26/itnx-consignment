"use client";

import { useEffect, useRef, useState } from "react";

export default function PhotoInput({ max = 8 }: { max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Array<{ name: string; url: string }>>([]);

  useEffect(() => {
    return () => previews.forEach((item) => URL.revokeObjectURL(item.url));
  }, [previews]);

  function sync(files: File[]) {
    previews.forEach((item) => URL.revokeObjectURL(item.url));
    const next = files.slice(0, max);
    const dt = new DataTransfer();
    next.forEach((file) => dt.items.add(file));
    if (input.current) input.current.files = dt.files;
    setPreviews(next.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
  }

  return (
    <div className="photo-input">
      <input
        ref={input}
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={(e) => sync([...(e.target.files || [])])}
      />
      <p className="muted">Up to {max} photos, JPG/PNG/WebP, 6MB each.</p>
      {previews.length ? (
        <div className="photo-grid">
          {previews.map((item, index) => (
            <div key={item.url} className="photo-tile">
              <img src={item.url} alt="" />
              <button
                className="photo-remove"
                type="button"
                onClick={() => {
                  const files = [...(input.current?.files || [])];
                  files.splice(index, 1);
                  sync(files);
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
