import Image from "next/image";

type WorkCardMediaPreviewProps = {
  image: { url: string; alt: string };
};

export function WorkCardMediaPreview({ image }: WorkCardMediaPreviewProps) {
  return (
    <div className="work-card-media work-card-media-preview">
      <Image
        src={image.url}
        alt={image.alt}
        width={1600}
        height={900}
        sizes="(max-width: 760px) 100vw, 50vw"
      />
    </div>
  );
}
