import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Edit, Heart, Share2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const commentSchema = z.object({
  comment: z.string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment must be less than 1000 characters')
});

interface Photo {
  id: string;
  file_url: string;
  original_filename: string;
  aperture: string | null;
  shutter_speed: string | null;
  iso: number | null;
  camera: string | null;
  recipe: string | null;
  capture_time: string | null;
  owner_id: string | null;
  shoot_type: string | null;
  tags: string[] | null;
}

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

const PhotoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<number>(0);
  const [isLiked, setIsLiked] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchPhoto();
    fetchComments();
    fetchLikes();
  }, [id, user, navigate]);

  const fetchPhoto = async () => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPhoto(data);
    } catch (error) {
      console.error("Error fetching photo:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("photo_comments")
        .select(`
          id,
          comment,
          created_at,
          user_id,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("photo_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchLikes = async () => {
    try {
      const { data: likesData, error: likesError } = await supabase
        .from("photo_likes")
        .select("user_id")
        .eq("photo_id", id);

      if (likesError) throw likesError;

      setLikes(likesData?.length || 0);
      setIsLiked(likesData?.some(like => like.user_id === user?.id) || false);
    } catch (error) {
      console.error("Error fetching likes:", error);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from("photo_likes")
          .delete()
          .eq("photo_id", id)
          .eq("user_id", user.id);

        if (error) throw error;
        setLikes(prev => prev - 1);
        setIsLiked(false);
      } else {
        const { error } = await supabase
          .from("photo_likes")
          .insert({ photo_id: id, user_id: user.id });

        if (error) throw error;
        setLikes(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Validate comment with zod
      const validated = commentSchema.parse({ comment: newComment });

      const { error } = await supabase
        .from("photo_comments")
        .insert({
          photo_id: id,
          user_id: user.id,
          comment: validated.comment,
        });

      if (error) throw error;

      setNewComment("");
      fetchComments();
      toast({
        title: "Comment added",
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      
      // Handle validation errors
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid comment",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add comment",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownload = async () => {
    if (!photo) return;

    try {
      toast({
        title: "Downloading...",
        description: "Your photo is being downloaded",
      });

      const response = await fetch(photo.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = photo.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `${photo.original_filename} has been downloaded`,
      });
    } catch (error) {
      console.error("Error downloading photo:", error);
      toast({
        title: "Error",
        description: "Failed to download photo",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Photo not found</p>
          <Link to="/">
            <Button>Back to Gallery</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = photo.owner_id === user?.id;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Gallery
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              Download
            </Button>
            {isOwner && (
              <>
                <Link to={`/share/${photo.id}`}>
                  <Button variant="outline" className="gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </Link>
                <Link to={`/edit/${photo.id}`}>
                  <Button variant="outline" className="gap-2">
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-[3/2] bg-card rounded-lg overflow-hidden">
            <img
              src={photo.file_url}
              alt={photo.original_filename}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">{photo.original_filename}</h1>
              {photo.capture_time && (
                <p className="text-muted-foreground">
                  {new Date(photo.capture_time).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {photo.aperture && (
                  <Badge variant="secondary" className="text-sm">
                    {photo.aperture}
                  </Badge>
                )}
                {photo.shutter_speed && (
                  <Badge variant="secondary" className="text-sm">
                    {photo.shutter_speed}
                  </Badge>
                )}
                {photo.iso && (
                  <Badge variant="secondary" className="text-sm">
                    ISO {photo.iso}
                  </Badge>
                )}
              </div>

              {photo.recipe && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Film Recipe</p>
                  <Badge className="text-sm">{photo.recipe}</Badge>
                </div>
              )}

              {photo.camera && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Camera</p>
                  <p className="font-medium">{photo.camera}</p>
                </div>
              )}

              {photo.shoot_type && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Shoot Type</p>
                  <Badge variant="outline">{photo.shoot_type}</Badge>
                </div>
              )}

              {photo.tags && photo.tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {photo.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-sm">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <Button
                onClick={handleLike}
                variant={isLiked ? "default" : "outline"}
                className="gap-2"
              >
                <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
                {likes} {likes === 1 ? "Like" : "Likes"}
              </Button>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h2 className="text-xl font-semibold">Comments</h2>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <Button type="submit" disabled={!newComment.trim()}>
                  Post
                </Button>
              </form>

              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No comments yet</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border-b pb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {comment.profiles.display_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </p>
                          <p className="mt-2">{comment.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoDetail;
