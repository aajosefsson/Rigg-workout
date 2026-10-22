import { useState } from "react";
import { embedUrl } from "../lib/exercises";

// A row of "▶ Exercise" buttons under a block, only for exercises that have a video.
// The video opens when tapped, so nothing is loaded until the client asks for it.
export function ExerciseVideos({ exercises, videoFor }) {
  const [open, setOpen] = useState(null); // { name, link }
  const items = (exercises || [])
    .map((name) => ({ name, link: videoFor(name) }))
    .filter((x) => x.link && embedUrl(x.link));
  if (!items.length) return null;
  const src = open ? embedUrl(open.link) : null;
  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginLeft: "40px",
          marginTop: "8px",
        }}
      >
        {items.map((x) => (
          <button
            key={x.name}
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setOpen(x)}
          >
            ▶ {x.name}
          </button>
        ))}
      </div>
      {open && src && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <div className="modal-inner">
            <div className="modal-header flex-between">
              <h3 style={{ color: "#FF6B1A" }}>{open.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div style={{ position: "relative", paddingTop: "56.25%" }}>
                <iframe
                  title={open.name}
                  src={src}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                    borderRadius: "8px",
                  }}
                />
              </div>
              <p className="muted small mt-2">
                Doesn't play?{" "}
                <a href={open.link} target="_blank" rel="noreferrer" style={{ color: "#FF9A4D" }}>
                  Open the video in a new tab
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
