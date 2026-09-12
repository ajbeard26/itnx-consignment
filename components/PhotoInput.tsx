"use client";

import { useEffect, useState } from "react";

export default function PhotoInput() {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  return (
    <div className="photo-input">
      <input
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={(e) => {
          previews.forEach((url) => URL.revokeObjectURL(url));
          const files = [...(e.target.files || [])].slice(0, 8);
          setPreviews(files.map((file) => URL.createObjectURL(file)));
        }}
      />
      <p className="muted">Up to 8 photos, JPG/PNG/WebP, 6MB each.</p>
      {previews.length ? (
        <div className="photo-grid">
          {previews.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
