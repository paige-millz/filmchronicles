import { useRef, useState, useEffect } from "react";
import { PhotoCard } from "@/components/PhotoCard";
import { PhotoCardSkeleton } from "@/components/PhotoCardSkeleton";

interface LazyPhotoCardProps {
  photo: {
    id: string;
    file_url: string;
    thumb_url: string | null;
    aperture: string | null;
    shutter_speed: string | null;
    iso: number | null;
    recipe: string | null;
    orientation?: string | null;
    shoot_type?: string | null;
  };
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
  initialLikeCount?: number;
  initialLiked?: boolean;
  viewMode?: "grid" | "list";
}

export const LazyPhotoCard = (props: LazyPhotoCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!isVisible) {
    return (
      <div ref={ref}>
        <PhotoCardSkeleton />
      </div>
    );
  }

  return <PhotoCard {...props} />;
};
