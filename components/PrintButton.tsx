"use client";

export default function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button
      className="button"
      type="button"
      onClick={() => {
        const title = document.title;
        document.title = "\u00a0";
        const restore = () => {
          document.title = title;
          window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore);
        window.print();
      }}
    >
      {label}
    </button>
  );
}
