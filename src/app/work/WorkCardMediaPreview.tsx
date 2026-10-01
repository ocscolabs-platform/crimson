"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type WorkCardMediaPreviewProps = {
  name: string;
  images: Array<{ url: string; alt: string }>;
};

export function WorkCardMediaPreview({ name, images }: WorkCardMediaPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const hasPreview = images.length > 1;

  const stopPreview = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActiveIndex(0);
  };

  const startPreview = () => {
    if (!hasPreview || intervalRef.current !== null) {
      return;
    }

    setActiveIndex(1);
    intervalRef.current = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 2200);
  };

  useEffect(() => () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
  }, []);

  return (
    <div
      className="work-card-media work-card-media-preview"
      tabIndex={hasPreview ? 0 : undefined}
      role={hasPreview ? "group" : undefined}
      aria-label={hasPreview ? `${name} visual preview, ${images.length} views` : `${name} project visual`}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          stopPreview();
        }
      }}
    >
      {images.map((image, index) => (
        <Image
          key={image.url}
          className={index === activeIndex ? "is-active" : undefined}
          src={image.url}
          alt={index === 0 ? image.alt : ""}
          aria-hidden={index !== 0}
          width={1600}
          height={900}
          sizes="(max-width: 760px) 100vw, 50vw"
        />
      ))}
      {hasPreview ? <span className="work-card-preview-count" aria-hidden="true">{images.length} views</span> : null}
    </div>
  );
}
