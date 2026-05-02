import Image from "next/image";

export function TrophyIcon({
  code,
  className,
  alt,
}: {
  code: string;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={`/trophies/${code}.webp`}
      alt={alt ?? code}
      width={256}
      height={256}
      className={className}
      unoptimized
    />
  );
}
