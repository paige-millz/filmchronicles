import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const UpdateOrientations = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Not authenticated",
          description: "Please log in first",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "update-photo-orientations",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        console.error("Error updating orientations:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to update photo orientations",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success!",
        description: `Updated ${data.updated} photos, skipped ${data.skipped}, errors: ${data.errors}`,
      });

      // Navigate back to gallery after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update photo orientations",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">
          Update Photo Orientations
        </h1>
        
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <p className="text-foreground mb-4">
            This will analyze all your photos and update their orientation
            (landscape, portrait, or square) based on their actual dimensions.
          </p>
          <p className="text-muted-foreground text-sm mb-4">
            This is a one-time operation that will fix the orientation for all
            existing photos. Future uploads will automatically detect orientation.
          </p>
        </div>

        <Button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating orientations...
            </>
          ) : (
            "Update All Photo Orientations"
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate("/")}
          disabled={isUpdating}
          className="w-full mt-4"
        >
          Back to Gallery
        </Button>
      </div>
    </div>
  );
};

export default UpdateOrientations;
