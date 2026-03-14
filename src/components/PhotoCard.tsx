import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";


interface Photo {
  id: string;
  file_url: string;
  thumb_url: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: number | null;
  recipe: string | null;
  orientation?: string | null;
  shoot_type?: string | null;
  tags?: string[] | null;
}

interface PhotoCardProps {
  photo: Photo;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (id: string, selected: boolean) => void;
  initialLikeCount?: number;
  initialLiked?: boolean;
  viewMode?: "grid" | "list";
}

export const PhotoCard = ({ photo, selectionMode, isSelected, onSelectionChange, initialLikeCount = 0, initialLiked = false, viewMode = "grid" }: PhotoCardProps) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialLikeCount);
  }, [initialLiked, initialLikeCount]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || loading) return;
    
    setLoading(true);
    try {
      if (liked) {
        // Unlike
        await supabase
          .from("photo_likes")
          .delete()
          .eq("photo_id", photo.id)
          .eq("user_id", user.id);
        
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        // Like
        await supabase
          .from("photo_likes")
          .insert({ photo_id: photo.id, user_id: user.id });
        
        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      onSelectionChange?.(photo.id, !isSelected);
    }
  };

  // Determine aspect ratio based on orientation
  const getAspectRatio = () => {
    if (photo.orientation === 'portrait') return 'aspect-[2/3]';
    if (photo.orientation === 'square') return 'aspect-square';
    return 'aspect-[3/2]'; // landscape default
  };

  if (viewMode === "list") {
    return (
      <Link to={`/photo/${photo.id}`} className="group block" onClick={handleClick}>
        <div className="flex gap-4 p-4 bg-card rounded-lg border border-border transition-all group-hover:border-primary group-hover:shadow-lg group-hover:shadow-primary/20">
          {selectionMode && (
            <div className="flex items-center">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange?.(photo.id, checked as boolean)}
              />
            </div>
          )}
          <div className="relative w-32 h-32 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
            <img
              src={photo.thumb_url || photo.file_url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {photo.aperture && (
                <Badge variant="secondary" className="text-xs">
                  {photo.aperture}
                </Badge>
              )}
              {photo.shutter_speed && (
                <Badge variant="secondary" className="text-xs">
                  {photo.shutter_speed}
                </Badge>
              )}
              {photo.iso && (
                <Badge variant="secondary" className="text-xs">
                  ISO {photo.iso}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {photo.recipe && (
                <Badge className="text-xs">{photo.recipe}</Badge>
              )}
              {photo.shoot_type && (
                <Badge variant="outline" className="text-xs">
                  {photo.shoot_type}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {!selectionMode && user && (
              <button
                onClick={toggleLike}
                disabled={loading}
                className="p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${liked ? "fill-red-500 text-red-500" : "text-foreground"}`}
                />
              </button>
            )}
            {likeCount > 0 && (
              <div className="px-2 py-1 rounded-full bg-muted text-xs font-medium">
                {likeCount} {likeCount === 1 ? "like" : "likes"}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/photo/${photo.id}`} className="group block" onClick={handleClick}>
      <div className={`relative ${getAspectRatio()} bg-card rounded-lg overflow-hidden mb-3 border border-border transition-all group-hover:border-primary group-hover:shadow-lg group-hover:shadow-primary/20`}>
        <img
          src={photo.thumb_url || photo.file_url}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange?.(photo.id, checked as boolean)}
              className="bg-background/80 backdrop-blur-sm"
            />
          </div>
        )}
        {!selectionMode && user && (
          <button
            onClick={toggleLike}
            disabled={loading}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          >
            <Heart
              className={`w-3.5 h-3.5 ${liked ? "fill-red-500 text-red-500" : "text-foreground"}`}
            />
          </button>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {likeCount > 0 && (
          <div className="absolute bottom-2 right-2 z-10 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium">
            {likeCount} {likeCount === 1 ? "like" : "likes"}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {photo.aperture && (
            <Badge variant="secondary" className="text-xs">
              {photo.aperture}
            </Badge>
          )}
          {photo.shutter_speed && (
            <Badge variant="secondary" className="text-xs">
              {photo.shutter_speed}
            </Badge>
          )}
          {photo.iso && (
            <Badge variant="secondary" className="text-xs">
              ISO {photo.iso}
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {photo.recipe && (
            <Badge className="text-xs">{photo.recipe}</Badge>
          )}
          {photo.shoot_type && (
            <Badge variant="outline" className="text-xs">
              {photo.shoot_type}
            </Badge>
          )}
          {photo.tags && photo.tags.length > 0 && photo.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs opacity-70">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
};
