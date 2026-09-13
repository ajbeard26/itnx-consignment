"use client";

import { deletePhoto } from "@/app/consignments/[id]/actions";

export default function DealPhotos({
  id,
  images,
}: {
  id: string;
  images: Array<{ id: string; path: string }>;
}) {
  if (!images.length) return null;
  return (
    <div className="photo-grid deal-photos">
      {images.map((img) => (
        <div key={img.id} className="photo-tile">
          <img src={img.path} alt="" />
          <form action={deletePhoto.bind(null, id, img.id)}>
            <button className="photo-remove" type="submit">
              Remove
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
