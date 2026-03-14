import { Skeleton } from "@/components/ui/skeleton";

export const PhotoCardSkeleton = () => {
  return (
    <div className="space-y-3">
      <Skeleton className="w-full aspect-[3/2] rounded-lg" />
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
};
