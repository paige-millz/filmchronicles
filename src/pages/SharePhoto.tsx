import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SharedUser {
  id: string;
  shared_with_user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

const SharePhoto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchSharedUsers();
  }, [id, user, navigate]);

  const fetchSharedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("photo_shares")
        .select(`
          id,
          shared_with_user_id,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("photo_id", id);

      if (error) throw error;
      setSharedUsers(data || []);
    } catch (error) {
      console.error("Error fetching shared users:", error);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      // Look up user by email using secure edge function
      const { data: lookupData, error: lookupError } = await supabase.functions.invoke(
        'lookup-user-by-email',
        { body: { email: email.trim() } }
      );

      if (lookupError || !lookupData?.userId) {
        toast({
          title: "User not found",
          description: lookupData?.error || "No user exists with that email",
          variant: "destructive",
        });
        return;
      }

      // Share the photo
      const { error } = await supabase
        .from("photo_shares")
        .insert({
          photo_id: id,
          shared_with_user_id: lookupData.userId,
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already shared",
            description: "This photo is already shared with that user",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Photo shared",
        description: "User can now view this photo",
      });

      setEmail("");
      fetchSharedUsers();
    } catch (error) {
      console.error("Error sharing photo:", error);
      toast({
        title: "Error",
        description: "Failed to share photo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("photo_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;

      toast({
        title: "Access removed",
      });

      fetchSharedUsers();
    } catch (error) {
      console.error("Error removing share:", error);
      toast({
        title: "Error",
        description: "Failed to remove access",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            to={`/photo/${id}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Photo
          </Link>
          <h1 className="text-3xl font-bold">Share Photo</h1>
          <p className="text-muted-foreground mt-2">
            Invite family members to view and comment on this photo
          </p>
        </div>

        <form onSubmit={handleShare} className="space-y-4 mb-8">
          <div className="space-y-2">
            <Label htmlFor="email">User Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="family@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={loading || !email.trim()}>
                {loading ? "Sharing..." : "Share"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the email address of a registered user
            </p>
          </div>
        </form>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Shared With</h2>
          {sharedUsers.length === 0 ? (
            <p className="text-muted-foreground">Not shared with anyone yet</p>
          ) : (
            <div className="space-y-2">
              {sharedUsers.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span className="font-medium">
                    {share.profiles.display_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnshare(share.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharePhoto;
